// api/fichas.js
// GET  /api/fichas          → lista todas as fichas (ordem cronológica reversa)
// POST /api/fichas          → cria uma nova ficha
// PUT  /api/fichas?id=xxx   → atualiza campos de uma ficha (ex: veredito)
// DELETE /api/fichas?id=xxx → remove uma ficha
//
// Usa Node.js runtime (padrão Vercel) — consistente com ocr-documento.js

import { readJSON } from "../lib/http.js";
import { getSupabase, assertNoError } from "../lib/supabase.js";
import { popularEntidades } from "../lib/entidades.js";

export const config = {
  runtime: "nodejs",
  maxDuration: 60,
};

// ── Helpers de resposta (Node.js / Vercel) ────────────────────
function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function json(res, data, status = 200) {
  setCors(res);
  res.status(status).json(data);
}

function err(res, msg, status = 500) {
  setCors(res);
  res.status(status).json({ error: msg });
}

// ── Handler principal ─────────────────────────────────────────
export default async function handler(req, res) {
  // Preflight CORS
  if (req.method === "OPTIONS") {
    setCors(res);
    res.status(204).end();
    return;
  }

  // req.query é parsed automaticamente pelo Vercel Node.js runtime
  const id = req.query?.id || null;

  try {
    const sb = getSupabase();

    // ── GET ───────────────────────────────────────────
    if (req.method === "GET") {
      const { data, error } = await sb
        .from("fichas")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);

      assertNoError(error, "GET /fichas");

      const fichas = (data || []).map(toFrontend);
      return json(res, fichas);
    }

    // ── POST ──────────────────────────────────────────
    if (req.method === "POST") {
      const body = await readJSON(req).catch(() => ({}));

      const row = {
        nome:          body.nome          || null,
        cpf_cnpj:      body.cnpj          || null,
        tipo:          body.tipo          || null,
        vendedor:      body.vendedor      || null,
        operador:      body.resp          || null,
        valor:         body.valor         || null,
        prazo:         body.prazo         || null,
        status:        body.status        || "Recebido",
        risco:         body.risco         || null,
        score:         body.score         || null,
        serasa:        body.serasa        || null,
        cenprot:       body.cenprot       || null,
        rec_ia:        body.recIA         || null,
        decisao_final: body.final         || null,
        justificativa: body.justificativa || null,
        dt:            body.dt            || new Date().toISOString().slice(0, 10),
        dados:         body,
      };

      const { data: created, error: createErr } = await sb
        .from("fichas")
        .insert(row)
        .select()
        .single();

      assertNoError(createErr, "POST /fichas");

      // Audit
      await sb.from("audit_trail").insert({
        ficha_id: created.id,
        acao: "criacao",
        valor_novo: row.status,
        origem: "humano",
        operador: row.operador,
      });

      // ANTI-FRAUDE: popula entidades pra cross-reference futuro
      try {
        await popularEntidades(created.id, { ...body, cpf_cnpj: row.cpf_cnpj, nome: row.nome, dados: body });
      } catch (e) { console.warn("[fichas.POST] popularEntidades falhou:", e.message); }

      return json(res, toFrontend(created), 201);
    }

    // ── PUT ───────────────────────────────────────────
    if (req.method === "PUT") {
      if (!id) return err(res, "id obrigatorio para PUT", 400);

      const body = await readJSON(req).catch(() => ({}));

      const { data: current, error: fetchErr } = await sb
        .from("fichas")
        .select("dados")
        .eq("id", id)
        .single();

      assertNoError(fetchErr, "PUT /fichas fetch");

      const dadosMesclados = { ...(current?.dados || {}), ...body };

      const updates = {
        status:        body.status        ?? undefined,
        risco:         body.risco         ?? undefined,
        score:         body.score         ?? undefined,
        decisao_final: body.decisao_final ?? body.final ?? undefined,
        justificativa: body.justificativa ?? undefined,
        rec_ia:        body.recIA         ?? undefined,
        serasa:        body.serasa        ?? undefined,
        cenprot:       body.cenprot       ?? undefined,
        dados:         dadosMesclados,
      };

      // Remove undefined
      Object.keys(updates).forEach(k => updates[k] === undefined && delete updates[k]);

      const { data: updated, error: updErr } = await sb
        .from("fichas")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      assertNoError(updErr, "PUT /fichas update");

      if (body.decisao_final || body.final) {
        await sb.from("audit_trail").insert({
          ficha_id: id,
          acao: "veredito",
          valor_novo: body.decisao_final || body.final,
          origem: "humano",
          operador: body.operador || null,
        });
      }

      // ANTI-FRAUDE: re-popula entidades (idempotente)
      try {
        await popularEntidades(id, { ...body, cpf_cnpj: updated.cpf_cnpj, nome: updated.nome, dados: dadosMesclados });
      } catch (e) { console.warn("[fichas.PUT] popularEntidades falhou:", e.message); }

      return json(res, toFrontend(updated));
    }

    // ── DELETE ────────────────────────────────────────
    if (req.method === "DELETE") {
      if (!id) return err(res, "id obrigatorio para DELETE", 400);

      const { error: delErr } = await sb
        .from("fichas")
        .delete()
        .eq("id", id);

      assertNoError(delErr, "DELETE /fichas");

      return json(res, { ok: true, id });
    }

    return err(res, "Metodo nao permitido", 405);

  } catch (e) {
    console.error("[fichas] erro:", e);
    return err(res, e.message || "Erro interno", 500);
  }
}

