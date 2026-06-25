// api/analisar-credito.js
// POST /api/analisar-credito
// Body: { cliente, documentacao, serasa, cenprot, valor_pretendido, prazo_pretendido, historico_interno_positivo?, tempos_por_etapa }
// Resposta: estrutura completa conforme spec (sla, cliente, documentacao, consultas, risco, sugestao_credito, ...)

import { callJSON } from "../lib/anthropic.js";
import { SYSTEM_ANALISE, buildUserAnalise } from "../lib/prompts/analise-credito.js";
import { preflight, methodGuard, readJSON, ok, fail, isApiKeyMissing } from "../lib/http.js";
import { aplicarRegras } from "../lib/politica.js";
import { compararDocumento, soDigitos } from "../lib/validacao.js";

export const config = {
  runtime: "nodejs",
  maxDuration: 60,
};

function calcularSlaStatus(tempo_total_segundos) {
  if (typeof tempo_total_segundos !== "number") return "desconhecido";
  if (tempo_total_segundos <= 600) {
    if (tempo_total_segundos >= 420) return "proximo_do_limite";
    return "dentro_do_sla";
  }
  return "estourado";
}

function etapaMaisLenta(tempos = {}) {
  let maior = null, valor = -1;
  for (const k of Object.keys(tempos)) {
    if (typeof tempos[k] === "number" && tempos[k] > valor) {
      valor = tempos[k];
      maior = k;
    }
  }
  return maior || "";
}

