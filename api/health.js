// api/health.js — verificacao rapida do backend
import { preflight, ok, setCors } from "../lib/http.js";

export const config = { runtime: "nodejs", maxDuration: 5 };

export default function handler(req, res) {
  if (preflight(req, res)) return;
  setCors(res);
  ok(res, {
    status: "ok",
    timestamp: new Date().toISOString(),
    versao: "3.0.0-v7-editorial",
    anthropic_configurado: !!process.env.ANTHROPIC_API_KEY,
    serasa_api_configurada: !!(process.env.SERASA_API_URL && process.env.SERASA_API_KEY),
    cenprot_api_configurada: !!(process.env.CENPROT_API_URL && process.env.CENPROT_API_KEY),
    modelo: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5",
  });
}
