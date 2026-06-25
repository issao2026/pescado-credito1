// api/admin/historico-cliente.js
// GET /api/admin/historico-cliente?cpf_cnpj=00011122233
// Retorna todas as analises desse cliente, ordenadas do mais recente para o mais antigo

import { preflight, methodGuard, ok, fail } from "../../lib/http.js";
import { getSupabase } from "../../lib/supabase.js";

export const config = { runtime: "nodejs", maxDuration: 10 };

export default async function handler(req, res) {
  if (preflight(req, res)) return;
  if (!methodGuard(req, res, ["GET"])) return;

  const cpfCnpj = (req.query?.cpf_cnpj || "").replace(/\D/g, "");
  if (!cpfCnpj || (cpfCnpj.length !== 11 && cpfCnpj.length !== 14)) {
    return fail(res, 400, "cpf_cnpj_invalido", "Envie ?cpf_cnpj= com 11 (CPF) ou 14 (CNPJ) digitos");
  }

  try {
    const sb = getSupabase();
    // Busca por cpf_cnpj com e sem formatacao (Supabase nao normaliza)
    const { data, error } = await sb
      .from("fichas")
      .select("id, created_at, nome, cpf_cnpj, status, risco, score, decisao_final, valor, prazo")
      .or("cpf_cnpj.eq." + cpfCnpj + ",cpf_cnpj.eq." + formatar(cpfCnpj))
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) throw new Error(error.message);
    return ok(res, { cpf_cnpj: cpfCnpj, total: data?.length || 0, analises: data || [] });
  } catch (e) {
    return fail(res, 500, "erro_historico", e.message);
  }
}

function formatar(d) {
  if (d.length === 11) return d.slice(0,3) + "." + d.slice(3,6) + "." + d.slice(6,9) + "-" + d.slice(9);
  if (d.length === 14) return d.slice(0,2) + "." + d.slice(2,5) + "." + d.slice(5,8) + "/" + d.slice(8,12) + "-" + d.slice(12);
  return d;
}
