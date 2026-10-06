# MAX Supermercados — Plataforma de Dashboards e Análises

## Visão geral

Plataforma web interna para o time de Inteligência de Mercado / Comercial da MAX
Supermercados (rede de 11 lojas: 4 varejo, 7 atacado). Composta por 5 módulos:

1. **Desempenho Comercial** ← implementado
2. **Entradas e Saídas** ← implementado (`lib/entradas-saidas/`, drill-down
   Departamento e Comprador→Departamento, painel de Lojas informativo,
   seletor de período com múltiplos meses). Lê os `bd<Mês>.txt` direto (mesmo
   `DataProvider`/parser do Desempenho Comercial).
3. **Compra e Venda** ← implementado (mesmo motor do Entradas e Saídas, com
   filtro de Formato a mais e Meta ponderada por Departamento). Tem dois PDFs
   que saem da plataforma pro e-mail do time Comercial enquanto eles não
   acessam a plataforma: **PDF por Comprador** (`lib/compra-venda/priorizacao.ts`
   + `pdf-comprador.ts`, rota `app/api/compra-venda/pdf-comprador/`) e **PDF por
   Loja** (`lib/compra-venda/pdf-loja.ts`, rota `app/api/compra-venda/pdf-loja/`)
   — ver as seções correspondentes abaixo.
4. Perdas e Quebras ← não construído ainda
5. Raio X Fornecedor ← não construído ainda

Além dos 5 módulos, a camada de **Parâmetros** (`/parametros` — Lojas,
Departamentos, motor de colunas Nativas/Calculadas/Ativas) já está construída
e é pré-requisito de infraestrutura pros módulos acima, não um módulo em si —
ver `docs/parametros.md`.

Regra permanente: **nunca excluir ou reorganizar pastas/arquivos sem aviso prévio e
instrução explícita do usuário.**

## App local vs produção

Fluxo combinado: **desenvolver e validar tudo localmente primeiro**, sem
depender de nenhuma conta de nuvem, e só publicar em produção (Vercel) as
versões que já estiverem prontas. É o mesmo código-fonte nos dois casos — o
que muda é só quais variáveis de ambiente estão preenchidas.

| | Local (padrão, `.env.local` sem as variáveis de nuvem) | Produção (Vercel, variáveis configuradas lá) |
|---|---|---|
| Fonte dos arquivos-fonte | Pasta local (`DESEMPENHO_COMERCIAL_DATA_DIR`) via `FileDataProvider` | OneDrive via Microsoft Graph API, com cache Redis |
| Cadastro de Parâmetros | Arquivos JSON locais (`data/parametros/`, `lib/parametros/store.ts`) | Redis |
| Login | **Nenhum** — abre direto (`SITE_PASSWORD` não configurada, `proxy.ts` não bloqueia) | Senha única do site (`SITE_PASSWORD`) |
| Atualização do dataset | Automática a cada request (cache em memória do processo, invalidado por data de modificação do arquivo) | Cron diário (Vercel) + botão "Atualizar dados", grava no Redis |

O mecanismo é **presença de env var decide o modo**, sem nenhum "if é local"
espalhado pelo código — ver `getDataProvider()` (`lib/data-providers/index.ts`)
e `usaRedis()` (`lib/parametros/store.ts`) pra o dado, e `proxy.ts` pro login.
Rodar local não exige nenhuma conta configurada; ver `docs/deploy.md` pro
passo a passo de cada modo.

⚠️ **Nunca commitar credencial de verdade** em `.env.local.example` nem em
nenhum arquivo versionado — esse arquivo é só o gabarito de quais variáveis
existem, os valores reais ficam em `.env.local` (gitignored) ou nas
Environment Variables da Vercel.

## Stack técnica

- **Next.js + TypeScript** (App Router), com dois modos de execução (local e
  Vercel, ver acima)
