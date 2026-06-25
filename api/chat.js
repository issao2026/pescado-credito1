// api/chat.js
// POST /api/chat
// Body: { mensagens: [{role, content}], modelo?, anexos?: [{tipo, mediaType, base64}] }
// Retorna: { resposta, modelo, tokens, custo, orcamento }
//
// Chat livre com Claude. Usa mesma chave/conta do sistema (env var Vercel).
// Anexos: PDF ou imagem (vision).

import Anthropic from "@anthropic-ai/sdk";
import { preflight, methodGuard, readJSON, ok, fail, isApiKeyMissing } from "../lib/http.js";
import { getConfig, verificarOrcamento, registrarConsumo, extrairUsage } from "../lib/consumo.js";

export const config = {
  runtime: "nodejs",
  maxDuration: 60,
};

const MODELOS_OK = [
  "claude-haiku-4-5-20251001",
  "claude-haiku-4-5",
  "claude-sonnet-4-5-20250929",
  "claude-sonnet-4-5",
  "claude-sonnet-4-6",
  "claude-opus-4-1-20250805",
];

let _client = null;
function getClient() {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 60000 });
  return _client;
}

const SYSTEM_PROMPT = `Voce eh um assistente integrado ao sistema Pescado Credito (analise de credito B2B).
Ajude o operador com:
- Duvidas sobre validacao de documentos
- Interpretacao de relatorios Serasa/CENPROT
- Analise de risco
- Sugestoes operacionais
- Questoes gerais

Seja direto, objetivo, em portugues. Sem emojis. Sem floreios.`;

export default async function handler(req, res) {
  if (preflight(req, res)) return;
  if (!methodGuard(req, res, ["POST"])) return;
  if (isApiKeyMissing()) return fail(res, 500, "anthropic_key_ausente", "Configure ANTHROPIC_API_KEY na Vercel.");

  let body;
  try { body = await readJSON(req); }
  catch (e) { return fail(res, 400, "body_invalido", e.message); }

  if (!Array.isArray(body.mensagens) || body.mensagens.length === 0) {
    return fail(res, 400, "mensagens_obrigatorias", "Envie array 'mensagens' com pelo menos 1 mensagem.");
  }

  // Verificar orcamento (mesmo cap do OCR)
  let orcamento;
  try {
    orcamento = await verificarOrcamento();
  } catch (e) {
    orcamento = { ativa: true, motivo: null, consumo: { total_usd: 0 }, cap: null };
  }
  if (!orcamento.ativa) {
    return fail(res, 402, "cap_atingido", orcamento.motivo, { orcamento });
  }

  // Modelo: body > config padrao > Haiku default
  let modelo = body.modelo;
  if (!modelo || !MODELOS_OK.includes(modelo)) {
    try {
      const cfg = await getConfig();
      modelo = cfg.modelo_padrao || "claude-haiku-4-5-20251001";
    } catch (e) {
      modelo = "claude-haiku-4-5-20251001";
    }
  }

  // Montar mensagens no formato Anthropic
  // Se a ultima mensagem tem anexos, anexa como content blocks
  const msgs = body.mensagens.map(m => {
    if (m.anexos && Array.isArray(m.anexos) && m.anexos.length > 0) {
      const blocks = [];
      m.anexos.forEach(a => {
        if (!a.base64) return;
        const mt = a.mediaType || "image/jpeg";
        if (mt === "application/pdf") {
          blocks.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: a.base64 } });
        } else if (mt.startsWith("image/")) {
          blocks.push({ type: "image", source: { type: "base64", media_type: mt, data: a.base64 } });
        }
      });
      if (m.content) blocks.push({ type: "text", text: String(m.content) });
      return { role: m.role || "user", content: blocks };
    }
    return { role: m.role || "user", content: String(m.content || "") };
  });

  const t0 = Date.now();
  let resp;
  try {
    resp = await getClient().messages.create({
      model: modelo,
      max_tokens: 2048,
      system: body.system || SYSTEM_PROMPT,
      messages: msgs,
    });
  } catch (e) {
    const m = (e.message || "").toLowerCase();
    const status = e.status || e.statusCode;
    let codigo = "anthropic_erro";
    let amigavel = e.message;
    if (status === 401) {
      codigo = "anthropic_chave_invalida";
      amigavel = "Chave Anthropic invalida ou expirada.";
    } else if (m.includes("credit") || m.includes("insufficient") || m.includes("quota")) {
      codigo = "anthropic_sem_credito";
      amigavel = "Saldo Anthropic esgotado. Recarregue em platform.claude.com/settings/billing.";
    } else if (status === 429) {
      codigo = "anthropic_rate_limit";
      amigavel = "Rate limit atingido. Aguarde 30 segundos.";
    } else if (status === 529) {
      codigo = "anthropic_overloaded";
      amigavel = "Anthropic sobrecarregada. Aguarde alguns segundos.";
    }
    return fail(res, 502, codigo, amigavel, { detalhe_tecnico: e.message, status: status || null });
  }

  const texto = (resp.content || []).filter(b => b.type === "text").map(b => b.text).join("\n").trim();
  const usage = extrairUsage(resp);

  // Registrar custo
  registrarConsumo({ modelo, tokensIn: usage.tokensIn, tokensOut: usage.tokensOut })
    .catch(e => console.warn("[chat] registrar consumo falhou:", e.message));

  return ok(res, {
    resposta: texto,
    modelo,
    tokens: usage,
    tempo_ms: Date.now() - t0,
    orcamento,
  });
}
