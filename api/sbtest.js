// api/sbtest.js — reaproveitado como /api/entrada-rapida
// Extrai dados estruturados de texto livre (Whatsapp/email/anotacao) com Anthropic.
// Endpoint mantido com nome legado pra nao ultrapassar limite de 12 functions do Hobby.
// vercel.json faz rewrite /api/entrada-rapida -> /api/sbtest

import Anthropic from "@anthropic-ai/sdk";
import { preflight, methodGuard, readJSON, ok, fail } from "../lib/http.js";
import { getConfig, registrarConsumo, extrairUsage, verificarOrcamento } from "../lib/consumo.js";

export const config = { runtime: "nodejs", maxDuration: 30 };

const SYSTEM = `Voce e um extrator de dados estruturados pra sistema de credito.
Dado um texto livre (mensagem de Whatsapp, email, anotacao), extraia campos do cliente
em JSON sem inventar nada. Quando nao tiver evidencia clara, retorne null.

Formato OBRIGATORIO (JSON valido, sem texto antes ou depois):
{
  "nome_razao_social": string|null,
  "cpf_cnpj": string|null,
  "tipo_pessoa": "PF"|"PJ"|null,
  "valor_pretendido": number|null,
  "prazo_pretendido": string|null,
  "vendedor_responsavel": string|null,
  "telefone": string|null,
  "email": string|null,
  "observacoes": string|null
}

Regras:
- valor_pretendido em numero puro (sem R$, sem ponto/virgula)
- "85 mil" ou "85k" => 85000
- cpf_cnpj com pontuacao se vier
- prazo "30/60/90" => "30/60/90 dias"
- NUNCA inventar. Se incerto, null.`;

export default async function handler(req, res){
  if (preflight(req, res)) return;
  if (!methodGuard(req, res, ["POST"])) return;
  try {
    const body = await readJSON(req);
    if (!body.texto || String(body.texto).trim().length < 3){
      return fail(res, 400, "texto_obrigatorio", "Envie { texto: '...' }");
    }
    const orc = await verificarOrcamento();
    if (!orc.ativa) return fail(res, 402, "ia_indisponivel", orc.motivo);

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return fail(res, 500, "anthropic_key_ausente", "Configure ANTHROPIC_API_KEY na Vercel");

    const client = new Anthropic({ apiKey, timeout: 25000 });
    const modelo = (await getConfig("modelo_padrao")) || "claude-haiku-4-5-20251001";

    const resp = await client.messages.create({
      model: modelo,
      max_tokens: 800,
      system: SYSTEM,
      messages: [{ role: "user", content: String(body.texto).slice(0, 4000) }],
    });

    const usage = extrairUsage(resp);
    await registrarConsumo({ modelo, tokensIn: usage.tokensIn, tokensOut: usage.tokensOut });

    const txt = (resp.content || []).map(c => c.text || "").join("");
    let dados = null;
    try {
      const m = txt.match(/\{[\s\S]*\}/);
      dados = m ? JSON.parse(m[0]) : null;
    } catch(e) {
      return fail(res, 500, "parse_falhou", "IA retornou JSON invalido: " + e.message);
    }
    if (!dados) return fail(res, 500, "sem_dados", "IA nao retornou JSON identificavel");

    return ok(res, { ...dados, _modelo: modelo, _tokens: usage });

  } catch (e) {
    const status = e.status || e.statusCode || 500;
    const msg = (e.message || "").toLowerCase();
    let codigo = "erro_interno";
    if (status === 401 || msg.includes("authentication") || msg.includes("invalid api key")) codigo = "anthropic_chave_invalida";
    else if (msg.includes("credit balance") || msg.includes("insufficient") || msg.includes("quota")) codigo = "anthropic_sem_credito";
    else if (status === 429) codigo = "anthropic_rate_limit";
    else if (status === 529) codigo = "anthropic_overloaded";
    return fail(res, status, codigo, e.message);
  }
}