- **Tailwind CSS** com tokens de cor nomeados semanticamente (ver `docs/padroes-ux.md`)
- **Recharts** para gráficos que forem além do que HTML/CSS resolve
- Parser próprio para os arquivos-fonte (não é Excel/CSV — ver `docs/fonte-de-dados.md`)
- Login: **senha única do site** (`SITE_PASSWORD`, `proxy.ts`), só em
  produção — não login individual. O login por pessoa via **Clerk** foi
  construído mas está **removido** (domínio compartilhado `*.vercel.app`
  causava loop de login em modo Production). `lib/auth/usuario-atual.ts`
  devolve um usuário sintético com acesso total (Gestor) pra todo mundo que
  passa da senha (ou, local, pra todo mundo). Código de referência movido pra
  `_arquivado-conversao-local/` — reativar é decisão futura, não simples revert.

## Deploy (produção, Vercel)

Vercel + GitHub, push em `master` publica direto (sem staging). Em produção lê
o OneDrive via Microsoft Graph API; localmente lê pasta local
(`DESEMPENHO_COMERCIAL_DATA_DIR`). Cron diário processa e grava em cache Redis
— leituras normais nunca tocam o OneDrive direto. Detalhes completos (cadeia
de fallback, checklist de setup manual, e como rodar localmente): **`docs/deploy.md`**.

⚠️ Client do Redis (`ioredis`) é sempre **reaproveitado** entre chamadas
(client singleton em variável de módulo, nunca `disconnect()` — ver
`lib/onedrive/token-store.ts` como referência), nunca criado por request: já
causou timeout em produção quando algum módulo abria/fechava conexão nova a
cada leitura.

⚠️ **Capacidade do Redis**: o plano atual não aguenta o dataset completo do
Desempenho Comercial (9+ meses, 4+ milhões de registros) — `salvarDataset()`
(`lib/desempenho/dataset-cache.ts`) dá **OOM** ao tentar guardar tudo de uma
vez. Mitigação atual: `MESES_HABILITADOS` (`config/data-sources.ts`) restringe
quais meses o app processa em produção — não é regra de negócio, é só o
dataset caber na memória disponível. **Resolução definitiva já aprovada pela
diretoria** — migração pra Postgres (Supabase) + atualização diária via
GitHub Actions, domínio próprio e login individual de volta: roteiro
completo, custos e riscos em **`docs/mapa-de-investimento.md`**. Enquanto a
execução não começa, `salvarDataset()` apaga a geração
anterior *antes* de escrever a nova (prioriza pico de memória baixo sobre
garantir dataset sempre válido) — se a escrita falhar no meio, `lerDataset()`
detecta e o app cai pro fallback de ler direto do OneDrive até a próxima
tentativa ter sucesso. Erro aparece visível no botão "Atualizar dados".

## Fonte de dados

Arquivos **TXT delimitados por pipe**, sincronizados via OneDrive (produção)
ou lidos de uma pasta local (local), através de uma interface `DataProvider`
(`FileDataProvider`/`OneDriveDataProvider` hoje, `ApiDataProvider` no futuro
quando trocar pra API do ERP). Movimento (venda, compra, perda etc.) vem **um
arquivo por mês** (`bd<Mês>.txt`, ex: `bdSetembro.txt`) — "Atual"/"Comparação"
são só dois recortes de data escolhidos pelo usuário sobre o mesmo conjunto
(`DataProvider.getDesempenho()`, união de todos os meses disponíveis).

⚠️ **Volume real**: um mês sozinho já passa de 200MB; somando os meses
disponíveis hoje passa de 4 milhões de registros — mais do que o cache Redis
atual aguenta de uma vez, ver `MESES_HABILITADOS` em Deploy acima. Nunca
mandar os registros brutos para o cliente — toda filtragem/agregação roda no
servidor (`lib/desempenho/consulta.ts`); o navegador só recebe o resultado
agregado.

Formato dos arquivos (`bd<Mês>.txt`, `bdCadastro`, `bdLojas`), encoding por
arquivo, colunas confirmadas e chaves de join: **`docs/fonte-de-dados.md`** —
leia antes de mexer no parser (`lib/data-providers/file-provider.ts`,
`lib/data-providers/normalizar-desempenho.ts`) ou em qualquer query. Spec da
camada de Parâmetros: **`docs/parametros.md`**.

