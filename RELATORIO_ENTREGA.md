# Pescado Credito — Relatorio de Entrega

**Cliente:** Black Eagle
**Operador:** Elvis (unico usuario por enquanto)
**Data desta versao:** 2026-07-02
**Versao do codigo:** v4.19

---

## 1. URLs em producao

| Recurso | URL |
|---|---|
| Sistema principal | https://pescado-credito-seven.vercel.app |
| Painel admin | https://pescado-credito-seven.vercel.app/admin.html |
| API health check | https://pescado-credito-seven.vercel.app/api/health |
| Dashboard Vercel | https://vercel.com/issaoyokoi2026-3419s-projects/pescado-credito |
| Repositorio Github | https://github.com/issao2026/pescado-credito1 |
| Dashboard Supabase | https://supabase.com/dashboard/project/hebznnfqamgedwtgmluh |

---

## 2. Diretorio local (maquina do Issao)

| Item | Caminho |
|---|---|
| Raiz do projeto | `C:\Users\nissa\Documents\Claude\Projects\Pescado\` |
| Codigo deployavel | `C:\Users\nissa\Documents\Claude\Projects\Pescado\deploy-vercel\` |
| Instrucoes Claude | `C:\Users\nissa\Documents\Claude\Projects\Pescado\CLAUDE.md` |
| Este relatorio | `C:\Users\nissa\Documents\Claude\Projects\Pescado\deploy-vercel\RELATORIO_ENTREGA.md` |

---

## 3. Contas conectadas

### Github
- Email: `issao.arquitetura@gmail.com`
- Usuario: `issao2026`
- Repositorio: `pescado-credito1` (publico)
- Branch: `main`
- Deploy trigger: push automatico via webhook Vercel

### Vercel
- Organizacao: `issaoyokoi2026-3419s-projects`
- Projeto: `pescado-credito`
- Plano: **Hobby** (limite 12 serverless functions - **no limite, 12/12**)
- Git integration: repo `issao2026/pescado-credito1` na branch `main`
- Auto-deploy: on push (~1 min)

### Supabase
- Login: via GitHub OAuth (`issao2026` / `issao.arquitetura@gmail.com`)
- Organizacao: `nissao-web's Org`
- Projeto: `pescado-credito`
- ID: `hebznnfqamgedwtgmluh`
- Plano: **Free** (500 MB DB)
- RLS habilitado nas 5 tabelas
- Tabelas: `fichas`, `audit_trail`, `consumo_ia`, `config`, `entidades`

### Anthropic
- Chave `ANTHROPIC_API_KEY` nas Env Vars da Vercel
- Cap mensal: US$ 1.50 (controlavel em `/admin.html`)
- Modelo padrao: `claude-haiku-4-5-20251001` (~5x mais barato que Sonnet)
- Fallback: `claude-sonnet-4-5-20250929`
- Assistente IA da ficha: usuario escolhe modelo (Haiku/Sonnet/Opus) e pode colocar chave propria

---

## 4. Credenciais (onde estao)

**Valores reais NUNCA neste arquivo.** So aponta onde procurar.

| Segredo | Onde | Formato |
|---|---|---|
| Anthropic API Key | Vercel > Settings > Env Variables > `ANTHROPIC_API_KEY` | `sk-ant-api03-...` |
| Supabase URL | Vercel Env Vars > `SUPABASE_URL` | `https://xxxx.supabase.co` |
| Supabase Service Key | Vercel Env Vars > `SUPABASE_SERVICE_KEY` | Legacy JWT (`eyJ...`), NAO `sb_secret_*` |
| Login do sistema | localStorage do browser (cliente-side) | Email: `pescado@teste.com` / Senha: `@pescado2026` |

---

## 5. Como fazer deploy

**REGRA FIXA:** NAO usar `vercel` CLI. NAO usar PowerShell. NAO usar `git push`.

