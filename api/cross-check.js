// api/cross-check.js
// POST /api/cross-check
// Body: { cpf_cnpj?, nome?, endereco?, telefone?, email?, socios?: [{cpf,nome}], excluir_ficha_id? }
// Retorna: { alertas: [...], total }
//
// Use ANTES da conferencia humana pra detectar:
// - CPF que ja apareceu como socio de empresa reprovada
// - Nome igual a titular de outra ficha
// - Endereco compartilhado entre fichas
// - Socio que aparece em multiplas empresas

import { preflight, methodGuard, readJSON, ok, fail } from "../lib/http.js";
import { crossCheck } from "../lib/entidades.js";

export const config = { runtime: "nodejs", maxDuration: 15 };

export default async function handler(req, res) {
  if (preflight(req, res)) return;
  if (!methodGuard(req, res, ["POST"])) return;

  let body;
  try { body = await readJSON(req); }
  catch (e) { return fail(res, 400, "body_invalido", e.message); }

  try {
    const result = await crossCheck(body);
    return ok(res, result);
  } catch (e) {
    return fail(res, 500, "erro_cross_check", e.message);
  }
}
