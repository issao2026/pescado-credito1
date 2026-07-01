// lib/prompts/ocr-documento.js
// Prompts simples por tipo de documento — estilo Efcon.
// JSON plano, sem metadados. Claude responde melhor com instrucoes diretas.

const PROMPTS = {
  rg: `Examine cuidadosamente este documento de identificacao brasileiro (RG, CIN, CNH ou variantes). Examine TODA a imagem com atencao, incluindo regioes pequenas, marcas dagua, frente E verso se presentes.

PROCURA CRITICA - PROCURE INTENSAMENTE PELO CPF:
- O CPF eh um numero de 11 digitos, geralmente no formato XXX.XXX.XXX-XX ou XXXXXXXXXXX (so digitos)
- Em RGs novos (CIN), o CPF eh o numero principal e aparece em destaque
- Em RGs antigos pode estar discreto, em fonte pequena, em qualquer regiao
- Em CNH, esta no campo "4d CPF" (NAO confundir com numero da CNH ou Registro)
- Se voce ver um RG, OLHE TAMBEM no verso ou nas margens — muitas vezes o CPF esta la

ANTI-ALUCINACAO APENAS NO CPF (nao afeta outros campos):
- Para o campo "cpf" especificamente: leia digito por digito, releia 2 vezes.
- Se o CPF estiver legivel, retorne ele. Se algum digito especifico estiver borrado, retorne "" (vazio) APENAS pra esse campo.
- NUNCA invente ou substitua digitos no CPF. Cuidado com 1↔7, 3↔8, 5↔6, 0↔8.
- IMPORTANTE: isso vale SO pro CPF. NOME, datas, e outros campos: extraia normalmente, mesmo se nao puder validar duas vezes.
- Lembre-se: digitar CPF errado é pior que nao digitar. Mas omitir nome legivel é desperdicio.

Retorne JSON com EXATAMENTE estas chaves:
{
  "tipo_documento": "rg | cnh | cin",
  "tipo_pessoa": "PF",
  "nome_completo": "",
  "rg_numero": "",
  "cpf": "",
  "data_nascimento": "",
  "data_emissao": "",
  "data_validade": "",
  "filiacao_mae": "",
  "filiacao_pai": "",
  "orgao_emissor": "",
  "naturalidade": "",
  "nacionalidade": "brasileira",
  "qualidade_imagem": "alta | media | baixa",
  "observacoes_leitura": ""
}

REGRAS:
- "nome_completo": nome do TITULAR, minimo 2 palavras. NAO eh cidade, estado, orgao ou nome dos pais
- "filiacao_mae" / "filiacao_pai": nomes dos PAIS, NAO do titular
- "orgao_emissor": sigla (SSP, DETRAN) + UF
- Datas no formato dd/mm/yyyy
- Na CNH: "rg_numero" esta no campo "4c DOC IDENTIDADE". "cpf" esta no "4d CPF". IGNORE o MRZ (linhas com <<<)
- "qualidade_imagem": sua avaliacao da imagem fornecida
- "observacoes_leitura": se algum campo critico (CPF, nome) ficou ilegivel, descreva brevemente o porque

Apenas o JSON, sem markdown.`,

  cpf: `Extraia do CPF e retorne JSON com EXATAMENTE estas chaves (use string vazia se nao conseguir):
{
  "tipo_documento": "cpf",
  "tipo_pessoa": "PF",
  "nome_completo": "",
  "cpf": "",
  "data_nascimento": ""
}
- "nome_completo" eh o TITULAR. NAO eh "RECEITA FEDERAL" nem cidade
- Data dd/mm/yyyy
Apenas JSON.`,

  cartao_cnpj: `Extraia do Cartao CNPJ ou Comprovante de Inscricao e retorne JSON com EXATAMENTE estas chaves:
{
  "tipo_documento": "cartao_cnpj",
  "tipo_pessoa": "PJ",
  "cnpj": "",
  "razao_social": "",
  "nome_fantasia": "",
  "data_abertura": "",
  "situacao_cadastral": "",
  "atividade_principal": "",
  "natureza_juridica": "",
  "endereco_completo": "",
  "logradouro": "",
  "numero": "",
  "bairro": "",
  "cidade": "",
  "uf": "",
  "cep": "",
  "telefone": "",
  "email": "",
  "capital_social": ""
}
- "cnpj" no formato 00.000.000/0000-00
- Datas dd/mm/yyyy
- "capital_social" numerico com ponto decimal, sem R$
- "uf" sigla 2 letras
Apenas JSON.`,

  contrato_social: `Extraia do Contrato Social ou ultima alteracao e retorne JSON com EXATAMENTE estas chaves:
{
  "tipo_documento": "contrato_social",
  "tipo_pessoa": "PJ",
  "razao_social": "",
  "cnpj": "",
  "data_constituicao": "",
  "capital_social": "",
  "objeto_social_resumo": "",
  "endereco_sede": "",
  "socios": [
    { "nome": "", "cpf": "", "participacao_percent": "", "administrador": false }
  ]
}
- "socios" lista todos os socios identificados, com nome completo e CPF se aparecer
- "participacao_percent" como numero (ex: "50" para 50%)
- "administrador" true se aparecer como administrador/socio-administrador
Apenas JSON, sem markdown.`,

  comprovante_endereco: `Extraia do comprovante de residencia/endereco e retorne JSON com EXATAMENTE estas chaves:
{
  "tipo_documento": "comprovante_endereco",
  "titular": "",
  "tipo_conta": "luz | agua | gas | internet | telefone | cartao | outro",
  "logradouro": "",
  "numero": "",
  "complemento": "",
  "bairro": "",
  "cidade": "",
  "uf": "",
  "cep": "",
  "data_emissao": "",
  "fornecedor": ""
}
- "logradouro" eh apenas nome da rua/avenida sem numero
- "uf" sigla 2 letras
- "fornecedor" eh quem emite (Eletropaulo, Sabesp, Vivo, etc)
Apenas JSON, sem markdown.`,

  comprovante_renda: `Extraia do comprovante de renda e retorne JSON com EXATAMENTE estas chaves:
{
  "tipo_documento": "comprovante_renda",
  "tipo_pessoa": "PF",
  "titular": "",
  "cpf": "",
  "tipo_renda": "holerite | extrato | declaracao | outro",
  "empresa_pagadora": "",
  "valor_bruto": "",
  "valor_liquido": "",
  "mes_referencia": ""
}
- Valores numericos com ponto decimal, sem R$
- "mes_referencia" formato mm/yyyy
Apenas JSON, sem markdown.`,

  relatorio_serasa: `Extraia do relatorio Serasa e retorne JSON com EXATAMENTE estas chaves:
{
  "tipo_documento": "relatorio_serasa",
  "tipo_pessoa": "PF | PJ",
  "nome_consultado": "",
  "cpf_cnpj_consultado": "",
  "data_consulta": "",
  "score": "",
  "restricoes_total": "",
  "restricoes_detalhes": [
    { "tipo": "", "credor": "", "valor": "", "data": "" }
  ],
  "tem_ccf": "",
  "ccf_ocorrencias": "",
  "protestos_total": "",
  "alertas": []
}
- "score" numero inteiro 0-1000 ou string vazia se nao aparecer
- "tem_ccf" true ou false ou string vazia
- "restricoes_total" como numero
- Datas dd/mm/yyyy
Apenas JSON.`,

  relatorio_cenprot: `Extraia do relatorio CENPROT/cartorio e retorne JSON com EXATAMENTE estas chaves:
{
  "tipo_documento": "relatorio_cenprot",
  "tipo_pessoa": "PF | PJ",
  "nome_consultado": "",
  "cpf_cnpj_consultado": "",
  "data_consulta": "",
  "existe_protesto": "",
  "quantidade_protestos": "",
  "protestos": [
    { "valor": "", "cartorio": "", "cidade": "", "uf": "", "data": "", "status": "" }
  ]
}
- "existe_protesto" true se houver pelo menos 1 protesto, false se "nada consta"
- Valores numericos sem R$
- Datas dd/mm/yyyy
Apenas JSON.`,

  texto_livre: `Este eh um texto colado de email/WhatsApp/observacao. Extraia dados estruturados e retorne JSON com EXATAMENTE estas chaves:
{
  "tipo_documento": "texto_livre",
  "tipo_pessoa": "PF | PJ | indeterminado",
  "nome_razao_social": "",
  "cpf_cnpj": "",
  "valor_pretendido": "",
  "prazo_pretendido": "",
  "vendedor": "",
  "telefone": "",
  "email": "",
  "observacoes": ""
}
- "cpf_cnpj" apenas digitos
- "valor_pretendido" numero sem R$
- "prazo_pretendido" string descritiva (ex: "30/60 dias")
Apenas JSON.`,

  desconhecido: `Identifique o tipo de documento e extraia o que conseguir. Retorne JSON com EXATAMENTE estas chaves:
{
  "tipo_documento": "rg | cnh | cpf | cartao_cnpj | contrato_social | comprovante_endereco | comprovante_renda | relatorio_serasa | relatorio_cenprot | texto_livre | desconhecido",
  "tipo_pessoa": "PF | PJ | indeterminado",
  "nome_completo": "",
  "razao_social": "",
  "cpf": "",
  "cnpj": "",
  "data_nascimento": "",
  "endereco_completo": "",
  "campos_relevantes": {}
}
- "campos_relevantes" eh um objeto com qualquer outro campo que voce identificar no documento
- Use string vazia ou objeto vazio se nao conseguir identificar.

Apenas o JSON, sem markdown.`,
};

export function promptOCRPorTipo(tipo){
  return PROMPTS[tipo] || PROMPTS.desconhecido;
}

export default PROMPTS;

export const TIPOS_OCR_VALIDOS = Object.keys(PROMPTS);

// Alias de compatibilidade (nome usado por api/ocr-documento.js)
export function getOcrPrompt(tipo){
  return promptOCRPorTipo(tipo);
}
