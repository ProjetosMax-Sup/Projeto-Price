# MAX Supermercados — Plataforma de Dashboards e Análises

## Visão geral

Plataforma web interna para o time de Inteligência de Mercado / Comercial da MAX
Supermercados (rede de 11 lojas: 4 varejo, 7 atacado — confirmado em `bdLojas.txt`).
Composta por 5 módulos:

1. **Desempenho Comercial** ← único módulo implementado até agora
2. Entradas e Saídas ← só existe um loader pro Supabase (`lib/entradas-saidas/`),
   sem UI nem rota/cron chamando ele ainda — não conta como módulo pronto
3. Compra e Venda
4. Perdas e Quebras
5. Raio X Fornecedor

Além dos 5 módulos, a camada de **Parâmetros** (`/parametros` — Lojas,
Departamentos, Usuários e Acesso, motor de colunas Nativas/Calculadas/Ativas)
já está construída e é pré-requisito de infraestrutura pros módulos acima, não
um módulo em si — ver `docs/parametros.md`.

Regra permanente: **nunca excluir ou reorganizar pastas/arquivos sem aviso prévio e
instrução explícita do usuário.**

## Stack técnica

- **Next.js + TypeScript** (App Router), rodando localmente e hospedado na
  **Vercel** (free tier — decidido; ver `docs/deploy.md`)
- **Tailwind CSS** com tokens de cor nomeados semanticamente (ver `docs/padroes-ux.md`)
- **Recharts** para gráficos que forem além do que HTML/CSS resolve
- Parser próprio para os arquivos-fonte (não é Excel/CSV — ver `docs/fonte-de-dados.md`)
- Login: **senha única do site** (`SITE_PASSWORD`, `proxy.ts`), não login
  individual. O login por pessoa via **Clerk** foi construído (perfil
  Comprador/Gestor + escopo Departamentos/Lojas, cadastro de Usuários em
  `/parametros`, ver `docs/parametros.md` seção 2.4) mas está **pausado**
  desde 2026-09-21 — Clerk exige domínio próprio pra rodar em modo Production
  (registros DNS), e o domínio compartilhado `*.vercel.app` causava loop de
  login (instância de Development faz handshake cross-domain com
  `accounts.dev`, quebrado por bloqueio de cookie de terceiro no navegador).
  Enquanto isso, `lib/auth/usuario-atual.ts` devolve um usuário sintético com
  acesso total (Gestor) pra todo mundo que passa da senha — reverter esse
  arquivo pra voltar a resolver via Clerk quando tiverem domínio.

## Deploy

Vercel + GitHub, push em `master` publica direto (sem staging). Em produção lê
o OneDrive via Microsoft Graph API; em dev lê pasta local
(`DESEMPENHO_COMERCIAL_DATA_DIR`). Cron diário processa e grava em cache Redis
— leituras normais nunca tocam o OneDrive direto. Detalhes completos (cadeia
de fallback, checklist de setup manual): **`docs/deploy.md`**.

⚠️ Client do Redis (`ioredis`) é sempre **reaproveitado** entre chamadas
(client singleton em variável de módulo, nunca `disconnect()` — ver
`lib/onedrive/token-store.ts` como referência), nunca criado por request: já
causou timeout em produção quando algum módulo abria/fechava conexão nova a
cada leitura.

## Fonte de dados

Arquivos **TXT delimitados por pipe**, sincronizados via OneDrive, lidos
através de uma interface `DataProvider` (`FileDataProvider` hoje,
`ApiDataProvider` no futuro quando trocar pra API do ERP). Movimento (venda,
compra, perda etc.) vem **um arquivo por mês** (`bd<Mês>.txt`, ex:
`bdSetembro.txt`) — "Atual"/"Comparação" não são mais dois arquivos, são só
dois recortes de data escolhidos pelo usuário sobre o mesmo conjunto
(`DataProvider.getDesempenho()`, união de todos os meses disponíveis).

⚠️ **Volume real**: um mês sozinho já passa de 200MB; somando os meses
disponíveis hoje passa de 4 milhões de registros. Nunca mandar os registros
brutos para o cliente — toda filtragem/agregação roda no servidor
(`lib/desempenho/consulta.ts`); o navegador só recebe o resultado agregado.

Formato dos arquivos (`bd<Mês>.txt`, `bdCadastro`, `bdLojas`), encoding por
arquivo, colunas confirmadas e chaves de join: **`docs/fonte-de-dados.md`** —
leia antes de mexer no parser (`lib/data-providers/file-provider.ts`,
`lib/data-providers/normalizar-desempenho.ts`) ou em qualquer query. Spec
completa da reestruturação (já executada) e da camada de Parâmetros (etapas
1–5 de `docs/parametros.md` seção 7 já executadas; faltam 6–7, Entradas e
Saídas como módulo e reprocessamento manual): **`docs/parametros.md`**.

## Regras de negócio

- Produtos com hierarquia mercadológica incompleta e movimentação são
  excluídos dos números consolidados e sinalizados por um badge (não um
  banner). Contagem é de SKUs únicos, não linhas.
- Comprador exibido no app **não** vem do arquivo (`Compr`/`Nome Comprador`
  não é confiável) — vem do cadastro editável de Departamentos em
  `/parametros` (Redis, `lib/desempenho/comprador-cadastro.ts`).
  `lib/desempenho/compradores.ts` (tabela fixa) só serve pra **semear** esse
  cadastro na 1ª leitura (`lib/parametros/seed.ts`), não é mais consultada em
  runtime normal.

Tabela completa de departamentos/compradores (usada só como semente) e
detalhe da regra de cadastro: **`docs/regras-de-negocio.md`** — leia antes de
mexer em `lib/desempenho/compradores.ts`/`comprador-cadastro.ts` ou na lógica
de exclusão de produtos.

## Design system e padrões de UX

Cores da marca (`azul` #004C97, `vermelho` #E30000, verde #1E9E62 pra
semáforo), tipografia (Manrope + IBM Plex Sans — nunca Inter/Roboto/Arial), e
os 10 padrões de comportamento do módulo Desempenho Comercial (KPIs reativos,
drill-down de Estrutura + Lojas, ordenação, exportação Excel/PDF etc.) que
devem se repetir nos próximos módulos: **`docs/padroes-ux.md`** — leia antes
de implementar UI em qualquer módulo novo ou alterar o comportamento das
tabelas do Desempenho Comercial.
