// api/ocr-documento.js
// POST /api/ocr-documento
// Body: { arquivos: [{ nome, mediaType, base64, tipo_esperado? }] }
//   ou: { texto: "...", tipo_esperado?: "texto_livre" }
// Resposta: { resultados: [<OCR>], tempo_total_ms, orcamento }
//
// Estrategia v3 (hibrida):
//   1. Verifica orcamento (cap mensal). Se estourado, retorna 402.
//   2. Tenta Haiku primeiro (barato)
//   3. Se confidence < threshold OU CPF/CNPJ invalido --> re-tenta com Sonnet
//   4. Registra custo no Supabase (tabela consumo_ia)

import Anthropic from "@anthropic-ai/sdk";
import { getOcrPrompt } from "../lib/prompts/ocr-documento.js";
import { preflight, methodGuard, readJSON, ok, fail, isApiKeyMissing, inferirMediaType } from "../lib/http.js";
import { getConfig, verificarOrcamento, registrarConsumo, extrairUsage } from "../lib/consumo.js";

export const config = {
  runtime: "nodejs",
  maxDuration: 60,
};

const SUPPORTED_IMAGE = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const isImage = (mime) => SUPPORTED_IMAGE.includes(mime);
const isPdf = (mime) => mime === "application/pdf";

let _client = null;
function getClient() {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 45000 });
  return _client;
}

function extrairJSON(texto) {
  if (!texto) throw new Error("resposta vazia");
  const m = texto.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("nenhum JSON na resposta: " + texto.slice(0, 200));
  try {
    return JSON.parse(m[0]);
  } catch (e) {
    throw new Error("JSON invalido: " + e.message + " | raw: " + m[0].slice(0, 200));
  }
}

function calcularConfianca(fields) {
  if (!fields || typeof fields !== "object") return 0;
  let total = 0, filled = 0;
  for (const k of Object.keys(fields)) {
    if (k.startsWith("_") || k === "tipo_documento" || k === "tipo_pessoa" || k === "qualidade_imagem" || k === "observacoes_leitura") continue;
    const v = fields[k];
    total++;
    if (v === null || v === undefined) continue;
    if (typeof v === "string" && v.trim() !== "") filled++;
    else if (typeof v === "number") filled++;
    else if (typeof v === "boolean") filled++;
    else if (Array.isArray(v) && v.length > 0) filled++;
    else if (typeof v === "object" && Object.keys(v).length > 0) filled++;
  }
  return total > 0 ? filled / total : 0;
}

function cpfCnpjValido(valor) {
  if (!valor || typeof valor !== "string") return null;
  const d = valor.replace(/\D/g, "");
  if (d.length === 0) return null;
  return d.length === 11 || d.length === 14;
}

async function chamarIA({ modelo, contentItem, prompt, maxTokens = 2000 }) {
  const resp = await getClient().messages.create({
    model: modelo,
    max_tokens: maxTokens,
    messages: [{
      role: "user",
      content: [contentItem, { type: "text", text: prompt }],
    }],
  });
  const raw = (resp.content || []).filter(b => b.type === "text").map(b => b.text).join("\n").trim();
  const usage = extrairUsage(resp);
  return { raw, usage };
}

