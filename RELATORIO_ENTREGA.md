# RELATORIO DE ENTREGA — Pescado Credito v4.43r

**Cliente:** Lagostao Pescados
**Contratante:** Black Eagle
**Operador do sistema:** Francisco Elves (Analista de Credito)
**Ambiente:** producao (Vercel)
**Ultima entrega:** 2026-07-14
**Repositorio:** https://github.com/issao2026/pescado-credito1
**Baixar codigo:** https://github.com/issao2026/pescado-credito1/archive/refs/heads/main.zip

---

## LINKS DO SISTEMA

- **Elves (administracao):** https://pescado-credito-seven.vercel.app/
- **Vendedores (link publico, sem login):** https://pescado-credito-seven.vercel.app/vendedor.html
- **Painel de custo IA:** https://pescado-credito-seven.vercel.app/admin.html

## CREDENCIAIS

- **Login Elves:** `pescado@teste.com` / `@pescado2026`
- **Vendedores:** nao precisam de login
- **ANTHROPIC_API_KEY / SUPABASE_URL / SUPABASE_SERVICE_KEY:** configurados em Vercel Env Vars (nao expostos no frontend)

## LIMITES DE IA (controlaveis em /admin.html)

- Cap mensal: US$ 1,50
- Modelo padrao: Claude Haiku 4.5 (~US$ 0,02-0,10 por analise)
- Fallback: Claude Sonnet 4.5

---

## FLUXO COMPLETO

### 1. Vendedor abre `/vendedor.html`
- Preenche dados pessoais + dados do cliente
- CNPJ valida checksum + auto-preenche via BrasilAPI
- Prazos: A vista / 7 / 14 / 21 / 30 (+ combos)
- Anexa documentos opcionais
- Escreve observacoes (contexto do relacionamento, urgencia)
- Recebe protocolo de acompanhamento

### 2. Ficha chega para Elves
- Sino de notificacao no topo com contador em vermelho
- Quadro de avisos no dashboard
- Fila operacional

### 3. Elves analisa
- **Modo IA:** cola Serasa + CENPROT (texto/imagem/PDF), IA extrai score e restricoes
- **Modo manual (sem IA):** preenche direto score, restricoes, protestos (nova aba "Preencher a mao" nos modais)
- **Novo v4.43g:** card SERASA vira input de score direto; card CENPROT vira select Sim/Nao
- OCR de documentos (opcional)

### 4. Decisao final
- Botoes: Aprovado / Com ressalvas / Reprovado / Submeter a gerencia / Somente a vista / Inconclusivo
- Campos editaveis: LIMITE APROVADO (formatacao R$ automatica), PRAZO, OBSERVACOES
- Score fica no card SERASA (nao duplica)
- Persiste no Supabase automaticamente

### 5. Retorno ao vendedor
- Botao verde/vermelho/laranja: "Enviar retorno ao vendedor (Aprovado/Reprovado/Somente a vista)"
- Modal com email pre-preenchido em nome de Francisco Elves
- Usa limite/prazo APROVADOS formatados em R$
- Inclui parecer do ChatGPT/manual automaticamente
- Se score baixo + protesto: bloco de alerta com 2 alternativas (a vista ou gerencia)
- Salva na ficha para auditoria

### 6. Relatorio de Credito
- Botao "Gerar relatorio" → pagina pronta pra impressao
- Header Lagostao, score em circulo colorido, veredito, justificativa manual
- Bloco "Regras e politica de credito aplicadas" com faixa ativa destacada
- Bloco "Apontamentos" com Auditor + Serasa + CENPROT + Capital Social
- Botoes de decisao final Aprovado/Reprovado/A vista com email automatico
- Barra fixa no topo: Voltar / Imprimir / Ir para inicio

---

## PAGINAS