## Regras de negócio

- Produtos com hierarquia mercadológica incompleta e movimentação são
  excluídos dos números consolidados e sinalizados por um badge (não um
  banner). Contagem é de SKUs únicos, não linhas.
- **Insumo de produção** (Descrição começando com "Insumo", `ehInsumo` em
  `lib/compra-venda/aggregate.ts`): o **valor continua contando em tudo** —
  insumo é 92% da Compra de Padaria Própria, tirá-lo faria o departamento
  parecer não comprar nada. O que ele não pode é virar **linha de produto**
  cobrada do comprador (lista de ação ou anexos), porque compra sem vender por
  definição. Dois cortes, em `construirProdutos` e em `lancamentos`
  (`priorizacao.ts`) — ver `docs/regras-de-negocio.md`.
- **Loja 013 fora da plataforma inteira**, temporariamente —
  `LOJAS_EXCLUIDAS` em `config/data-sources.ts`, um interruptor só (esvaziar a
  lista traz de volta). O corte precisa existir nos dois parsers e nas duas
  pontas do cadastro de Lojas; o porquê de cada um está em
  `docs/regras-de-negocio.md`.
- Comprador exibido no app **não** vem do arquivo (`Compr`/`Nome Comprador`
  não é confiável) — vem do cadastro editável de Departamentos em
  `/parametros` (Redis em produção, JSON local em dev,
  `lib/desempenho/comprador-cadastro.ts`). `lib/desempenho/compradores.ts`
  (tabela fixa) só serve pra **semear** esse cadastro na 1ª leitura
  (`lib/parametros/seed.ts`), não é mais consultada em runtime normal.

Tabela completa de departamentos/compradores (usada só como semente) e
detalhe da regra de cadastro: **`docs/regras-de-negocio.md`** — leia antes de
mexer em `lib/desempenho/compradores.ts`/`comprador-cadastro.ts` ou na lógica
de exclusão de produtos.

## Motor de colunas calculadas e cards de KPI

Três mudanças no motor de Parâmetros que valem pros três módulos (Desempenho
Comercial, Entradas e Saídas, Compra e Venda), não só Compra e Venda:

- **Fórmula estilo Excel**: a aba Calculadas tem um tipo de coluna
  `"formula"` (`lib/parametros/formula.ts`) — texto com `[Nome da Coluna]` e
  os operadores `+ - * / ( )`, com glossário clicável, tooltip de operadores e
  validação que bloqueia Salvar em erro. É a forma padrão de criar calculada
  nova (soma/razão/diferença por chips continuam existindo só pra ler configs
  salvas antes da mudança). Regras completas (divisão por zero vira `0`,
  nunca erro; `[Ref]` é sempre o nome de outra calculada ou o ref bruto de uma
  nativa, nunca a tradução/rótulo): **`docs/manual-de-formulas.md`**. Compra e
  Venda tem **GAP R$** (`[Compras] - [Meta] / 100 * [Valor]`) como coluna ao
  vivo, logo após "Meta - Realizado" — mesmo conceito do GAP do PDF por
  Comprador, exposto na tela.
- **Cards de KPI por ref, não por rótulo**: `config.destaquesKpi` (lista de
  refs/ids, `ConfigRelatorio.destaquesKpi`), escolhido por um botão **▣** na
  aba Ativas ao lado da estrela de coluna principal — ver
  `colunasKpi()`/`formatarColuna()` em `lib/desempenho/colunas-configuradas.ts`,
  função única reaproveitada pelos três `KpiCards*.tsx` e por `pdf-loja.ts`.
  Sem nada marcado, cai no padrão (principal + as duas seguintes da ordem).
  Grid dos cards é `auto-fit` (preenche a tela com poucos cards, espreme com
  muitos) em vez de colunas fixas.