**Fluxo unico:**
1. Editar arquivo(s) em `C:\Users\nissa\Documents\Claude\Projects\Pescado\deploy-vercel\`
2. Upload no Github via Chrome MCP em `https://github.com/issao2026/pescado-credito1/upload/main`
3. Vercel deploya automatico em ~1 minuto
4. Confirmar no ar: `https://pescado-credito-seven.vercel.app/?cb=teste`

**Pre-requisito:** Issao logado no Github pelo Chrome.

---

## 6. Stack tecnica

- **Frontend:** HTML/CSS/JS puro (sem framework), Chart.js
- **Backend:** Vercel Serverless Functions (Node.js 22)
- **Banco:** Supabase (Postgres 15+)
- **IA:** Anthropic API (Haiku/Sonnet/Opus)
- **Fontes:** Poppins (display) + Inter (texto)
- **Paleta:** neutra editorial

### Estrutura de arquivos
```
deploy-vercel/
  index.html               # aplicacao principal (~5960 linhas)
  admin.html               # painel admin
  vercel.json              # rewrites, headers
  package.json
  supabase-schema.sql      # DDL do banco
  supabase-rls.sql         # policies RLS
  RELATORIO_ENTREGA.md     # este arquivo
  api/                     # 12 serverless functions
    admin/                 # config, consumo, historico-cliente
    analisar-credito.js
    chat.js                # /api/chat (assistente IA da ficha)
    consulta.js            # adapter Serasa/CENPROT
    cross-check.js         # anti-fraude
    fichas.js              # CRUD Supabase
    health.js
    ocr-documento.js       # OCR + checksum CPF/CNPJ (v4.19)
    processar-relatorio.js
    sbtest.js              # rewrite /api/entrada-rapida
  lib/                     # helpers server-side
    anthropic.js
    consumo.js
    entidades.js
    http.js
    politica.js
    supabase.js
    validacao.js           # checksums CPF/CNPJ brasileiro
    prompts/
      analise-credito.js
      entrada-rapida.js
      ocr-documento.js     # prompts por tipo de documento
      relatorio-cenprot.js
      relatorio-serasa.js
```

---

## 7. Features implementadas (v4.19)

### Fluxo operacional
- Login cliente-side (`pescado@teste.com` / `@pescado2026`)
- Dashboard com KPIs, graficos, drill-down clicavel
- Fila operacional com filtros e ordenacao (setas asc/desc)
- Ficha completa: score grande a direita + 3 botoes de decisao sempre visiveis (Aprovar / Aprovar com restricoes / Reprovar)
- Timer SLA de 10 minutos por ficha aberta
- Banco de reprovados/aprovados
- Historico por cliente
- Auditoria (audit_trail) das mudancas
- Arquivar/Desarquivar dinamico

### IA e OCR
- OCR hibrido Haiku > Sonnet fallback
- **Anti-alucinacao CPF/CNPJ via checksum brasileiro (v4.19):**
  - Prompt permissivo: IA extrai o que ver
  - Backend valida algoritmo dos digitos verificadores
  - Se checksum falha, campo volta vazio + observacao "digite manual"
  - Cobre campos `cpf`, `cnpj`, `cpf_cnpj` (unificado) e socios do contrato social
- Processamento Serasa/CENPROT (paste texto ou upload PDF)
- Cache de relatorios (30 dias)
- Assistente IA lateral da ficha:
  - Contexto automatico da ficha aberta
  - Seletor de modelo (Haiku/Sonnet/Opus)
  - Campo opcional para usuario colocar chave propria

### Documentos e entrada
- Entrada rapida com copy/paste ou upload
- Cards de documentos: Anexar / Digitar / Ver / Trocar
- CPF/CNPJ divergente na conferencia vira aviso (nao bloqueia mais)
- Ao voltar do passo 2 pro 1, dados sao repopulados de `_novaCache`
- Alerta de inconsistencia aparece no final, permite prosseguir

### Anti-fraude
- Cross-reference CPF, CNPJ, nome, endereco
- Alerta quando cliente aparece em ficha reprovada anterior

### Formatacao
- Moeda BR (`10.000,00`)
- Datas dd/mm/yyyy

