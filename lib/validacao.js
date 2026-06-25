// lib/validacao.js
// Normalizacao e validacao de CPF/CNPJ. Usado para validar relatorios vs ficha.

export function soDigitos(s) {
  return (s || "").toString().replace(/\D/g, "");
}

export function formatarCPF(d) {
  d = soDigitos(d);
  if (d.length !== 11) return d;
  return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

export function formatarCNPJ(d) {
  d = soDigitos(d);
  if (d.length !== 14) return d;
  return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
}

export function formatarDocumento(d) {
  const n = soDigitos(d);
  if (n.length === 11) return formatarCPF(n);
  if (n.length === 14) return formatarCNPJ(n);
  return n;
}

export function tipoPessoa(d) {
  const n = soDigitos(d);
  if (n.length === 11) return "PF";
  if (n.length === 14) return "PJ";
  return "indeterminado";
}

export function validarCPF(cpf) {
  cpf = soDigitos(cpf);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  let s = 0;
  for (let i = 0; i < 9; i++) s += parseInt(cpf[i]) * (10 - i);
  let r = 11 - (s % 11);
  if (r >= 10) r = 0;
  if (r !== parseInt(cpf[9])) return false;
  s = 0;
  for (let i = 0; i < 10; i++) s += parseInt(cpf[i]) * (11 - i);
  r = 11 - (s % 11);
  if (r >= 10) r = 0;
  return r === parseInt(cpf[10]);
}

export function validarCNPJ(cnpj) {
  cnpj = soDigitos(cnpj);
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;
  const calc = (base, pesos) => {
    let s = 0;
    for (let i = 0; i < base.length; i++) s += parseInt(base[i]) * pesos[i];
    const r = s % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const p1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const p2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const d1 = calc(cnpj.slice(0, 12), p1);
  if (d1 !== parseInt(cnpj[12])) return false;
  const d2 = calc(cnpj.slice(0, 13), p2);
  return d2 === parseInt(cnpj[13]);
}

export function validarDocumento(d) {
  const n = soDigitos(d);
  if (n.length === 11) return validarCPF(n);
  if (n.length === 14) return validarCNPJ(n);
  return false;
}

/**
 * Compara dois documentos. Retorna { confere, doc_ficha, doc_relatorio, motivo }.
 * Usado para checar se o CPF/CNPJ do relatorio Serasa/CENPROT bate com o da ficha.
 */
export function compararDocumento(docFicha, docRelatorio) {
  const a = soDigitos(docFicha);
  const b = soDigitos(docRelatorio);
  if (!a || !b) {
    return { confere: false, doc_ficha: a, doc_relatorio: b, motivo: "documento_ausente" };
  }
  if (a === b) {
    return { confere: true, doc_ficha: a, doc_relatorio: b };
  }
  return { confere: false, doc_ficha: a, doc_relatorio: b, motivo: "documento_divergente" };
}

/**
 * Extrai primeiro CPF ou CNPJ encontrado em texto livre. Retorna { numero, tipo } ou null.
 */
export function extrairCpfCnpj(texto) {
  if (!texto) return null;
  const t = texto.replace(/\s+/g, " ");
  const mCnpj = t.match(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/);
  if (mCnpj) {
    const n = soDigitos(mCnpj[0]);
    if (validarCNPJ(n)) return { numero: n, tipo: "PJ", formatado: formatarCNPJ(n) };
  }
  const mCpf = t.match(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/);
  if (mCpf) {
    const n = soDigitos(mCpf[0]);
    if (validarCPF(n)) return { numero: n, tipo: "PF", formatado: formatarCPF(n) };
  }
  return null;
}