async function processarUmArquivo({ nome, mediaType, base64, tipo_esperado }, modeloPadrao, modeloFallback, threshold) {
  const t0 = Date.now();
  const mt = mediaType || inferirMediaType(nome);

  if (!isImage(mt) && !isPdf(mt)) {
    return {
      erro: "tipo_nao_suportado",
      detalhe: "mediaType " + mt + " nao suportado. Use image/* ou application/pdf.",
      arquivo_origem: nome,
    };
  }

  const contentItem = isImage(mt)
    ? { type: "image", source: { type: "base64", media_type: mt, data: base64 } }
    : { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } };

  const prompt = getOcrPrompt(tipo_esperado || "desconhecido");

  let resultado, usage1, modeloUsado = modeloPadrao;
  try {
    const r1 = await chamarIA({ modelo: modeloPadrao, contentItem, prompt });
    usage1 = r1.usage;
    resultado = extrairJSON(r1.raw);
  } catch (e) {
    const msg = (e.message || String(e)).toLowerCase();
    const status = e.status || e.statusCode;
    let codigo = "falha_chamada_ia";
    let amigavel = e.message || String(e);

    if (status === 401 || msg.includes("authentication") || msg.includes("invalid api key") || msg.includes("invalid x-api-key")) {
      codigo = "anthropic_chave_invalida";
      amigavel = "Chave Anthropic invalida ou expirada. Admin precisa renovar em platform.claude.com.";
    } else if (msg.includes("credit balance") || msg.includes("insufficient") || msg.includes("quota") || msg.includes("billing")) {
      codigo = "anthropic_sem_credito";
      amigavel = "Saldo Anthropic esgotado. Admin precisa recarregar em platform.claude.com/settings/billing.";
    } else if (status === 429 || msg.includes("rate limit")) {
      codigo = "anthropic_rate_limit";
      amigavel = "Anthropic com rate limit. Aguarde 30 segundos e tente novamente.";
    } else if (status === 529 || msg.includes("overloaded")) {
      codigo = "anthropic_overloaded";
      amigavel = "Anthropic sobrecarregada agora. Aguarde alguns segundos.";
    }

    return {
      erro: codigo,
      detalhe: amigavel,
      detalhe_tecnico: e.message || String(e),
      arquivo_origem: nome,
      modelo: modeloPadrao,
      status_anthropic: status || null,
    };
  }

  registrarConsumo({ modelo: modeloPadrao, tokensIn: usage1.tokensIn, tokensOut: usage1.tokensOut })
    .catch(e => console.warn("[consumo] erro registrar:", e.message));

  const conf1 = calcularConfianca(resultado);
  const cpfPresente = resultado.cpf || resultado.cnpj;
  const cpfValido = cpfCnpjValido(resultado.cpf) ?? cpfCnpjValido(resultado.cnpj) ?? null;
  const precisaFallback = (conf1 < threshold) || (cpfPresente && cpfValido === false);

  let fallback_usado = false;
  let conf_final = conf1;
  let confianca_haiku = conf1;
  let confianca_sonnet = null;
  let motivo_fallback = null;

  if (precisaFallback && modeloFallback && modeloFallback !== modeloPadrao) {
    motivo_fallback = cpfPresente && cpfValido === false
      ? 'CPF/CNPJ extraido invalido: "' + (resultado.cpf || resultado.cnpj) + '"'
      : "Confidence baixa: " + (conf1 * 100).toFixed(0) + "% < " + (threshold * 100).toFixed(0) + "%";

    try {
      const r2 = await chamarIA({ modelo: modeloFallback, contentItem, prompt });
      const fields2 = extrairJSON(r2.raw);
      const conf2 = calcularConfianca(fields2);

      registrarConsumo({ modelo: modeloFallback, tokensIn: r2.usage.tokensIn, tokensOut: r2.usage.tokensOut })
        .catch(e => console.warn("[consumo] erro registrar fallback:", e.message));

      if (conf2 > conf1 || (cpfPresente && cpfValido === false)) {
        resultado = fields2;
        modeloUsado = modeloFallback;
        fallback_usado = true;
        conf_final = conf2;
      }
      confianca_sonnet = conf2;
    } catch (e) {
      console.warn("[ocr] fallback Sonnet falhou:", e.message);
    }
  }

  return {
    fields: resultado,
    confidence: conf_final,
    tipo_documento_detectado: resultado.tipo_documento || tipo_esperado || "desconhecido",
    tipo_pessoa_detectado: resultado.tipo_pessoa || "indeterminado",
    qualidade_leitura: conf_final >= 0.7 ? "alta" : conf_final >= 0.4 ? "media" : "baixa",
    arquivo_origem: nome,
    tempo_processamento_ms: Date.now() - t0,
    modelo: modeloUsado,
    fallback_usado,
    motivo_fallback,
    confianca_haiku,
    confianca_sonnet,
  };
}

