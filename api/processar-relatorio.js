// api/processar-relatorio.js
// POST /api/processar-relatorio?tipo=serasa|cenprot
// Body: { texto?, arquivo?, cpf_cnpj_ficha?, origem? }

import { callJSON, imageBlock, pdfBlock, textBlock } from "../lib/anthropic.js";
import { SYSTEM_SERASA, USER_SERASA_DEFAULT } from "../lib/prompts/relatorio-serasa.js";
import { SYSTEM_CENPROT, USER_CENPROT_DEFAULT } from "../lib/prompts/relatorio-cenprot.js";
import { preflight, methodGuard, readJSON, ok, fail, isApiKeyMissing, inferirMediaType } from "../lib/http.js";
import { compararDocumento, soDigitos } from "../lib/validacao.js";

export const config = { runtime: "nodejs", maxDuration: 45 };

const PROMPTS = {
  serasa: { system: SYSTEM_SERASA, user: USER_SERASA_DEFAULT, nome: "SERASA" },
  cenprot: { system: SYSTEM_CENPROT, user: USER_CENPROT_DEFAULT, nome: "CENPROT" },
};

export default async function handler(req, res) {
  if (preflight(req, res)) return;
  if (!methodGuard(req, res, ["POST"])) return;
  if (isApiKeyMissing()) return fail(res, 500, "anthropic_key_ausente");

  const tipo = (req.query?.tipo || "").toLowerCase();
  if (!PROMPTS[tipo]) {
    return fail(res, 400, "tipo_invalido", "Use ?tipo=serasa ou ?tipo=cenprot");
  }
  const cfg = PROMPTS[tipo];

  let body;
  try { body = await readJSON(req); }
  catch (e) { return fail(res, 400, "body_invalido", e.message); }

  const t0 = Date.now();
  const blocks = [];

  if (body.arquivo && body.arquivo.base64) {
    const mt = body.arquivo.mediaType || inferirMediaType(body.arquivo.nome);
    if (mt === "application/pdf") blocks.push(pdfBlock(body.arquivo.base64));
    else if (mt && mt.startsWith("image/")) blocks.push(imageBlock(body.arquivo.base64, mt));
    else return fail(res, 400, "tipo_nao_suportado", mt);
    blocks.push(textBlock(cfg.user));
  } else if (body.texto) {
    blocks.push(textBlock(`RELATORIO ${cfg.nome} (texto colado):\n\n${body.texto}\n\n${cfg.user}`));
  } else {
    return fail(res, 400, "input_vazio", "Envie 'texto' ou 'arquivo'.");
  }

  let extraido;
  try {
    extraido = await callJSON({
      system: cfg.system,
      contentBlocks: blocks,
      maxTokens: 4096,
      temperature: 0,
    });
  } catch (e) {
    return fail(res, 502, "falha_extracao", e.message);
  }

  if (extraido.cpf_cnpj_consultado) {
    extraido.cpf_cnpj_consultado = soDigitos(extraido.cpf_cnpj_consultado);
  }
  extraido.tipo = tipo;
  extraido.origem = body.origem || (body.arquivo ? "upload" : "colado");

  let validacao = { confere: null, motivo: "ficha_nao_informada" };
  if (body.cpf_cnpj_ficha) {
    validacao = compararDocumento(body.cpf_cnpj_ficha, extraido.cpf_cnpj_consultado || "");
  }
  extraido.confere_com_ficha = validacao.confere === true;
  extraido.validacao_cruzada = validacao;
  extraido.tempo_processamento_ms = Date.now() - t0;

  return ok(res, extraido);
}
