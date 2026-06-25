// lib/entidades.js
// Normaliza e popula entidades de uma ficha (titular, socios, enderecos)
// para permitir cross-reference rapido por CPF/CNPJ/nome/endereco.

import { getSupabase } from "./supabase.js";

// ─────────────────────────────────────────────
// NORMALIZACAO
// ─────────────────────────────────────────────
function soDigitos(v) {
  return String(v || "").replace(/\D/g, "");
}

function normalizarNome(v) {
  if (!v) return "";
  return String(v)
    .normalize("NFD").replace(/[̀-ͯ]/g, "") // remove acentos
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normalizarEndereco(v) {
  if (!v) return "";
  return normalizarNome(v)
    .replace(/\b(rua|av|avenida|al|alameda|tv|travessa|r\.|n\.?|num\.?|numero|n°)\b\.?/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizar(tipo, valor) {
  if (!valor) return "";
  if (tipo === "cpf" || tipo === "cnpj") return soDigitos(valor);
  if (tipo === "telefone") return soDigitos(valor);
  if (tipo === "email") return String(valor).toLowerCase().trim();
  if (tipo === "endereco") return normalizarEndereco(valor);
  return normalizarNome(valor);
}

// ─────────────────────────────────────────────
// EXTRAIR ENTIDADES DE UMA FICHA
// Recebe o body completo da ficha e retorna array de entidades a inserir
// ─────────────────────────────────────────────
export function extrairEntidades(ficha) {
  const ents = [];
  const d = ficha.dados || ficha;

  // CPF/CNPJ do titular
  const cpfCnpj = ficha.cpf_cnpj || d.cnpj || d.cpf_cnpj || d.cpf;
  if (cpfCnpj) {
    const digitos = soDigitos(cpfCnpj);
    if (digitos.length === 11) {
      ents.push({ tipo: "cpf", papel: "titular", valor_original: String(cpfCnpj), valor_norm: digitos });
    } else if (digitos.length === 14) {
      ents.push({ tipo: "cnpj", papel: "titular", valor_original: String(cpfCnpj), valor_norm: digitos });
    }
  }

  // Nome / razao social do titular
  const nome = ficha.nome || d.nome || d.razao_social || d.nome_razao_social;
  if (nome && String(nome).trim().length >= 3) {
    ents.push({ tipo: "nome", papel: "titular", valor_original: String(nome), valor_norm: normalizarNome(nome) });
  }

  // Endereco do titular
  const enderecoStr = d.endereco_completo || d.endereco_sede
    || (d.logradouro ? `${d.logradouro}, ${d.numero || ""} ${d.bairro || ""} ${d.cidade || ""} ${d.uf || ""}`.trim() : null);
  if (enderecoStr && enderecoStr.trim().length >= 5) {
    ents.push({ tipo: "endereco", papel: "endereco_empresa", valor_original: enderecoStr, valor_norm: normalizarEndereco(enderecoStr) });
  }

  // Telefone
  if (d.telefone) {
    const tel = soDigitos(d.telefone);
    if (tel.length >= 8) ents.push({ tipo: "telefone", papel: "telefone_titular", valor_original: String(d.telefone), valor_norm: tel });
  }

  // Email
  if (d.email) {
    ents.push({ tipo: "email", papel: "email_titular", valor_original: String(d.email), valor_norm: String(d.email).toLowerCase().trim() });
  }

  // SOCIOS (caso PJ com contrato social processado)
  const socios = d.socios || d.contrato_social?.socios || [];
  if (Array.isArray(socios)) {
    socios.forEach((s, idx) => {
      const ctx = { nome_socio: s.nome || null, indice: idx };
      if (s.cpf) {
        const digitos = soDigitos(s.cpf);
        if (digitos.length === 11) {
          ents.push({ tipo: "cpf", papel: "socio", valor_original: String(s.cpf), valor_norm: digitos, contexto: ctx });
        }
      }
      if (s.nome && String(s.nome).trim().length >= 3) {
        ents.push({ tipo: "nome", papel: "socio", valor_original: String(s.nome), valor_norm: normalizarNome(s.nome), contexto: ctx });
      }
    });
  }

  return ents;
}

// ─────────────────────────────────────────────
// POPULAR entidades de uma ficha (idempotente: deleta antigas e re-insere)
// ─────────────────────────────────────────────
export async function popularEntidades(fichaId, ficha) {
  const sb = getSupabase();
  const ents = extrairEntidades(ficha);
  if (!fichaId) return { inseridas: 0 };

  // Deletar antigas (pra suportar update da ficha)
  await sb.from("entidades").delete().eq("ficha_id", fichaId);

  if (ents.length === 0) return { inseridas: 0 };

  const rows = ents.map(e => ({ ...e, ficha_id: fichaId }));
  const { error } = await sb.from("entidades").insert(rows);
  if (error) {
    console.warn("[entidades] insert falhou:", error.message);
    return { inseridas: 0, erro: error.message };
  }
  return { inseridas: rows.length };
}

// ─────────────────────────────────────────────
// CROSS-CHECK: dado entradas, busca matches em OUTRAS fichas
// Input: { cpf_cnpj?, nome?, endereco?, socios?: [{cpf,nome}], excluir_ficha_id? }
// Output: { alertas: [{tipo, mensagem, ficha_id, ficha_resumo}] }
// ─────────────────────────────────────────────
export async function crossCheck(input) {
  const sb = getSupabase();
  const excluirId = input.excluir_ficha_id || null;
  const alertas = [];

  // Coleta itens a buscar
  const buscas = []; // { tipo, valor_norm, label_input, papel_esperado }

  if (input.cpf_cnpj) {
    const d = soDigitos(input.cpf_cnpj);
    if (d.length === 11) buscas.push({ tipo: "cpf", valor_norm: d, label_input: input.cpf_cnpj, origem: "titular_atual" });
    if (d.length === 14) buscas.push({ tipo: "cnpj", valor_norm: d, label_input: input.cpf_cnpj, origem: "titular_atual" });
  }
  if (input.nome) {
    buscas.push({ tipo: "nome", valor_norm: normalizarNome(input.nome), label_input: input.nome, origem: "titular_atual" });
  }
  if (input.endereco) {
    buscas.push({ tipo: "endereco", valor_norm: normalizarEndereco(input.endereco), label_input: input.endereco, origem: "endereco_atual" });
  }
  if (input.telefone) {
    const t = soDigitos(input.telefone);
    if (t.length >= 8) buscas.push({ tipo: "telefone", valor_norm: t, label_input: input.telefone, origem: "telefone_atual" });
  }
  if (input.email) {
    buscas.push({ tipo: "email", valor_norm: String(input.email).toLowerCase().trim(), label_input: input.email, origem: "email_atual" });
  }
  if (Array.isArray(input.socios)) {
    input.socios.forEach((s, idx) => {
      if (s.cpf) {
        const d = soDigitos(s.cpf);
        if (d.length === 11) buscas.push({ tipo: "cpf", valor_norm: d, label_input: s.cpf, origem: `socio[${idx}]:${s.nome || ""}` });
      }
      if (s.nome) buscas.push({ tipo: "nome", valor_norm: normalizarNome(s.nome), label_input: s.nome, origem: `socio[${idx}]` });
    });
  }

  if (buscas.length === 0) return { alertas: [], total: 0 };

  // Faz UMA query batch (OR) pra todas as buscas
  // Supabase nao tem "tuple IN", entao monta filter manualmente
  // Estrategia: para cada (tipo, valor), query separada paralela
  const promessas = buscas.map(async b => {
    let q = sb.from("entidades")
      .select("ficha_id, tipo, papel, valor_original, valor_norm, contexto")
      .eq("tipo", b.tipo)
      .eq("valor_norm", b.valor_norm);
    if (excluirId) q = q.neq("ficha_id", excluirId);
    const { data, error } = await q;
    if (error) return [];
    return (data || []).map(r => ({ ...r, busca: b }));
  });

  const resultados = (await Promise.all(promessas)).flat();
  if (resultados.length === 0) return { alertas: [], total: 0 };

  // Agrupa por ficha_id pra buscar resumo
  const fichaIds = [...new Set(resultados.map(r => r.ficha_id))];
  const { data: fichas } = await sb
    .from("fichas")
    .select("id, nome, cpf_cnpj, decisao_final, status, risco, score, created_at, valor")
    .in("id", fichaIds);
  const mapFichas = {};
  (fichas || []).forEach(f => { mapFichas[f.id] = f; });

  // Monta alertas legiveis
  resultados.forEach(r => {
    const f = mapFichas[r.ficha_id];
    if (!f) return;
    const dec = (f.decisao_final || "").toLowerCase();
    const reprovada = dec.indexOf("reprov") >= 0 || dec.indexOf("vista") >= 0;
    const aprovada = dec.indexOf("aprov") >= 0;
    const severidade = reprovada ? "alto" : aprovada ? "baixo" : "medio";

    let msg = "";
    if (r.busca.origem === "titular_atual" && r.papel === "titular") {
      msg = `${r.tipo.toUpperCase()} do titular ja consta como TITULAR da ficha #${shortId(f.id)} (${f.nome})`;
    } else if (r.busca.origem === "titular_atual" && r.papel === "socio") {
      msg = `${r.tipo.toUpperCase()} do titular ja consta como SOCIO da empresa "${f.nome}" (ficha #${shortId(f.id)})`;
    } else if (r.busca.origem.indexOf("socio[") === 0 && r.papel === "titular") {
      msg = `Socio "${r.busca.origem.split(":")[1] || ""}" (${r.tipo.toUpperCase()} ${formatar(r.tipo, r.valor_norm)}) ja consta como TITULAR da ficha #${shortId(f.id)} (${f.nome})`;
    } else if (r.busca.origem.indexOf("socio[") === 0 && r.papel === "socio") {
      msg = `Socio "${r.busca.origem.split(":")[1] || ""}" tambem aparece como socio em "${f.nome}" (ficha #${shortId(f.id)})`;
    } else if (r.busca.origem === "endereco_atual") {
      msg = `Endereco coincide com ficha #${shortId(f.id)} (${f.nome})`;
    } else if (r.busca.origem === "telefone_atual") {
      msg = `Telefone coincide com ficha #${shortId(f.id)} (${f.nome})`;
    } else if (r.busca.origem === "email_atual") {
      msg = `Email coincide com ficha #${shortId(f.id)} (${f.nome})`;
    } else {
      msg = `Match em ficha #${shortId(f.id)} (${f.nome})`;
    }

    if (f.decisao_final && f.decisao_final !== "—") {
      msg += ` — ${f.decisao_final}${f.score ? `, score ${f.score}` : ""}`;
    }

    alertas.push({
      severidade,
      tipo_match: r.tipo,
      papel_match: r.papel,
      mensagem: msg,
      ficha_relacionada: {
        id: f.id,
        nome: f.nome,
        cpf_cnpj: f.cpf_cnpj,
        decisao_final: f.decisao_final,
        status: f.status,
        risco: f.risco,
        score: f.score,
        valor: f.valor,
        created_at: f.created_at,
      },
      busca_origem: r.busca.origem,
    });
  });

  // Dedup: mesma ficha pode dar varios alertas, mas mantemos todos
  // Ordenar por severidade (alto primeiro)
  const ordemSev = { alto: 0, medio: 1, baixo: 2 };
  alertas.sort((a, b) => (ordemSev[a.severidade] - ordemSev[b.severidade]));

  return { alertas, total: alertas.length };
}

function shortId(uuid) {
  if (!uuid) return "?";
  return String(uuid).slice(0, 8);
}

function formatar(tipo, v) {
  if (tipo === "cpf" && v?.length === 11) return v.slice(0,3)+"."+v.slice(3,6)+"."+v.slice(6,9)+"-"+v.slice(9);
  if (tipo === "cnpj" && v?.length === 14) return v.slice(0,2)+"."+v.slice(2,5)+"."+v.slice(5,8)+"/"+v.slice(8,12)+"-"+v.slice(12);
  return v;
}