- **Departamento "excluir do total principal"**: campo
  `DepartamentoCadastro.excluirDoTotalPrincipal` (checkbox em /parametros →
  Departamentos), usado por código (nunca por nome) tanto pela tabela
  (`HierarquiaPanel.tsx`, "Total s/ Apropriações" vs. "Total c/ Apropriações")
  quanto pelo `kpi` agregado de Entradas e Saídas/Compra e Venda
  (`departamentosExcluidosDoTotal()` em `lib/entradas-saidas/consulta.ts`).
  "Apropriações" (departamento 099) já vem marcado. A Meta do card de KPI é
  uma média ponderada pela Venda, excluindo os departamentos marcados
  (`metaTotalPonderada()` em `lib/compra-venda/aggregate.ts`).

## PDF por Comprador (Compra e Venda)

Relatório que sai da plataforma e vai pro e-mail do time Comercial. **Um
arquivo por Comprador × Formato**: o time trabalha Varejo e Atacado
separados, e quem não atua num formato não ganha arquivo dele.

Nome do arquivo: `(Formato)_Compra_Venda_(Comprador)_(DD-MMM) à (DD-MMM).pdf`.
O período vai do **1º dia do mês mais antigo escolhido** até o **último dia com
movimento nos dados** (`periodoDoRecorte`), não o fim do mês de calendário.
Gerado **no servidor** (`gerarPdfComprador`), nunca no cliente: são vários
relatórios de uma vez sobre recortes diferentes, e fazer no navegador exigiria
mandar o dado bruto pra lá.

A régua é **GAP em R$ = Compra − (Meta% × Venda)**, não o desvio em pontos
percentuais — pp ordena errado quando categorias de tamanhos muito diferentes
se comparam. GAP é somável, então a cascata Departamento → Seção → Categoria →
Produto fecha conta em todo nível; dentro dela a ordem é sempre de **venda**.

E o % C/V se decompõe em dois fatores, responsabilidades diferentes:

    % C/V = (QC/QV) × (preço de compra ÷ preço de venda)
             ↑ decisão de compra      ↑ estrutura (custo, imposto, preço)

O segundo fator é o **% C/V de equilíbrio**: o que o item marcaria comprando
exatamente o que vende. Quando ele já passa da meta, nenhum ajuste de pedido
resolve — é preço, substituição tributária ou meta que não cabe na categoria.
`decomporGap()` parte o GAP nas duas causas, em R$, somando exatamente o GAP.

Três regras que **não** podem ser afrouxadas sem refazer a análise — cada uma
documentada com o caso real que a motivou no cabeçalho da função
correspondente em `lib/compra-venda/priorizacao.ts`:

- **Travas de cadastro** (`motivoAnexo`): itens cujo preço de compra passa de
  2× o de venda, 1ª carga sem venda ainda, quantidade desproporcional ou
  margem muito negativa não contam como trabalho de compra — ficam nos
  Anexos, não na lista de ação.
- **Estoque/DDE não aparecem** em Açougue, Hortifruti, Padaria Própria e
  Eletro (`DPTOS_ESTOQUE_NAO_CONFIAVEL`) — o estoque do sistema não descreve
  a prateleira nesses departamentos.
- **Loja é um nível do relatório**, não detalhe — o excesso quase nunca é
  só do SKU, costuma estar concentrado numa loja. Transferência **só dentro
  do mesmo formato**: Varejo e Atacado têm matrizes diferentes, mandar de um
  pro outro é venda entre lojas, não remanejamento (garantido pela estrutura:
  `priorizarComprador()` já recebe linhas filtradas por formato). A doadora é
  escolhida **em relação à loja mais apertada**, não por um limite absoluto
  de cobertura (`DDE_MINIMO_DOADORA` + `RAZAO_DESEQUILIBRIO`).

Acesso restrito enquanto está em validação: `PDF_COMPRADOR_TOKEN` (ver
`.env.local.example` e o cabeçalho da rota). Sem ela configurada, a rota só
responde em ambiente local. O botão (`BotaoPdfComprador`) pergunta à rota antes
de se desenhar e some sozinho pra quem não tem acesso.

### Data de cadastro do produto