async function processarTexto({ texto, tipo_esperado }, modelo) {
  const t0 = Date.now();
  const prompt = getOcrPrompt(tipo_esperado || "texto_livre");

  let raw, usage;
  try {
    const resp = await getClient().messages.create({
      model: modelo,
      max_tokens: 1500,
      messages: [{
        role: "user",
        content: [{ type: "text", text: "TEXTO BRUTO:\n\n" + texto + "\n\n" + prompt }],
      }],
    });
    raw = (resp.content || []).filter(b => b.type === "text").map(b => b.text).join("\n").trim();
    usage = extrairUsage(resp);
  } catch (e) {
    return { erro: "falha_chamada_ia", detalhe: e.message || String(e), modelo };
  }

  registrarConsumo({ modelo, tokensIn: usage.tokensIn, tokensOut: usage.tokensOut })
    .catch(e => console.warn("[consumo] erro registrar texto:", e.message));

  let fields;
  try {
    fields = extrairJSON(raw);
  } catch (e) {
    return { erro: "falha_parse_json", detalhe: e.message, raw: raw.slice(0, 500) };
  }

  return {
    fields,
    confidence: calcularConfianca(fields),
    tipo_documento_detectado: fields.tipo_documento || "texto_livre",
    tipo_pessoa_detectado: fields.tipo_pessoa || "indeterminado",
    qualidade_leitura: "alta",
    tempo_processamento_ms: Date.now() - t0,
    modelo,
  };
}

export default async function handler(req, res) {
  if (preflight(req, res)) return;
  if (!methodGuard(req, res, ["POST"])) return;
  if (isApiKeyMissing()) return fail(res, 500, "anthropic_key_ausente", "Configure ANTHROPIC_API_KEY na Vercel.");

  let body;
  try {
    body = await readJSON(req);
  } catch (e) {
    return fail(res, 400, "body_invalido", e.message);
  }

  const t0 = Date.now();

  let orcamento;
  try {
    orcamento = await verificarOrcamento();
  } catch (e) {
    console.warn("[ocr] orcamento indisponivel, seguindo sem cap:", e.message);
    orcamento = { ativa: true, motivo: "Supabase nao configurado", consumo: { total_usd: 0 }, cap: null };
  }

  if (!orcamento.ativa) {
    return fail(res, 402, "cap_atingido", orcamento.motivo, { orcamento });
  }

  let modeloPadrao = "claude-haiku-4-5-20251001";
  let modeloFallback = "claude-sonnet-4-5-20250929";
  let threshold = 0.5;

  try {
    const cfg = await getConfig();
    modeloPadrao = cfg.modelo_padrao || modeloPadrao;
    modeloFallback = cfg.modelo_fallback || modeloFallback;
    threshold = Number(cfg.fallback_threshold ?? threshold);
  } catch (e) {
    // Modo legacy: defaults
  }

  if (process.env.ANTHROPIC_MODEL) modeloPadrao = process.env.ANTHROPIC_MODEL;

  if (body.texto && (!body.arquivos || body.arquivos.length === 0)) {
    const r = await processarTexto({ texto: body.texto, tipo_esperado: body.tipo_esperado }, modeloPadrao);
    return ok(res, { resultados: [r], tempo_total_ms: Date.now() - t0, modelo_padrao: modeloPadrao, orcamento });
  }

  if (!Array.isArray(body.arquivos) || body.arquivos.length === 0) {
    return fail(res, 400, "input_vazio", "Envie 'arquivos' (array) ou 'texto' (string).");
  }
  if (body.arquivos.length > 12) {
    return fail(res, 400, "muitos_arquivos", "Maximo 12 arquivos por chamada.");
  }
  for (const a of body.arquivos) {
    if (!a || typeof a.base64 !== "string" || a.base64.length === 0) {
      return fail(res, 400, "arquivo_invalido", "Cada arquivo precisa de base64.");
    }
  }

  const resultados = await Promise.all(
    body.arquivos.map((a) => processarUmArquivo(a, modeloPadrao, modeloFallback, threshold))
  );

  return ok(res, {
    resultados,
    tempo_total_ms: Date.now() - t0,
    quantidade: resultados.length,
    modelo_padrao: modeloPadrao,
    modelo_fallback: modeloFallback,
    orcamento,
  });
}
