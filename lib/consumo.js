// lib/consumo.js
// Tracker de gastos com Anthropic API + leitura de config + cache de relatorios.
// Tudo passa pelo Supabase. Service key (server-side only).

import { getSupabase, assertNoError } from "./supabase.js";

// ─────────────────────────────────────────────
// PRECOS Anthropic (USD por 1M tokens) — atualizar quando mudar
// ─────────────────────────────────────────────
const PRECOS = {
  "claude-haiku-4-5-20251001":   { in: 1.00, out: 5.00 },
  "claude-haiku-4-5":             { in: 1.00, out: 5.00 },
  "claude-sonnet-4-5-20250929":  { in: 3.00, out: 15.00 },
  "claude-sonnet-4-5":            { in: 3.00, out: 15.00 },
  "claude-sonnet-4-6":            { in: 3.00, out: 15.00 }, // ajustar quando confirmado
  "claude-opus-4-1-20250805":    { in: 15.00, out: 75.00 },
  // fallback
  "_default":                     { in: 3.00, out: 15.00 },
};

function getPreco(modelo) {
  return PRECOS[modelo] || PRECOS._default;
}

export function calcularCusto(modelo, tokensIn = 0, tokensOut = 0) {
  const p = getPreco(modelo);
  return (tokensIn / 1_000_000) * p.in + (tokensOut / 1_000_000) * p.out;
}

function mesAtual() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function isHaiku(modelo) { return /haiku/i.test(modelo || ""); }
function isSonnet(modelo) { return /sonnet/i.test(modelo || ""); }

// ─────────────────────────────────────────────
// REGISTRAR CHAMADA — atualiza consumo_ia
// ─────────────────────────────────────────────
export async function registrarConsumo({ modelo, tokensIn, tokensOut }) {
  const sb = getSupabase();
  const mes = mesAtual();
  const custo = calcularCusto(modelo, tokensIn, tokensOut);

  // Tenta upsert. Postgres nao tem incremento direto via supabase-js,
  // entao faz SELECT atual + UPDATE.
  const { data: atual } = await sb
    .from("consumo_ia")
    .select("*")
    .eq("mes_ano", mes)
    .maybeSingle();

  if (!atual) {
    const { error } = await sb.from("consumo_ia").insert({
      mes_ano: mes,
      total_usd: custo,
      total_chamadas: 1,
      total_haiku: isHaiku(modelo) ? 1 : 0,
      total_sonnet: isSonnet(modelo) ? 1 : 0,
      total_tokens_in: tokensIn,
      total_tokens_out: tokensOut,
    });
    if (error) console.warn("[consumo] insert falhou:", error.message);
  } else {
    const { error } = await sb
      .from("consumo_ia")
      .update({
        total_usd: Number(atual.total_usd || 0) + custo,
        total_chamadas: (atual.total_chamadas || 0) + 1,
        total_haiku: (atual.total_haiku || 0) + (isHaiku(modelo) ? 1 : 0),
        total_sonnet: (atual.total_sonnet || 0) + (isSonnet(modelo) ? 1 : 0),
        total_tokens_in: Number(atual.total_tokens_in || 0) + tokensIn,
        total_tokens_out: Number(atual.total_tokens_out || 0) + tokensOut,
        atualizado_em: new Date().toISOString(),
      })
      .eq("mes_ano", mes);
    if (error) console.warn("[consumo] update falhou:", error.message);
  }

  return { mes, custo, modelo };
}

// ─────────────────────────────────────────────
// CONSULTAR CONSUMO ATUAL (do mes corrente)
// ─────────────────────────────────────────────
export async function getConsumoMes() {
  const sb = getSupabase();
  const { data } = await sb
    .from("consumo_ia")
    .select("*")
    .eq("mes_ano", mesAtual())
    .maybeSingle();
  return data || {
    mes_ano: mesAtual(),
    total_usd: 0,
    total_chamadas: 0,
    total_haiku: 0,
    total_sonnet: 0,
  };
}

// ─────────────────────────────────────────────
// CONFIG GLOBAL
// ─────────────────────────────────────────────
const _configCache = { data: null, ts: 0 };
const CONFIG_TTL_MS = 30_000; // recarrega a cada 30s

