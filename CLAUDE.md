# MAX Supermercados — Plataforma de Dashboards e Análises

## Visão geral

Plataforma web interna para o time de Inteligência de Mercado / Comercial da MAX
Supermercados (rede de 11 lojas: 4 varejo, 7 atacado — confirmado em `bdLojas.txt`).
Composta por 5 módulos:

1. **Desempenho Comercial** ← único módulo implementado até agora
2. Entradas e Saídas
3. Compra e Venda
4. Perdas e Quebras
5. Raio X Fornecedor

Regra permanente: **nunca excluir ou reorganizar pastas/arquivos sem aviso prévio e
instrução explícita do usuário.**

## Stack técnica

- **Next.js + TypeScript** (App Router), rodando localmente e hospedado na
  **Vercel** (free tier — decidido; ver `docs/deploy.md`)
- **Tailwind CSS** com tokens de cor nomeados semanticamente (ver `docs/padroes-ux.md`)
- **Recharts** para gráficos que forem além do que HTML/CSS resolve
- Parser próprio para os arquivos-fonte (não é Excel/CSV — ver `docs/fonte-de-dados.md`)
- Proteção simples por senha (`SITE_PASSWORD`, cookie via `proxy.ts`) — sem
  autenticação complexa, já que é uso interno do time

## Deploy

Vercel + GitHub, push em `master` publica direto (sem staging). Em produção lê
o OneDrive via Microsoft Graph API; em dev lê pasta local
(`DESEMPENHO_COMERCIAL_DATA_DIR`). Cron diário processa e grava em cache Redis
— leituras normais nunca tocam o OneDrive direto. Detalhes completos (cadeia
de fallback, checklist de setup manual): **`docs/deploy.md`**.

## Fonte de dados

Arquivos **TXT delimitados por pipe**, sincronizados via OneDrive, lidos
através de uma interface `DataProvider` (`FileDataProvider` hoje,
`ApiDataProvider` no futuro quando trocar pra API do ERP).

⚠️ **Volume real**: arquivos de movimento têm centenas de milhares de linhas
(~41-45MB). Nunca mandar os registros brutos para o cliente — toda
filtragem/agregação roda no servidor (`lib/desempenho/consulta.ts`); o
navegador só recebe o resultado agregado.

Formato dos 4 arquivos (`bdDesempenhoComercialAtual`, `...Comparação`,
`bdCadastro`, `bdLojas`), encoding por arquivo, colunas confirmadas e chaves
de join: **`docs/fonte-de-dados.md`** — leia antes de mexer no parser
(`lib/data-providers/file-provider.ts`) ou em qualquer query.

## Regras de negócio

- Produtos com hierarquia mercadológica incompleta e movimentação são
  excluídos dos números consolidados e sinalizados por um badge (não um
  banner). Contagem é de SKUs únicos, não linhas.
- Comprador exibido no app **não** vem do arquivo (`Compr`/`Nome Comprador`
  não é confiável) — vem de uma tabela fixa por Departamento em
  `lib/desempenho/compradores.ts`.

Tabela completa de departamentos/compradores e detalhe da regra de
cadastro: **`docs/regras-de-negocio.md`** — leia antes de mexer em
`lib/desempenho/compradores.ts` ou na lógica de exclusão de produtos.

## Design system e padrões de UX

Cores da marca (`azul` #004C97, `vermelho` #E30000, verde #1E9E62 pra
semáforo), tipografia (Manrope + IBM Plex Sans — nunca Inter/Roboto/Arial), e
os 10 padrões de comportamento do módulo Desempenho Comercial (KPIs reativos,
drill-down de Estrutura + Lojas, ordenação, exportação Excel/PDF etc.) que
devem se repetir nos próximos módulos: **`docs/padroes-ux.md`** — leia antes
de implementar UI em qualquer módulo novo ou alterar o comportamento das
tabelas do Desempenho Comercial.

## Em aberto

- Metas/objetivos ficaram fora de escopo por enquanto (mencionado
  explicitamente pelo usuário)