`Produto.dataCadastro` vem da coluna **`Dt Cad`** do `bdCadastro` (posição 28,
formato "DD/MM/AA") e aparece nos anexos "Revisar cadastro ou rateio" e "Comprou
e ainda não vendeu". Ela separa dois casos que no número do período são
idênticos: **cadastro recente é lançamento entrando; cadastro antigo com
compra e sem venda é item que travou**.

O campo mora em `Produto` (cadastro), **nunca** em `MovimentoVendas` — ver o
aviso em `normalizar-desempenho.ts` > CAMPOS_MOVIMENTO. O `bdCadastro` tem
outras datas que podem servir depois: `Dt Alt`, `Ult Comp`, `Dt Preço`, `Dt Custos`.

### Contrato visual

O documento vai por e-mail pro time, sem ninguém do lado pra explicar, então a
forma é parte do conteúdo. Regras, todas em `pdf-comprador.ts`:

- **Toda página tem a mesma moldura**: marca MAX no topo à esquerda, nome da
  seção, contexto (comprador · formato · período) à direita, régua da cor da
  seção, e rodapé com marca, origem do dado e numeração. Desenhada de uma vez no
  fim (`moldura`), porque o autoTable quebra página sozinho — as páginas que ele
  cria herdam a seção da última marcada por `marcarPagina`.
- **Cada seção tem uma cor** (`SECOES`), que aparece na régua do topo, na tarja
  do título e no cabeçalho das tabelas.
- **A ordem nunca muda** em nenhum formato: visão geral → onde cortar (uma
  página por departamento) → risco de ruptura → transferência → anexos.

Todas as tabelas passam por `tabela()`, que centraliza zebra, régua fina,
cabeçalho sólido e o alinhamento. ⚠️ **O alinhamento do cabeçalho é forçado em
`didParseCell`**, não em `columnStyles`: o autoTable aplica `headStyles` por cima
no cabeçalho, e o título saía à esquerda com o número à direita. ⚠️ A soma das
larguras fixas tem que caber nos 273mm úteis; estourando, o autoTable espreme
tudo e o alinhamento se perde — `tabela()` avisa no console quando isso acontece.

**Subtotal como PRIMEIRA linha** de toda tabela com mais de uma linha de dado
(mesmo padrão do Desempenho Comercial): no fim ele sumiria abaixo da dobra nas
tabelas longas. ⚠️ Percentual e DDE do subtotal são **recalculados das
parcelas somadas**, nunca a média dos filhos — média de percentual ignora o
peso de cada um. Por isso `tabela()` recebe a linha pronta de quem a monta.

**Insumo de produção não vira linha** (ver Regras de negócio acima): o valor
fica no subtotal, a linha não existe, e a contagem da Categoria declara
`skusInsumo`/`gapInsumo` pra conta continuar fechando.

**A tabela de produtos tem oito colunas**: Código, Produto, Venda, Compra,
% C/V, GAP R$, Comprou a mais, DDE. "Comprou a mais" é
`Qtde Compras − Qtde Vendas`, **em unidades do produto** — fica vazia no
subtotal porque não se soma peça com quilo. QC vs QV, Equilíbrio e Causa
continuam calculados em `priorizacao.ts` mas fora da tabela por enquanto
(ficar objetivo na primeira entrega ao time) — voltam quando fizer sentido.

## PDF por Loja (Compra e Venda)

Substitui a planilha que o time montava à mão a partir da plataforma: Total
da rede no Formato escolhido, depois um bloco por Loja — cada um com as
mesmas colunas configuradas na tela (`colunasDoRelatorio`, nunca hardcoded) e
os dois subtotais de sempre, **com** e **sem** "Apropriações" (mesmo flag
`excluirDoTotalPrincipal` de cima). Departamentos saem **ordenados por
código** (o código em si não aparece, só o nome) e **uma tabela por página**,
sempre — nunca duas tabelas na mesma página mesmo quando a anterior é curta.

