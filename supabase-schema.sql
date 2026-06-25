-- ============================================================
-- Pescado Crédito — Schema Supabase
-- Execute no SQL Editor do Supabase (app.supabase.com)
-- ============================================================

-- Extensão para UUID (já vem ativa no Supabase, mas por segurança):
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────────
-- TABELA: fichas
-- Armazena cada análise de crédito
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fichas (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  -- Identificação do cliente
  nome        text,
  cpf_cnpj    text,
  tipo        text,         -- 'PF' | 'PJ'
  vendedor    text,
  operador    text,

  -- Valores
  valor       numeric,
  prazo       text,

  -- Status operacional
  status      text NOT NULL DEFAULT 'Recebido',
  risco       text,         -- 'Baixo' | 'Moderado' | 'Elevado' | 'Alto' | 'Pendente'
  score       integer,

  -- Consultas
  serasa      text,         -- 'Consultado' | 'Não consultado'
  cenprot     text,

  -- Decisão
  rec_ia      text,         -- recomendação da IA
  decisao_final text,       -- veredito humano final
  justificativa text,

  -- Data da análise (YYYY-MM-DD)
  dt          text,

  -- Blob completo com todos os dados do frontend
  -- (ocrData, docs, alerts, analise_ia, etc.)
  dados       jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- Índices para queries comuns
CREATE INDEX IF NOT EXISTS fichas_created_at_idx ON fichas (created_at DESC);
CREATE INDEX IF NOT EXISTS fichas_cpf_cnpj_idx   ON fichas (cpf_cnpj);
CREATE INDEX IF NOT EXISTS fichas_status_idx      ON fichas (status);

-- Trigger para manter updated_at atualizado
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER fichas_updated_at
  BEFORE UPDATE ON fichas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────
-- TABELA: audit_trail
-- Trilha de auditoria por operação/campo
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_trail (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at   timestamptz NOT NULL DEFAULT now(),

  ficha_id     uuid        REFERENCES fichas(id) ON DELETE CASCADE,
  acao         text        NOT NULL,  -- 'criacao' | 'veredito' | 'exclusao' | 'campo_confirmado' | ...
  campo        text,
  valor_anterior text,
  valor_novo   text,
  origem       text,                  -- 'ia' | 'humano'
  operador     text,
  tempo_etapa_ms integer
);

CREATE INDEX IF NOT EXISTS audit_trail_ficha_id_idx ON audit_trail (ficha_id);

-- ─────────────────────────────────────────────
-- RLS (Row Level Security)
-- Desabilitado pois o backend usa service_key
-- (nunca expor service_key no frontend)
-- ─────────────────────────────────────────────
ALTER TABLE fichas      DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_trail DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- EXTENSAO v3: consumo IA + config painel admin
-- Executar este bloco no SQL editor APOS o schema base
-- ============================================================

-- ─────────────────────────────────────────────
-- TABELA: consumo_ia
-- Tracker mensal de gastos com Anthropic API
-- Cap automatico no painel admin
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS consumo_ia (
  id              bigserial   PRIMARY KEY,
  mes_ano         text        NOT NULL UNIQUE,  -- "2026-06"
  total_usd       numeric(10,4) DEFAULT 0,
  total_chamadas  integer     DEFAULT 0,
  total_haiku     integer     DEFAULT 0,
  total_sonnet    integer     DEFAULT 0,
  total_tokens_in bigint      DEFAULT 0,
  total_tokens_out bigint     DEFAULT 0,
  atualizado_em   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS consumo_ia_mes_idx ON consumo_ia (mes_ano);

-- ─────────────────────────────────────────────
-- TABELA: config
-- Configuracoes globais editaveis via painel admin
-- (modelo padrao, cap mensal, thresholds)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS config (
  chave         text        PRIMARY KEY,
  valor         jsonb       NOT NULL,
  descricao     text,
  atualizado_em timestamptz DEFAULT now()
);

-- Seed inicial (idempotente)
INSERT INTO config (chave, valor, descricao) VALUES
  ('modelo_padrao',       '"claude-haiku-4-5-20251001"'::jsonb,    'Modelo Anthropic usado por padrao em OCR'),
  ('modelo_fallback',     '"claude-sonnet-4-5-20250929"'::jsonb,    'Modelo usado quando padrao falhar (confidence baixa, CPF/CNPJ invalido)'),
  ('cap_mensal_usd',      '1.5'::jsonb,                              'Limite mensal de gasto com IA em USD. Quando atingir, sistema corta IA.'),
  ('fallback_threshold',  '0.5'::jsonb,                              'Confidence minima para aceitar OCR sem fallback'),
  ('cache_relatorios_dias','30'::jsonb,                              'Dias para reusar relatorio Serasa/CENPROT do mesmo CPF/CNPJ'),
  ('ia_ativa',            'true'::jsonb,                             'Switch geral. False = sistema funciona so manual.')
ON CONFLICT (chave) DO NOTHING;

ALTER TABLE consumo_ia DISABLE ROW LEVEL SECURITY;
ALTER TABLE config     DISABLE ROW LEVEL SECURITY;