### Admin
- Cap mensal Anthropic ajustavel
- Switch IA on/off
- Historico de consumo por dia

---

## 8. Testes E2E ponta a ponta (executados 2026-07-02)

| Etapa | Status |
|---|---|
| Health check | OK - Anthropic configurada |
| OCR texto livre (Petrobras CNPJ valido) | OK - extraiu CNPJ, nome, valor, prazo, vendedor |
| Criar ficha no Supabase | OK - UUID gerado |
| Listar do banco | OK - ficha persistida |
| Analise IA | OK - retorna risco e sugestao |
| Deletar ficha (limpeza) | OK - removida do banco |

**Testes de checksum:**

| Entrada | Resultado |
|---|---|
| CPF invalido 134.657.888-06 | zerado, observacao "descartado por checksum" |
| CPF valido 334.657.668-06 | passou |
| CNPJ invalido 11.222.333/0001-99 | zerado, observacao "descartado por checksum" |
| CNPJ valido 33.000.167/0001-01 (Petrobras) | passou |

---

## 9. Politica de credito (padrao)

- **> 700** — baixo risco
- **601-700** — risco moderado
- **501-600** — risco elevado
- **< 500** — alto risco (sugere reprovar ou so a vista)

**Regras:**
- Protesto ativo exige analise gerencial
- Documentacao incompleta impede aprovacao limpa
- Score < 500 sugere operacao a vista
- Casos fora da politica exigem justificativa formal
- **Decisao final e sempre humana** — a IA sugere, Elvis decide

---

## 10. Limites e custos

| Item | Limite | Nota |
|---|---|---|
| Vercel Hobby | 12 serverless functions | **NO LIMITE** (12/12) |
| Anthropic cap mensal | US$ 1.50 | Controlavel em `/admin.html`. Estourou = vira manual |
| Supabase Free | 500 MB DB, 1 GB storage | Muita folga |
| OCR por documento | ~US$ 0.02-0.10 | Depende do modelo |

---

## 11. Pendencias / proximos passos

### Alta prioridade (quando cliente contratar mais)
1. **Supabase Auth real** — trocar login localStorage por auth com sessao criptografada (~1h)
2. **Integrar API Serasa e CENPROT** — hoje operador cola texto manual. Adapter pattern ja pronto pra plug de API real
3. **Upgrade Vercel Pro** (US$ 20/mes) se precisar mais que 12 functions

### Media prioridade
4. Multi-usuario (segundo operador alem de Elvis)
5. Notificacoes WhatsApp/email quando ficha decidida
6. Refinar prompt de analise IA (as vezes vem "inconclusivo" quando payload nao esta completo)

### Baixa prioridade
7. Testes automatizados (Vitest, Playwright)
8. Reforcar deploy script contra truncamento

---

## 12. Bugs conhecidos

Nenhum critico. Sistema estavel em v4.19.

---

## 13. Suporte pos-entrega

- Codigo versionado em `github.com/issao2026/pescado-credito1`
- Este relatorio + `CLAUDE.md` sao suficientes pra qualquer dev pegar o projeto
- Memoria persistente do Claude carrega automaticamente o padrao de deploy em novas conversas

**Pra Claude atualizar:** abrir Cowork com pasta `Pescado` selecionada. Memoria interna traz o padrao de deploy sozinha.

---

## 14. Historico de versoes

| Versao | O que mudou |
|---|---|
| v4.19 | Anti-alucinacao CPF/CNPJ via checksum backend + fix `cpf_cnpj` unificado |
| v4.17 | Assistente IA modal na ficha (contexto + seletor modelo) |
| v4.14 | Fix `_novaCache` no header do passo 2 + repopulacao ao voltar |
| v4.12 | Deploy inicial da estrutura completa |
| v4.6 | Login cliente-side |
| v4.0 | Redesign editorial sem cara de IA |
| v3.x | Ficha v2, drill-down, cross-reference anti-fraude |
| v2.x | Cache Serasa/CENPROT, admin panel |
| v1.x | MVP: OCR, dashboard, fila, Supabase |