De propósito **bem mais simples** que PDF por Comprador: uma tabela por
bloco, sem seções, sem priorização (`lib/compra-venda/pdf-loja.ts`, rota
`app/api/compra-venda/pdf-loja/`). Reaproveita o motor de colunas
(`avaliarColunas` + `formatarColuna`) pra nunca divergir dos números da tela,
e o heatmap de colunas tipo "Meta - Realizado" é a mesma régua de
`CelulaMetrica.tsx`, portada pra RGB (`corHeatmap` em `pdf-loja.ts`).

⚠️ Mesma pegadinha de `pdf-comprador.ts` com o alinhamento do cabeçalho (ver
acima) — forçado em `didParseCell` pra `section === "head"` também.

Formato "Todos" não serve aqui (a meta é cadastrada por Formato, igual PDF
por Comprador) — o botão exige um Formato concreto escolhido na tela. Mesma
porta de acesso: `PDF_COMPRADOR_TOKEN` (ver seção acima).

## Venda Média Diária, Estoque e DDE

**Regra: a VMD é sempre a coluna `Qtde Venda Média Diária` do arquivo — nunca
recalculada aqui.** É o número que o time enxerga no ERP, e manter duas
contas diferentes para a mesma coisa cria discussão em vez de resolver. Vale
para o Compra e Venda e para o Entradas e Saídas.

O que foi medido nos arquivos sobre essa coluna, e precisa ser levado em conta
por quem usar:

- **Fórmula**: `Qtde Vendas dos 3 meses fechados ÷ dias de calendário`. A
  janela acompanha o fechamento (ex.: arquivo extraído em 01/10 cobre
  Jun+Jul+Ago até o ERP fechar Setembro).
- ⚠️ **O valor estampado no último dia do arquivo do mês corrente está
  parcial**: o ERP já rolou a janela pro trio seguinte mas o mês novo ainda não
  fechou e entra com zero, saindo artificialmente menor. Por isso
  `REFS_ENTRADAS_SAIDAS_MEDIA_MOVEL` é lido da ocorrência mais **antiga** do
  mês, enquanto `Estoque Disponível` vem da mais **recente** — ver
  `reduzirPorProdutoLoja`. Sem essa separação, o DDE sai inflado.
- **Difere da tela "Análise Sugestão de Compra" do ERP**, que divide pelos dias
  em que havia estoque, não por dias de calendário. Consequência aceita: **em
  item que ficou zerado, o DDE do relatório aparece mais folgado que o da
  tela**. Fechar essa diferença exigiria a contagem de dias com estoque, que o
  ERP tem internamente e não exporta.

### As colunas de estoque não são série diária

| Coluna | Comportamento |
|---|---|
| `Estoque Diário` | **1 valor único o mês inteiro**, em praticamente todos os pares Produto×Loja — não é estoque de abertura por data. |
| `Estoque Disponível` | Muda só nas últimas linhas do mês — é a posição corrente na extração, carimbada em toda linha, com uma cauda de 1-2 dias reais no fim. |

Ou seja: **o arquivo não permite contar em quantos dias o produto teve
estoque**, e por isso não dá pra reproduzir o divisor da tela de Sugestão de
Compra. Se um dia isso for necessário, o caminho é pedir a coluna de dias com
estoque na extração do ERP.

Outras relações confirmadas:

- `Estoque Disponível` = Estoque Físico − Venda On-Line. É o número certo pra
  cobertura: o reservado de pedido on-line não está na prateleira.
- Na tela do ERP, **"Saídas em Dias Normais" é a Qtde Vendas total** da janela
  (as "Saídas do Produto em Oferta" aparecem ao lado como informação, já
  incluídas no total maior, não subtraídas dele).

## Design system e padrões de UX

Cores da marca (`azul` #004C97, `vermelho` #E30000, verde #1E9E62 pra
semáforo), tipografia (Manrope + IBM Plex Sans — nunca Inter/Roboto/Arial), e
os 10 padrões de comportamento do módulo Desempenho Comercial (KPIs reativos,
drill-down de Estrutura + Lojas, ordenação, exportação Excel/PDF etc.) que
devem se repetir nos próximos módulos: **`docs/padroes-ux.md`** — leia antes
de implementar UI em qualquer módulo novo ou alterar o comportamento das
tabelas do Desempenho Comercial.