// ────────────────────────────────────────────────────────────
// Converte linha do Supabase para o formato que o frontend
// espera (mesmo schema de D.analyses)
// ────────────────────────────────────────────────────────────
function toFrontend(row) {
  const d = row.dados || {};
  return {
    id:        row.id,
    _dbId:     row.id,
    created_at: row.created_at,

    nome:      row.nome      ?? d.nome      ?? "—",
    cnpj:      row.cpf_cnpj  ?? d.cnpj      ?? "—",
    tipo:      row.tipo      ?? d.tipo      ?? "PJ",
    vendedor:  row.vendedor  ?? d.vendedor  ?? "—",
    valor:     row.valor     ?? d.valor     ?? 0,
    prazo:     row.prazo     ?? d.prazo     ?? "—",
    status:    row.status    ?? d.status    ?? "Recebido",
    risco:     row.risco     ?? d.risco     ?? "Pendente",
    score:     row.score     ?? d.score     ?? null,
    serasa:    row.serasa    ?? d.serasa    ?? "Não consultado",
    cenprot:   row.cenprot   ?? d.cenprot   ?? "Não consultado",
    recIA:     row.rec_ia    ?? d.recIA     ?? null,
    resp:      row.operador  ?? d.resp      ?? "—",
    final:     row.decisao_final ?? d.final ?? "—",
    decisao_final: row.decisao_final ?? d.decisao_final ?? null,
    justificativa: row.justificativa ?? d.justificativa ?? null,
    // v4.37: expor campos do veredito editavel
    limite_aprovado: d.limite_aprovado ?? null,
    prazo_aprovado:  d.prazo_aprovado  ?? null,
    decisao_user:    d.decisao_user    ?? null,
    decisao_dt:      d.decisao_dt      ?? null,
    dt:        row.dt        ?? d.dt        ?? row.created_at?.slice(0, 10) ?? "—",

    docs:      d.docs        ?? [],
    alerts:    d.alerts      ?? [],
    ocrData:   d.ocrData     ?? [],
    prot:      d.prot        ?? null,
    rest:      d.rest        ?? null,
    est:       d.est         ?? 0,
    docSt:     d.docSt       ?? "Pendente",
    analise_ia: d.analise_ia ?? null,
    // v4.27: expor `dados` completo pra frontend acessar email_vendedor, email_retorno, origem, etc
    dados:     d,
  };
}