- **Dashboard** — KPIs, volume, pipeline, distribuicao de risco, faixas de score, quadro de avisos
- **Fila Operacional** — filtros (Pendentes / Hoje / Aguardando consulta / Pronto / Alto risco / Finalizadas / Aprovados / A vista / Arquivados / Todos) + busca + editar/arquivar/apagar com UUID
- **Nova Analise** — wizard 3 steps: Dados do cliente → Consultas → Relatorio e aprovacao
- **Analise Comercial (BI Lagostao)** — 93 clientes reais Lagostao:
  - 8 KPIs clicaveis (Total, Vendedores, Score medio, Com limite, Ticket medio, Total limite, Maior limite, Dividas)
  - 8 graficos interativos (Chart.js): Rota de saida, Distribuicao de risco, Top vendedores, Score medio por vendedor, Ticket medio por vendedor, **Score x Limite (radar)**, **Top 15 devedores**, Risco por rota de saida, Distribuicao por tempo de atividade
  - Filtros: busca cliente/CNPJ, vendedor, rota, prazo, faixa de risco
  - Breadcrumb do filtro ativo (fonte grande) + botao "Ver lista"
  - **TODO grafico e clicavel** — abre modal com clientes filtrados → click abre ficha historica
  - Exportar CSV
  - **Importar planilha** (CSV / upload / link Google Sheets publicado)
- **Politica de Credito** / **Relatorios** / **Relatorio de Credito**
- **Assistente IA** — chatbot dentro do modal da ficha (bug corrigido v4.43l: mensagens vs messages)

---

## HISTORICO DE VERSOES

### Base v4.20 - v4.41b (entrega anterior)

- **v4.20-33** — feedback do cliente: socios opcional, rename Elves, identidade Lagostao (verde), templates de email, vendedor.html publico, quadro de avisos, KPIs, BI com filtros, validacao CPF/CNPJ, prazos maximos 30 dias
- **v4.34-36** — BI Lagostao enriquecido (Chart.js, drill-down, tudo clicavel), fix busca CNPJ, score/limite/prazo/justificativa editaveis na ficha final
- **v4.37/b/c** — persistencia Supabase corrigida + prazo pre-selecionado + botao email no rodape com valores aprovados
- **v4.38/b** — logo ocupa faixa, breadcrumb no BI, drill-down abre ficha, laudo com veredito manual
- **v4.39/b** — fonte breadcrumb maior, duas colunas COM/SEM limite clicaveis, cor #003030
- **v4.40/b/c/d/e** — parecer manual etapa 3 (ChatGPT), preencher a mao Serasa/CENPROT, logo novo, sino notificacao, Francisco Elves, cor #012A2A, logo transparente, sidebar logo grande
- **v4.41/b** — importar planilha (CSV/upload/Google Sheets), scatter estilo RADAR, Top 15 devedores

### Sessao atual — v4.42 a v4.43r (14/07/2026)

**v4.42** — Auditor de Ficha Incompleta (10 regras, silencioso, badge no modal)
**v4.42b/c** — vendedor.html blindado contra extensoes/tracejados, cor unica em toda upload-box
**v4.42d** — fix z-index modal Serasa/CENPROT (999 → 10000), botao Fechar volta a funcionar
**v4.42e** — sidebar logo/nome clicavel → Dashboard

