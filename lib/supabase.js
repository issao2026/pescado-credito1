// lib/supabase.js
// Singleton Supabase client para uso EXCLUSIVO server-side (Vercel Functions)
// NUNCA expor SUPABASE_SERVICE_KEY no frontend

import { createClient } from "@supabase/supabase-js";

let _client = null;

export function getSupabase() {
  if (_client) return _client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;

  // DEBUG temporario: revela o que esta chegando na env var (sem expor a key)
  const urlInfo = {
    type: typeof url,
    length: url ? url.length : 0,
    starts: url ? url.slice(0, 30) : null,
    ends: url ? url.slice(-20) : null,
    has_https: url ? url.includes("https://") : false,
    has_supabase: url ? url.includes("supabase.co") : false,
    char_codes_start: url ? Array.from(url.slice(0, 8)).map(c => c.charCodeAt(0)) : [],
  };
  console.log("[SUPABASE DEBUG] URL recebida:", JSON.stringify(urlInfo));

  if (!url || !key) {
    throw new Error(
      "[BUILD_TAG_2026-06-24_TESTE_URL] Supabase nao configurado. Defina SUPABASE_URL e SUPABASE_SERVICE_KEY. DEBUG: " + JSON.stringify(urlInfo)
    );
  }

  try {
    _client = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  } catch (err) {
    // Re-lanca com info de debug sobre o que a env var contem
    throw new Error(
      "[BUILD_TAG_2026-06-24_TESTE_URL] createClient falhou: " + err.message + " | URL_DEBUG=" + JSON.stringify(urlInfo)
    );
  }

  return _client;
}

// Helper: lanca erro padrao se query do Supabase falhou
export function assertNoError(error, contexto) {
  if (error) {
    console.error(`[supabase] erro em ${contexto}:`, error);
    throw new Error(`Erro Supabase (${contexto}): ${error.message}`);
  }
}
