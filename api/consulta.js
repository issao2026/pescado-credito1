// api/consulta.js
// POST /api/consulta?tipo=serasa|cenprot
// Body: { cpf_cnpj, usar_cache? }
// Substitui consulta-serasa.js + consulta-cenprot.js (reduz 1 endpoint pra caber no Hobby plan)

import { preflight, methodGuard, readJSON, ok, fail } from "../lib/http.js";
import { soDigitos, validarDocumento } from "../lib/validacao.js";
import { buscarRelatorioCache } from "../lib/consumo.js";

export const config = { runtime: "nodejs", maxDuration: 30 };

const TIPOS = {
  serasa: {
    env_url: "SERASA_API_URL",
    env_key: "SERASA_API_KEY",
    portal: "https://www.serasaexperian.com.br/",
    nome: "Serasa",
  },
  cenprot: {
    env_url: "CENPROT_API_URL",
    env_key: "CENPROT_API_KEY",
    portal: "https://www.cenprotnacional.org.br/consulta/devedor",
    nome: "CENPROT",
  },
};

export default async function handler(req, res) {
  if (preflight(req, res)) return;
  if (!methodGuard(req, res, ["POST"])) return;

  const tipo = (req.query?.tipo || "").toLowerCase();
  if (!TIPOS[tipo]) {
    return fail(res, 400, "tipo_invalido", "Use ?tipo=serasa ou ?tipo=cenprot");
  }
  const cfg = TIPOS[tipo];

  let body;
  try { body = await readJSON(req); }
  catch (e) { return fail(res, 400, "body_invalido", e.message); }

  const doc = soDigitos(body.cpf_cnpj || "");
  if (!validarDocumento(doc)) {
    return fail(res, 400, "cpf_cnpj_invalido", "Informe CPF (11) ou CNPJ (14) digitos validos.");
  }

  // 1. CACHE
  if (body.usar_cache !== false) {
    try {
      const cache = await buscarRelatorioCache(doc, tipo);
      if (cache) {
        return ok(res, {
          modo: "cache",
          tipo,
          cpf_cnpj_consultado: doc,
          idade_dias: cache.idade_dias,
          de_ficha_id: cache.de_ficha_id,
          dados: cache.dados,
          mensagem: `Reaproveitado de analise anterior (${cache.idade_dias} dias atras).`,
        });
      }
    } catch (e) {
      console.warn(`[consulta-${tipo}] cache indisponivel:`, e.message);
    }
  }

  // 2. API REAL
  const apiUrl = process.env[cfg.env_url];
  const apiKey = process.env[cfg.env_key];

  if (apiUrl && apiKey) {
    try {
      const r = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
        body: JSON.stringify({ documento: doc }),
      });
      if (!r.ok) return fail(res, 502, `${tipo}_api_erro`, `HTTP ${r.status}`);
      const data = await r.json();
      return ok(res, { modo: "api", tipo, cpf_cnpj_consultado: doc, raw: data });
    } catch (e) {
      return fail(res, 502, `${tipo}_api_indisponivel`, e.message);
    }
  }

  // 3. FALLBACK MANUAL
  return ok(res, {
    modo: "manual",
    tipo,
    cpf_cnpj_consultado: doc,
    mensagem: `API ${cfg.nome} nao configurada. Use upload ou colar relatorio em /api/processar-relatorio?tipo=${tipo}.`,
    links_sugeridos: { portal: cfg.portal },
  });
}