export async function getConfig(chave = null) {
  const agora = Date.now();
  if (!_configCache.data || agora - _configCache.ts > CONFIG_TTL_MS) {
    try {
      const sb = getSupabase();
      const { data, error } = await sb.from("config").select("chave, valor");
      if (error) {
        console.error("[consumo.getConfig] ERRO Supabase:", JSON.stringify(error));
        // NAO grava cache vazio - mantem o anterior se houver
        if (!_configCache.data) _configCache.data = {};
      } else {
        const map = {};
        (data || []).forEach(r => { map[r.chave] = r.valor; });
        _configCache.data = map;
        _configCache.ts = agora;
        console.log("[consumo.getConfig] OK, " + Object.keys(map).length + " chaves carregadas");
      }
    } catch (e) {
      console.error("[consumo.getConfig] EXCECAO:", e.message);
      if (!_configCache.data) _configCache.data = {};
    }
  }
  if (chave) return _configCache.data[chave];
  return _configCache.data;
}

export async function setConfig(chave, valor) {
  const sb = getSupabase();
  const { error } = await sb
    .from("config")
    .upsert({ chave, valor, atualizado_em: new Date().toISOString() });
  assertNoError(error, `setConfig ${chave}`);
  _configCache.data = null; // invalida cache
}

// ─────────────────────────────────────────────
// VERIFICAR SE IA AINDA TEM ORCAMENTO
// Retorna { ativa: bool, motivo, consumo, cap }
// ─────────────────────────────────────────────
export async function verificarOrcamento() {
  const [config, consumo] = await Promise.all([getConfig(), getConsumoMes()]);

  if (config.ia_ativa === false) {
    return { ativa: false, motivo: "IA desativada no painel admin", consumo, cap: config.cap_mensal_usd };
  }

  const cap = Number(config.cap_mensal_usd ?? 1.5);
  const gasto = Number(consumo.total_usd || 0);

  if (gasto >= cap) {
    return {
      ativa: false,
      motivo: `Cap mensal de US$ ${cap.toFixed(2)} atingido. Gasto atual: US$ ${gasto.toFixed(4)}.`,
      consumo, cap,
    };
  }

  const pctUsado = (gasto / cap) * 100;
  return {
    ativa: true,
    motivo: pctUsado >= 80 ? `Atencao: ${pctUsado.toFixed(0)}% do cap consumido` : null,
    consumo, cap, pctUsado,
  };
}

// ─────────────────────────────────────────────
// CACHE DE RELATORIOS (Serasa/CENPROT)
// Reaproveita ultima ficha do mesmo CPF/CNPJ com relatorio < X dias
// ─────────────────────────────────────────────
export async function buscarRelatorioCache(cpfCnpj, tipo /* 'serasa' | 'cenprot' */) {
  if (!cpfCnpj) return null;
  const sb = getSupabase();
  const dias = Number((await getConfig("cache_relatorios_dias")) ?? 30);
  const limiteData = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString();

  const { data } = await sb
    .from("fichas")
    .select("id, created_at, dados")
    .eq("cpf_cnpj", cpfCnpj)
    .gte("created_at", limiteData)
    .order("created_at", { ascending: false })
    .limit(1);

  if (!data || data.length === 0) return null;
  const ficha = data[0];
  const relatorio = ficha?.dados?.[`relatorio_${tipo}`] || ficha?.dados?.[tipo];
  if (!relatorio) return null;

  const idade = Math.floor((Date.now() - new Date(ficha.created_at).getTime()) / (24 * 60 * 60 * 1000));
  return {
    dados: relatorio,
    de_ficha_id: ficha.id,
    idade_dias: idade,
    origem: "cache",
  };
}

// ─────────────────────────────────────────────
// EXTRAIR TOKENS de uma resposta Anthropic
// ─────────────────────────────────────────────
export function extrairUsage(resp) {
  const u = resp?.usage || {};
  return {
    tokensIn: u.input_tokens || 0,
    tokensOut: u.output_tokens || 0,
  };
}
