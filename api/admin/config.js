// api/admin/config.js
// GET  /api/admin/config         --> retorna todas as configs
// POST /api/admin/config         --> body: { chave, valor } atualiza uma config
//
// Chaves usadas no sistema:
//   modelo_padrao       (string)  Haiku/Sonnet/Opus
//   modelo_fallback     (string)
//   cap_mensal_usd      (number)
//   fallback_threshold  (number)  0-1
//   cache_relatorios_dias (number)
//   ia_ativa            (boolean) switch geral

import { preflight, methodGuard, readJSON, ok, fail } from "../../lib/http.js";
import { getConfig, setConfig } from "../../lib/consumo.js";

export const config = { runtime: "nodejs", maxDuration: 10 };

const MODELOS_VALIDOS = [
  "claude-haiku-4-5-20251001",
  "claude-haiku-4-5",
  "claude-sonnet-4-5-20250929",
  "claude-sonnet-4-5",
  "claude-sonnet-4-6",
  "claude-opus-4-1-20250805",
];

export default async function handler(req, res) {
  if (preflight(req, res)) return;
  if (!methodGuard(req, res, ["GET", "POST"])) return;

  try {
    if (req.method === "GET") {
      const cfg = await getConfig();
      // Debug: testa Supabase direto se config vier vazia (diagnostico)
      let debug = null;
      if (!cfg || Object.keys(cfg).length === 0) {
        try {
          const { getSupabase } = await import("../../lib/supabase.js");
          const sb = getSupabase();
          const { data, error, count } = await sb.from("config").select("*", { count: "exact" });
          debug = {
            rows: data?.length || 0,
            error: error?.message || null,
            count,
            env_url_check: {
              type: typeof process.env.SUPABASE_URL,
              length: process.env.SUPABASE_URL ? process.env.SUPABASE_URL.length : 0,
              starts: process.env.SUPABASE_URL ? process.env.SUPABASE_URL.slice(0, 30) : null,
              ends: process.env.SUPABASE_URL ? process.env.SUPABASE_URL.slice(-20) : null,
              has_https: process.env.SUPABASE_URL ? process.env.SUPABASE_URL.includes("https://") : false,
              has_supabase: process.env.SUPABASE_URL ? process.env.SUPABASE_URL.includes("supabase.co") : false,
              char_codes: process.env.SUPABASE_URL ? Array.from(process.env.SUPABASE_URL.slice(0, 8)).map(c => c.charCodeAt(0)) : [],
            },
          };
        } catch (e) {
          debug = { exception: e.message };
        }
      }
      return ok(res, { config: cfg, modelos_disponiveis: MODELOS_VALIDOS, _debug: debug });
    }

    if (req.method === "POST") {
      const body = await readJSON(req);
      if (!body.chave) return fail(res, 400, "chave_obrigatoria", "Envie { chave, valor }");
      if (body.valor === undefined) return fail(res, 400, "valor_obrigatorio", "Envie { chave, valor }");

      // Validacao basica por chave
      if (body.chave === "modelo_padrao" || body.chave === "modelo_fallback") {
        if (!MODELOS_VALIDOS.includes(body.valor)) {
          return fail(res, 400, "modelo_invalido", "Modelo nao reconhecido: " + body.valor, { validos: MODELOS_VALIDOS });
        }
      }
      if (body.chave === "cap_mensal_usd") {
        const v = Number(body.valor);
        if (isNaN(v) || v <= 0 || v > 100) {
          return fail(res, 400, "cap_invalido", "Cap deve ser numero entre 0 e 100 USD");
        }
        body.valor = v;
      }
      if (body.chave === "fallback_threshold") {
        const v = Number(body.valor);
        if (isNaN(v) || v < 0 || v > 1) {
          return fail(res, 400, "threshold_invalido", "Threshold deve ser entre 0 e 1");
        }
        body.valor = v;
      }
      if (body.chave === "cache_relatorios_dias") {
        const v = Number(body.valor);
        if (isNaN(v) || v < 0 || v > 365) {
          return fail(res, 400, "cache_invalido", "Dias deve ser entre 0 e 365");
        }
        body.valor = v;
      }
      if (body.chave === "ia_ativa") {
        body.valor = !!body.valor;
      }

      await setConfig(body.chave, body.valor);
      return ok(res, { ok: true, chave: body.chave, valor: body.valor });
    }
  } catch (e) {
    return fail(res, 500, "erro_config", e.message);
  }
}