export default async function handler(req, res) {
  if (preflight(req, res)) return;
  if (!methodGuard(req, res, ["POST"])) return;
  if (isApiKeyMissing()) return fail(res, 500, "anthropic_key_ausente");

  let body;
  try { body = await readJSON(req); }
  catch (e) { return fail(res, 400, "body_invalido", e.message); }

  const cliente = body.cliente || {};
  const documentacao = body.documentacao || {};
  const serasa = body.serasa || null;
  const cenprot = body.cenprot || null;

  // Validacao cruzada determinística (nao deixar so pra IA)
  const docFicha = soDigitos(cliente.cpf_cnpj || "");
  const validacao_cruzada = {
    serasa: serasa?.cpf_cnpj_consultado
      ? compararDocumento(docFicha, serasa.cpf_cnpj_consultado)
      : { confere: null, motivo: "serasa_sem_documento" },
    cenprot: cenprot?.cpf_cnpj_consultado
      ? compararDocumento(docFicha, cenprot.cpf_cnpj_consultado)
      : { confere: null, motivo: "cenprot_sem_documento" },
  };

  // Pre-classificacao deterministica
  const restricoes = serasa?.restricoes || [];
  const protestos = cenprot?.protestos || [];
  const classificacao_local = aplicarRegras({
    score: serasa?.score ?? null,
    restricoes,
    protestos,
    documentacao_status: documentacao.status || "incompleta",
    historico_interno_positivo: !!body.historico_interno_positivo,
  });

  // Pedir interpretacao da IA
  let aiOut = null;
  try {
    aiOut = await callJSON({
      system: SYSTEM_ANALISE,
      user: buildUserAnalise({
        cliente,
        documentacao,
        serasa,
        cenprot,
        validacao_cruzada,
        valor_pretendido: body.valor_pretendido,
        prazo_pretendido: body.prazo_pretendido,
        historico_interno_positivo: !!body.historico_interno_positivo,
      }),
      maxTokens: 3000,
      temperature: 0,
    });
  } catch (e) {
    // Mesmo sem a IA, voltar com a parte deterministica para o operador nao travar
    aiOut = {
      risco: {
        classificacao: classificacao_local.risco_final,
        motivos: classificacao_local.motivos,
        fatores_positivos: [],
        fatores_negativos: [],
        inconsistencias: ["falha_chamada_ia: " + e.message],
      },
      sugestao_credito: {
        acao: classificacao_local.sugestao_acao,
        limite_sugerido: null,
        prazo_sugerido: null,
        condicoes_sugeridas: [],
        necessita_aprovacao_gerencial: classificacao_local.necessita_aprovacao_gerencial,
        justificativa: "IA indisponivel. Classificacao baseada em politica.",
      },
      resumo_executivo: "Analise gerada apenas pela politica determinística — IA falhou.",
      pendencias_para_decisao_humana: ["Confirmar analise sem auxilio da IA."],
    };
  }

  // Se houver divergencia critica de CPF/CNPJ, forcar bloqueio
  const divergencia_serasa = validacao_cruzada.serasa.confere === false;
  const divergencia_cenprot = validacao_cruzada.cenprot.confere === false;
  if (divergencia_serasa || divergencia_cenprot) {
    aiOut.risco = aiOut.risco || {};
    aiOut.risco.inconsistencias = aiOut.risco.inconsistencias || [];
    if (divergencia_serasa) aiOut.risco.inconsistencias.unshift("CPF/CNPJ do relatorio Serasa nao confere com a ficha");
    if (divergencia_cenprot) aiOut.risco.inconsistencias.unshift("CPF/CNPJ do relatorio CENPROT nao confere com a ficha");
    aiOut.sugestao_credito = aiOut.sugestao_credito || {};
    aiOut.sugestao_credito.acao = "inconclusivo";
    aiOut.sugestao_credito.necessita_aprovacao_gerencial = true;
    aiOut.sugestao_credito.justificativa = "Bloqueado por divergencia de CPF/CNPJ entre ficha e relatorio. " + (aiOut.sugestao_credito.justificativa || "");
  }

  // SLA
  const tempos = body.tempos_por_etapa || {};
  const tempo_total_segundos = Object.values(tempos).reduce((a, b) => a + (Number(b) || 0), 0);
  const sla = {
    tempo_total_segundos,
    status: calcularSlaStatus(tempo_total_segundos),
    etapa_mais_lenta: etapaMaisLenta(tempos),
    tempos_por_etapa: {
      entrada: Number(tempos.entrada) || 0,
      ocr: Number(tempos.ocr) || 0,
      conferencia: Number(tempos.conferencia) || 0,
      serasa: Number(tempos.serasa) || 0,
      cenprot: Number(tempos.cenprot) || 0,
      analise_ia: Number(tempos.analise_ia) || 0,
      veredito: Number(tempos.veredito) || 0,
    },
  };

  const resposta = {
    sla,
    cliente: {
      tipo_pessoa: cliente.tipo_pessoa || "indeterminado",
      nome_razao_social: cliente.nome_razao_social || "",
      cpf_cnpj: cliente.cpf_cnpj || "",
    },
    documentacao: {
      status: documentacao.status || "incompleta",
      documentos_recebidos: documentacao.documentos_recebidos || [],
      documentos_ausentes: documentacao.documentos_ausentes || [],
      pendencias_que_bloqueiam: documentacao.pendencias_que_bloqueiam || [],
      pendencias_que_nao_bloqueiam: documentacao.pendencias_que_nao_bloqueiam || [],
    },
    consultas: {
      serasa: {
        origem: serasa?.origem || "nao_informado",
        cpf_cnpj_consultado: serasa?.cpf_cnpj_consultado || "",
        confere_com_ficha: validacao_cruzada.serasa.confere === true,
        score: serasa?.score ?? null,
        restricoes: serasa?.restricoes || [],
        alertas: serasa?.alertas || [],
      },
      cenprot: {
        origem: cenprot?.origem || "nao_informado",
        cpf_cnpj_consultado: cenprot?.cpf_cnpj_consultado || "",
        confere_com_ficha: validacao_cruzada.cenprot.confere === true,
        protestos: cenprot?.protestos || [],
        alertas: cenprot?.alertas || [],
      },
    },
    risco: aiOut.risco || {
      classificacao: classificacao_local.risco_final,
      motivos: classificacao_local.motivos,
      fatores_positivos: [],
      fatores_negativos: [],
      inconsistencias: [],
    },
    sugestao_credito: aiOut.sugestao_credito || {
      acao: classificacao_local.sugestao_acao,
      limite_sugerido: null,
      prazo_sugerido: null,
      condicoes_sugeridas: [],
      necessita_aprovacao_gerencial: classificacao_local.necessita_aprovacao_gerencial,
      justificativa: "",
    },
    resumo_executivo: aiOut.resumo_executivo || "",
    pendencias_para_decisao_humana: aiOut.pendencias_para_decisao_humana || [],
    politica_aplicada: classificacao_local,
  };

  return ok(res, resposta);
}
