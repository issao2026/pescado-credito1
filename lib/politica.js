// lib/politica.js
// Regras de score e politica de credito. Determinístico — sem IA aqui.
// A IA sugere, esta lib classifica risco objetivamente.

/**
 * Classifica risco pelo score Serasa segundo a politica oficial.
 * Acima de 700: baixo
 * 601 a 700: moderado
 * 501 a 600: elevado
 * Abaixo de 500: alto
 */
export function classificarRiscoPorScore(score) {
  if (score === null || score === undefined || isNaN(score)) return "inconclusivo";
  const n = Number(score);
  if (n > 700) return "baixo";
  if (n >= 601) return "moderado";
  if (n >= 501) return "elevado";
  if (n >= 0) return "alto";
  return "inconclusivo";
}

export function corDoRisco(risco) {
  return ({
    baixo: "verde",
    moderado: "amarelo",
    elevado: "laranja",
    alto: "vermelho",
    inconclusivo: "cinza",
  })[risco] || "cinza";
}

/**
 * Aplica regras de negocio em cima da classificacao base.
 * Retorna { risco_final, sugestao_acao, motivos, necessita_aprovacao_gerencial }.
 *
 * input:
 *   score: number|null
 *   restricoes: array (pode ser vazia)
 *   protestos: array (pode ser vazia)
 *   documentacao_status: "completa" | "incompleta" | "critica"
 *   historico_interno_positivo: boolean (opcional)
 */
export function aplicarRegras({ score, restricoes = [], protestos = [], documentacao_status = "incompleta", historico_interno_positivo = false }) {
  const motivos = [];
  let risco = classificarRiscoPorScore(score);
  let acao = null;
  let necessita_gerencia = false;

  // Score baixo
  if (typeof score === "number" && score < 500) {
    motivos.push("Score abaixo de 500 indica alto risco");
    acao = "somente_a_vista";
  }

  // Restricao financeira relevante sobrepoe score alto
  const restricoesRelevantes = (restricoes || []).filter((r) => {
    const tipo = (r.tipo || r.descricao || "").toString().toLowerCase();
    return /ccf|cheque sem|negativa|inadimpl|pendencia financeira|protesto/.test(tipo);
  });
  if (restricoesRelevantes.length > 0) {
    motivos.push(`Restricao financeira relevante: ${restricoesRelevantes.length} apontamento(s)`);
    if (risco === "baixo" || risco === "moderado") {
      risco = "elevado";
      motivos.push("Restricao sobrepoe score alto");
    }
    necessita_gerencia = true;
  }

  // Protesto ativo exige analise gerencial
  const protestosAtivos = (protestos || []).filter((p) => {
    const st = (p.status || "").toString().toLowerCase();
    return st === "" || st === "ativo" || st === "em_aberto";
  });
  if (protestosAtivos.length > 0) {
    motivos.push(`${protestosAtivos.length} protesto(s) ativo(s) — exige analise gerencial`);
    necessita_gerencia = true;
    if (risco === "baixo") risco = "moderado";
    if (!acao) acao = "submeter_gerencia";
  }

  // Documentacao incompleta impede aprovacao limpa
  if (documentacao_status === "critica") {
    motivos.push("Documentacao critica ausente — analise inconclusiva");
    acao = "inconclusivo";
    risco = "inconclusivo";
  } else if (documentacao_status === "incompleta") {
    motivos.push("Documentacao incompleta — aprovacao requer ressalvas");
    if (!acao) acao = "aprovar_com_restricoes";
    necessita_gerencia = necessita_gerencia || true;
  }

  // Sugestao final
  if (!acao) {
    if (risco === "baixo") acao = "aprovar";
    else if (risco === "moderado") acao = "aprovar_com_restricoes";
    else if (risco === "elevado") acao = "submeter_gerencia";
    else if (risco === "alto") acao = "somente_a_vista";
    else acao = "inconclusivo";
  }

  // Flexibilizacao por historico
  if (historico_interno_positivo && (acao === "submeter_gerencia" || acao === "aprovar_com_restricoes")) {
    motivos.push("Cliente com historico interno positivo — gerencia pode flexibilizar");
  }

  return {
    risco_final: risco,
    sugestao_acao: acao,
    motivos,
    necessita_aprovacao_gerencial: necessita_gerencia,
  };
}

/**
 * Define se a decisao final requer justificativa curta do operador.
 */
export function requerJustificativa({ decisao_humana, sugestao_ia, tem_restricao, tem_protesto, documentacao_status, fora_politica }) {
  const razoes = [];
  if (decisao_humana === "aprovar" && tem_restricao) razoes.push("Aprovar cliente com restricao");
  if (decisao_humana === "aprovar" && tem_protesto) razoes.push("Aprovar cliente com protesto");
  if ((decisao_humana === "aprovar" || decisao_humana === "aprovar_com_restricoes") && documentacao_status !== "completa") {
    razoes.push("Aprovar documentacao incompleta");
  }
  if (decisao_humana !== sugestao_ia) razoes.push("Alterou sugestao da IA");
  if (fora_politica) razoes.push("Liberar credito fora da politica");
  return { exige: razoes.length > 0, razoes };
}

/**
 * Documentos obrigatorios por tipo de pessoa.
 */
export function documentosObrigatorios(tipoPessoa) {
  if (tipoPessoa === "PJ") {
    return [
      { id: "cartao_cnpj", label: "CNPJ ou cartao CNPJ", critico: false },
      { id: "contrato_social", label: "Contrato social ou ultima alteracao", critico: false },
      { id: "comprovante_endereco_empresa", label: "Comprovante de endereco da empresa", critico: false },
      { id: "valor_pretendido", label: "Valor de compra pretendido", critico: true },
      { id: "prazo_pretendido", label: "Prazo pretendido", critico: true },
      { id: "referencias_comerciais", label: "Referencias comerciais (idealmente 3)", critico: false },
      { id: "relatorio_serasa", label: "Relatorio Serasa", critico: true },
      { id: "relatorio_cenprot", label: "Relatorio Cartorio/CENPROT", critico: true },
    ];
  }
  return [
    { id: "documento_identificacao", label: "RG, CPF ou CNH", critico: true },
    { id: "comprovante_residencia", label: "Comprovante de residencia", critico: false },
    { id: "comprovante_renda", label: "Comprovante de renda", critico: false },
    { id: "valor_pretendido", label: "Valor de compra pretendido", critico: true },
    { id: "prazo_pretendido", label: "Prazo pretendido", critico: true },
    { id: "referencias", label: "Referencias pessoais ou comerciais", critico: false },
    { id: "relatorio_serasa", label: "Relatorio Serasa", critico: true },
    { id: "relatorio_cenprot", label: "Relatorio Cartorio/CENPROT", critico: true },
  ];
}