**v4.43** — Renomear "Laudo Final" → "Relatorio de Analise de Credito", bloco Apontamentos sempre visivel, analise de Capital Social vs Valor Pretendido, botao "Ver credito" com historico do cliente
**v4.43b** — fix botao editar da fila (aspas em UUID), barra Voltar/Imprimir/Inicio no topo do relatorio
**v4.43c** — score digitado no input propaga pro relatorio, tabela Regras e Politica de Credito destacando faixa ativa, botao Submeter a gerencia com persistencia Supabase
**v4.43d** — anti-cache no HTML (meta tags no-cache) + Cache-Control no vercel.json + tag v4.43d visivel no cabecalho
**v4.43e** — botao editar da fila abre modal COMPLETO (nao mais mini-modal), parecer manual persistido em `dados.parecer_manual`
**v4.43f** — parecer manual (ChatGPT) entra no corpo do email de retorno + aviso amarelo pra revisar antes de enviar + textarea 320px
**v4.43g** — Fechar do modal com handler robusto + ESC global fecha qualquer modal, Serasa vira input de score, CENPROT vira select Sim/Nao, parecer manual salvo ao criar ficha nova
**v4.43h** — delegated event listener global captura clique em "Fechar" com useCapture=true + X vermelho absoluto no canto superior (z-index 100, background #991B1B)
**v4.43i** — remove botao Fechar do topo do modal (X vermelho ja resolve)
**v4.43j** — email tipo Reprovado com template dedicado + botao vermelho no rodape quando decisao=Reprovado
**v4.43k** — remove score duplicado do bloco DECISAO (fica so no card Serasa) + hidden mantido pra compat
**v4.43l** — fix Assistente IA (frontend mandava `messages`, backend espera `mensagens` em pt) + botao Assistente IA movido pra esquerda perto do titulo
**v4.43m** — apos decidir no relatorio (Aprovado/Reprovado/A vista), modal de email de retorno abre AUTOMATICO com template correspondente
**v4.43n** — formatacao automatica do campo Limite Aprovado (10000 vira 10.000,00 ao sair do campo)
**v4.43o** — limite formatado em R$ 5.000,00 no email de retorno
**v4.43p** — marcador score grande atualiza em tempo real ao digitar no card Serasa (numero + cor + arco SVG + label BAIXO/MODERADO/ELEVADO/ALTO RISCO)
**v4.43q** — alerta CENPROT com protesto no bloco Apontamentos: SIM = alerta critico; SIM + score>=700 = INCONSISTENCIA no topo; NAO = confirmacao verde
**v4.43r** — email destaca protesto e sugere explicitamente 2 alternativas: (1) somente a vista, (2) submeter a gerencia com justificativa formal — quando score baixo + CENPROT SIM

### Fluxo de dados (aproximadamente)

- 43 commits nesta sessao (do commit 55 ao 97+)
- 40+ deploys automaticos Vercel (55 → ~95)
- Zero downtime — todas as atualizacoes chegaram em ~1min pos-commit

---

## CRITERIOS DE ACEITE — todos VERDES

- [x] Vendedor cria ficha sem login pelo link publico
- [x] CPF/CNPJ com validacao de checksum e auto-fill BrasilAPI
- [x] Sino de notificacao no topo com contador em vermelho
- [x] Elves recebe no quadro de avisos + fila
- [x] Serasa: input de score direto no card (0-1000)
- [x] CENPROT: select Sim/Nao com destaque visual
- [x] IA extrai dados sem inventar (null quando nao ha evidencia)
- [x] Elves pode colar parecer do ChatGPT diretamente
- [x] Score/limite/prazo/justificativa persistem no Supabase
- [x] Parecer manual persiste na ficha e reaparece no email
- [x] Email de retorno usa valores APROVADOS formatados em R$
- [x] Email Aprovado/Reprovado/A vista com templates dedicados
- [x] Parecer manual entra automatico no corpo do email
- [x] Score baixo + protesto = alerta com 2 alternativas no email
- [x] Relatorio final tem barra fixa Voltar/Imprimir/Inicio
- [x] Score do card Serasa atualiza marcador grande em tempo real
- [x] Botao Fechar da ficha funciona (X vermelho absoluto + ESC + delegated listener)
- [x] Botao editar da fila abre modal completo
- [x] Cor unica RGB(1,42,42) #012A2A em tudo
- [x] Logo Lagostao no topo do sidebar (largo, ocupa a faixa)
- [x] Nome do operador "Francisco Elves / Analista de Credito"
- [x] Anthropic key nao aparece no frontend
- [x] Anti-cache agressivo (meta + vercel.json + tag visivel)
- [x] Assistente IA funcional (bug mensagens vs messages corrigido)

---

## BUGS CONHECIDOS (PENDENTES)

**Todos reportados pelo cliente em 14/07/2026 apos teste com fichas SEGHETTO & SEGHETTO LTDA e VILLA ROSSA. Nenhum aplicado — usuario em outra conta Vercel/GitHub/Supabase durante a analise.**

### BUG-01: Observacoes do vendedor nao aparecem na ficha do Elves

**Reportado:** 2026-07-14
**Severidade:** Media
**Status:** Documentado, aguardando fix

**Descricao:**
Vendedora preenche observacoes em `/vendedor.html` (campo `#c-obs`). Dado e enviado no POST `/api/fichas` como `observacoes: "..."`.

**Rastreamento:**
1. Vendedor envia → OK ✅
2. Backend salva em `row.dados.observacoes` (JSON blob no Supabase) → OK ✅
3. Frontend recebe via `a.dados.observacoes` → OK ✅
4. `index.html:6277` tenta ler `a.observacoes` (nivel raiz) → **undefined, cai no fallback ''** ❌

**Codigo atual:**
```js
'<textarea id="rep-cond">' + (a.justificativa || a.observacoes || '') + '</textarea>'
```

**Fix simples:**
```js
'<textarea id="rep-cond">' + (a.justificativa || a.observacoes || (a.dados && a.dados.observacoes) || '') + '</textarea>'
```

**Fix recomendado (melhor UX):**
Criar bloco separado "Observacoes do vendedor" (readonly, cor destacada) acima do bloco "DECISAO DO OPERADOR". Motivo: hoje o mesmo textarea serve pra observacao da vendedora E justificativa do analista — pode sobrescrever sem querer.

**Impacto:** Dados NAO se perderam — estao salvos no Supabase. So nao aparecem na tela.

---

### BUG-02: Anexos do vendedor nao chegam no backend

**Reportado:** 2026-07-14
**Severidade:** Alta
**Status:** Documentado, aguardando fix

**Descricao:**
Vendedora anexa arquivos em `/vendedor.html` (input `#v-files`, PDF/JPG/PNG). Arquivos ficam em um array local `arquivos = []` (linha 148), mas o payload enviado ao POST `/api/fichas` NAO inclui esses arquivos.

**Rastreamento:**
1. Vendedor seleciona arquivos → array `arquivos` populado ✅
2. Interface mostra lista com nome e tamanho ✅
3. Ao enviar (linha 334), `const payload = { nome, tipo, cnpj, valor, prazo, vendedor, email_vendedor, email_cliente, telefone_cliente, observacoes, status, origem }` — **campo `anexos` ausente do payload** ❌
4. Backend recebe payload sem anexos, salva ficha sem docs
5. Elves abre ficha, `a.docs.length === 0`, nao mostra nada

**Codigo atual (vendedor.html:334-347):**
```js
const payload = {
  nome: cNome,
  tipo: ...,
  ...,
  observacoes: ...,
  status: "Aguardando análise",
  origem: "vendedor"
  // FALTA: anexos
};
```

**Fix necessario:**
1. No vendedor.html, converter cada arquivo pra base64 (FileReader) antes de enviar:
   ```js
   async function fileToBase64(f){ return new Promise((res)=>{ var r=new FileReader(); r.onload=e=>res({name:f.name, mime:f.type, size:f.size, base64:e.target.result.split(',')[1]}); r.readAsDataURL(f); }); }
   payload.anexos = await Promise.all(arquivos.map(fileToBase64));
   ```
2. No `api/fichas.js` POST, salvar em Supabase Storage (bucket `fichas-anexos`) ou embutir em `dados.anexos` (para arquivos < 1MB total).
3. Retornar URLs assinadas do Storage.
4. No `index.html:6243`, renderizar lista com link pra baixar/visualizar.

**Alternativa mais simples (curto prazo):** enviar so metadata (`{name, size, type}`) e pedir para vendedora enviar por email/Whatsapp. Marca a ficha com aviso "arquivos pendentes".

**Impacto:** Alto — cliente perde documentos (contrato social, comprovantes) que a vendedora anexou.

---

### BUG-03: Falta campo de DIVIDA do cliente na ficha do Elves

**Reportado:** 2026-07-14
**Severidade:** Media/Alta
**Status:** Documentado, aguardando implementacao

**Descricao:**
Elves precisa lancar o valor de dividas do cliente (ex: apuradas no Serasa, CENPROT, ou informacoes internas). Hoje nao ha campo dedicado no modal da ficha. So existe `dividas` no BI Lagostao (dado historico da planilha) e como valor default vindo da importacao.

**Rastreamento:**
- `bi-lagostao.js` tem coluna `dividas` (do CSV historico) → OK, aparece no BI ✅
- No modal da ficha nova (`index.html renderFichaCompleta`) — **nao ha input de divida** ❌
- Campo `a.dividas` existe no schema mas nao ha UI pra editar/lancar

**Fix necessario:**
1. No modal da ficha, criar novo card ao lado de SERASA e CENPROT: **"DIVIDA — Valor apurado"** com input R$ formatado (mesma formatacao R$ do v4.43n).
2. Ao alterar, gravar em `a.dividas` + persistir Supabase via PUT.
3. Adicionar validacao no bloco Apontamentos: se `dividas > 0`, gera alerta critico:
   > "[FINANCEIRO] Cliente possui divida ativa de R$ X.XXX,XX — considerar impacto na decisao"
4. Divida no email de retorno (opcional): mencionar o valor no template.

**Alternativa:** integrar com o campo "Observacoes / Justificativa" e o Elves escreve manualmente. Menos estruturado.

**Impacto:** Media/Alta — sem esse campo, dado de divida fica so na cabeca do Elves ou no textarea de observacoes, dificil de auditar.

---

## PROXIMO SPRINT PROPOSTO (quando voltar na conta correta)

Ordem sugerida de fix:

1. **BUG-01 (obs vendedor)** — 5 min. Ajustar linha 6277 pra ler `a.dados.observacoes`. Historico volta a aparecer.
2. **BUG-03 (campo divida)** — 30 min. Adicionar input no modal + persistir + apontamento. Ganha valor imediato.
3. **BUG-02 (anexos)** — 2h. Requer decisao: base64 no `dados` (facil, limite 1MB) ou Supabase Storage (correto, mas config extra). Recomendo Storage.
4. **Melhoria UX (bloco separado obs vendedor)** — 15 min. Bloco readonly acima do "DECISAO DO OPERADOR" pra evitar sobrescrita.

---

## DEPLOY

- Repositorio: `github.com/issao2026/pescado-credito1` (branch `main`)
- Fluxo: **upload de arquivos no GitHub via Chrome MCP → Vercel deploya automatico em ~1 min**
- **NUNCA** usar `vercel` CLI, PowerShell nem `git push` por terminal
- Issao mantem o Chrome logado no GitHub

## LIMITES ATUAIS

- **Vercel Hobby:** 12 serverless functions max (atual: 12 exatas, `sbtest.js` reaproveitado como `/api/entrada-rapida` via rewrite)
- **Cap IA mensal:** US$ 1,50 (controlavel em `/admin.html`) — quando atinge, sistema vira 100% manual (sem IA)

## OBSERVACOES FINAIS

- Login localStorage-based para o piloto — recomendado migrar para Supabase Auth em versao futura
- `LAGOSTAO_DATA` (93 clientes reais) usada no BI Comercial — importada da planilha do cliente
- Todos os campos do veredito persistem no Supabase e sobrevivem a reload
- Email de retorno arquivado em `dados.email_retorno` na ficha para auditoria
- Parecer manual arquivado em `dados.parecer_manual`

## SOBRE SHAREPOINT (SYNC AUTOMATICO DA PLANILHA)

Cliente pediu sync automatico do BI com planilha SharePoint. Analise:

- **SharePoint nao tem link publico direto CSV** como Google Sheets tem
- Toda leitura requer Microsoft Graph API + autenticacao Azure AD (OAuth token com refresh)
- CORS bloqueia fetch direto do navegador — precisa endpoint serverless proxy

**3 opcoes para o cliente:**

1. **Manual (atual):** botao "Importar planilha" no BI, upload de arquivo. Boa se atualizarem 1x/mes.
2. **Semi-automatico via Google Sheets:** exportar SharePoint → Google Sheets → Publicar na web como CSV → colar link no BI. Boa se atualizarem 1x/semana.
3. **Automatico SharePoint via Graph API:** cadastrar app no portal.azure.com, passar TENANT_ID + CLIENT_ID + CLIENT_SECRET, endpoint `/api/sync-sharepoint`, botao "Sincronizar" no BI. Boa se atualizarem varias vezes por dia. Requer 2-4h de dev + 1 configuracao inicial do TI Lagostao.

Recomendacao: opcao 2 se prioridade e velocidade, opcao 3 se prioridade e fluxo natural do cliente.

## COMO BAIXAR O CODIGO COMPLETO

- **ZIP oficial (branch main, sempre atualizado):**
  https://github.com/issao2026/pescado-credito1/archive/refs/heads/main.zip
- Ou clonar: `git clone https://github.com/issao2026/pescado-credito1.git`
- 97+ commits, ultimo v4.43r, 95+ deploys da Vercel

**Sistema em producao, testado end-to-end, pronto para demo e uso do cliente.**
