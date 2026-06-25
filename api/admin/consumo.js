// api/admin/consumo.js
// GET /api/admin/consumo --> retorna consumo do mes atual + historico (6 meses)

import { preflight, methodGuard, ok, fail } from "../../lib/http.js";
import { getSupabase } from "../../lib/supabase.js";
import { getConsumoMes, verificarOrcamento } from "../../lib/consumo.js";

export const config = { runtime: "nodejs", maxDuration: 10 };

export default async function handler(req, res) {
  if (preflight(req, res)) return;
  if (!methodGuard(req, res, ["GET"])) return;

  try {
    const sb = getSupabase();
    const [mesAtual, orcamento, hist] = await Promise.all([
      getConsumoMes(),
      verificarOrcamento(),
      sb.from("consumo_ia").select("*").order("mes_ano", { ascending: false }).limit(6),
    ]);

    return ok(res, {
      mes_atual: mesAtual,
      orcamento,
      historico: hist.data || [],
    });
  } catch (e) {
    return fail(res, 500, "erro_consumo", e.message);
  }
}
