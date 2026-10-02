# MAX Supermercados — Plataforma de Dashboards e Análises

## Visão geral

Plataforma web interna para o time de Inteligência de Mercado / Comercial da MAX
Supermercados (rede de 11 lojas: 4 varejo, 7 atacado — confirmado em `bdLojas.txt`).
Composta por 5 módulos:

1. **Desempenho Comercial** ← implementado
2. **Entradas e Saídas** ← implementado (`lib/entradas-saidas/`, drill-down
   Departamento e Comprador→Departamento, painel de Lojas informativo,
   seletor de período com múltiplos meses). Lê os `bd<Mês>.txt` direto (mesmo
   `DataProvider`/parser do Desempenho Comercial) — a ideia antiga de carregar
   num banco Supabase à parte foi abandonada, nunca chegou a ir pra frente.
3. **Compra e Venda** ← implementado (mesmo motor do Entradas e Saídas, com
   filtro de Formato a mais e Meta ponderada por Departamento). Tem também um
   **PDF por Comprador** (`lib/compra-venda/priorizacao.ts` + `pdf-comprador.ts`,
   rota `app/api/compra-venda/pdf-comprador/`), pra mandar ao time Comercial
   enquanto eles não acessam a plataforma — ver "PDF por Comprador" abaixo.
4. Perdas e Quebras ← não construído ainda
5. Raio X Fornecedor ← não construído ainda

Além dos 5 módulos, a camada de **Parâmetros** (`/parametros` — Lojas,
Departamentos, motor de colunas Nativas/Calculadas/Ativas) já está construída
e é pré-requisito de infraestrutura pros módulos acima, não um módulo em si —
ver `docs/parametros.md`.

Regra permanente: **nunca excluir ou reorganizar pastas/arquivos sem aviso prévio e
instrução explícita do usuário.**

## App local vs produção

Fluxo de trabalho combinado com o usuário (2026-09-29): **desenvolver e
validar tudo localmente primeiro**, sem depender de nenhuma conta de nuvem, e
só publicar em produção (Vercel) as versões que já estiverem prontas. É o
mesmo código-fonte nos dois casos — o que muda é só quais variáveis de
ambiente estão preenchidas. Login é a única peça que só faz sentido em
produção.

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
  construído (perfil Comprador/Gestor + escopo Departamentos/Lojas) mas está
  **removido** desde 2026-09-29 (estava pausado desde 2026-09-21 — Clerk
  exige domínio próprio pra rodar em modo Production, e o domínio
  compartilhado `*.vercel.app` causava loop de login). `lib/auth/usuario-atual.ts`
  devolve um usuário sintético com acesso total (Gestor) pra todo mundo que
  passa da senha (ou, local, pra todo mundo, já que não há senha). O código
  de referência do Clerk (aba "Usuários" em Parâmetros, `lib/auth/clerk-admin.ts`)
  foi movido pra `_arquivado-conversao-local/` — reativar é decisão futura, não
  simples revert (o cadastro de Usuários que dava acesso individual não
  existe mais na UI).

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

⚠️ **Capacidade do Redis**: o plano atual (free/pequeno) não aguenta o
dataset completo do Desempenho Comercial (9+ meses, 4+ milhões de registros)
— `salvarDataset()` (`lib/desempenho/dataset-cache.ts`) dá **OOM** no meio da
escrita ao tentar guardar tudo de uma vez (confirmado em 2026-09-21, rodando
o backfill fora da Vercel pra não esbarrar no limite de 60s). Mitigação:
`MESES_HABILITADOS` (`config/data-sources.ts`) restringe quais meses o app
processa em produção — não é regra de negócio, é só o dataset caber na
memória disponível. Rodando local, sem Redis, esse limite de memória não
existe, mas processar tudo de uma vez é pesado pro V8 mesmo assim — ver
"Desempenho local" em `docs/deploy.md`. Resolver de vez (produção) exige
decisão do usuário: upgrade do plano Redis, ou mover esse cache pra um banco
de verdade (o Supabase já provisionado pro Entradas e Saídas seria mais
adequado pra esse volume do que Redis). Enquanto o limite existir,
`salvarDataset()` apaga a geração anterior *antes* de escrever a nova — o
plano atual não tem margem pra manter as duas gerações vivas ao mesmo tempo,
então prioriza pico de memória baixo em vez de garantir que a app nunca fique
sem dataset válido. Efeito colateral aceito: se `salvarDataset()` falhar no
meio da escrita (ex: OOM), a geração anterior já foi apagada e o cache fica
sem dataset válido até a próxima tentativa ter sucesso — `lerDataset()`
detecta isso (chaves ausentes) e o app cai pro fallback de ler direto do
OneDrive nesse meio-tempo (mais lento, mas nunca serve dado
incompleto/misturado). Erro aparece visível no botão "Atualizar dados".

## Fonte de dados

Arquivos **TXT delimitados por pipe**, sincronizados via OneDrive (produção)
ou lidos de uma pasta local (local), através de uma interface `DataProvider`
(`FileDataProvider`/`OneDriveDataProvider` hoje, `ApiDataProvider` no futuro
quando trocar pra API do ERP). Movimento (venda, compra, perda etc.) vem **um
arquivo por mês** (`bd<Mês>.txt`, ex: `bdSetembro.txt`) — "Atual"/"Comparação"
não são mais dois arquivos, são só dois recortes de data escolhidos pelo
usuário sobre o mesmo conjunto (`DataProvider.getDesempenho()`, união de
todos os meses disponíveis).

⚠️ **Volume real**: um mês sozinho já passa de 200MB; somando os meses
disponíveis hoje passa de 4 milhões de registros — mais do que o cache Redis
atual aguenta de uma vez, ver `MESES_HABILITADOS` em Deploy acima. Nunca
mandar os registros brutos para o cliente — toda filtragem/agregação roda no
servidor (`lib/desempenho/consulta.ts`); o navegador só recebe o resultado
agregado.

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
  `/parametros` (Redis em produção, JSON local em dev,
  `lib/desempenho/comprador-cadastro.ts`). `lib/desempenho/compradores.ts`
  (tabela fixa) só serve pra **semear** esse cadastro na 1ª leitura
  (`lib/parametros/seed.ts`), não é mais consultada em runtime normal.

Tabela completa de departamentos/compradores (usada só como semente) e
detalhe da regra de cadastro: **`docs/regras-de-negocio.md`** — leia antes de
mexer em `lib/desempenho/compradores.ts`/`comprador-cadastro.ts` ou na lógica
de exclusão de produtos.

## PDF por Comprador (Compra e Venda)

Relatório que sai da plataforma e vai pro e-mail do time Comercial (decisão de
2026-10-01). **Um arquivo por Comprador × Formato** (decisão de 2026-10-02,
revendo a de 2026-10-01 de juntar os dois formatos num arquivo só): o time
trabalha Varejo e Atacado separados, e um PDF com os dois dentro obrigava a
pessoa a achar a sua metade. Quem não atua num formato não ganha arquivo dele —
Setembro/2026 rendeu 18 arquivos, não 20.

Nome do arquivo: `(Formato)_Compra_Venda_(Comprador)_(DD-MMM) à (DD-MMM).pdf`.
O período vai do **1º dia do mês mais antigo escolhido** até o **último dia com
movimento nos dados** (`periodoDoRecorte`) — não o fim do mês de calendário, que
seria mentira enquanto o mês corrente não fechou. A barra do `DD/MMM` pedido
virou hífen porque o Windows não aceita `/` em nome de arquivo, e o acento de
"à" sobrevive via `filename*=UTF-8` no Content-Disposition (`anexo()`). Gerado **no servidor**
(`gerarPdfComprador`), nunca no cliente como o Desempenho Comercial faz: são ~10
relatórios de uma vez sobre recortes diferentes, e fazer no navegador exigiria
mandar o dado bruto pra lá.

A régua é **GAP em R$ = Compra − (Meta% × Venda)**, não o desvio em pontos
percentuais que a tela mostra: pp ordena errado (em Setembro/2026, +42,7pp em
Mercearia Saudável valiam R$ 21 mil e +21,5pp em Mercearia Básica valiam R$ 134
mil). GAP é somável, então a cascata Departamento → Seção → Categoria → Produto
fecha conta em todo nível; dentro dela a ordem é sempre de **venda**.

E o % C/V se decompõe exatamente em dois fatores, que são responsabilidades
diferentes:

    % C/V = (QC/QV) × (preço de compra ÷ preço de venda)
             ↑ decisão de compra      ↑ estrutura (custo, imposto, preço)

O segundo fator é o **% C/V de equilíbrio**: o que o item marcaria comprando
exatamente o que vende. Quando ele já passa da meta, nenhum ajuste de pedido
resolve — é preço, substituição tributária ou meta que não cabe na categoria.
89% do GAP do Varejo é quantidade, mas os 10% de estrutura estão concentrados
nos maiores itens (Café, Cerveja Amstel, Costela): mandar "cortar" neles
destruiria a credibilidade do resto. `decomporGap()` parte o GAP nas duas
causas, em R$, somando exatamente o GAP.

Quatro regras que **não** podem ser afrouxadas sem refazer a análise — cada uma
nasceu de um erro real encontrado nos arquivos de Setembro/2026, documentado no
cabeçalho da função correspondente em `lib/compra-venda/priorizacao.ts`:

- **GAP ≠ exposição**, e os dois aparecem nomeados lado a lado. GAP é a cobrança;
  exposição (soma só do que está acima da meta, no grão de SKU) é o trabalho.
  Johathan/Varejo: GAP R$ 43 mil, exposição R$ 290 mil.
- **Travas de cadastro** (`motivoAnexo`): os dois maiores "excessos" do Varejo
  eram rateio de desmembramento de carcaça — R$ 340 mil de fantasma, mais da
  metade do GAP do formato inteiro.
- **Estoque/DDE não aparecem** em Açougue, Hortifruti, Padaria Própria e Eletro
  (`DPTOS_ESTOQUE_NAO_CONFIAVEL`): 12% a 33% das linhas Produto×Loja têm estoque
  negativo, contra 2–6% no resto.
- **Loja é um nível do relatório**, não detalhe: o excesso quase nunca é do SKU.
  Leite Leitbom 1l tinha R$ 44 mil dos R$ 46 mil de GAP numa loja só.
  Transferência **só dentro do mesmo formato** (decisão de 2026-10-02): Varejo e
  Atacado têm matrizes diferentes, e mandar de um pro outro é venda entre lojas,
  não remanejamento. Garantido pela estrutura — `priorizarComprador()` recebe as
  linhas já filtradas por formato, então o nível de Loja nunca vê o outro lado.
  A doadora é escolhida **em relação à loja mais apertada**, não por um limite
  absoluto de cobertura (`DDE_MINIMO_DOADORA` + `RAZAO_DESEQUILIBRIO`): o corte
  antigo de 60 dias perdia o caso mais comum — Café Moinho Fino no Varejo tinha
  Vila Mutirão com 42 dias e Rio Verde/Independência com 9,8, e nada era
  sugerido. A regra nova levou as sugestões de 9 para 31 na rede.

Acesso restrito enquanto está em validação: `PDF_COMPRADOR_TOKEN` (ver
`.env.local.example` e o cabeçalho da rota). Sem ela configurada, a rota só
responde em ambiente local. O botão (`BotaoPdfComprador`) pergunta à rota antes
de se desenhar e some sozinho pra quem não tem acesso.

### Data de cadastro do produto

`Produto.dataCadastro` vem da coluna **`Dt Cad`** do `bdCadastro` (posição 28,
formato "DD/MM/AA") e aparece nos anexos "Revisar cadastro ou rateio" e "Comprou
e ainda não vendeu" (decisão de 2026-10-02). Ela separa dois casos que no número
do período são idênticos: **cadastro recente é lançamento entrando; cadastro
antigo com compra e sem venda é item que travou**. Exemplo real de Edvaldo /
Varejo / Setembro: dois pneus cadastrados em 10/09/26 (lançamento) ao lado de
uma TV Samsung cadastrada em 16/02/26 que comprou R$ 3.060 e não vendeu nada em
sete meses.

O campo mora em `Produto` (36 mil linhas de cadastro), **nunca** em
`MovimentoVendas` — ver o aviso em `normalizar-desempenho.ts` > CAMPOS_MOVIMENTO.
O `bdCadastro` tem outras datas que podem servir depois: `Dt Alt` (última
alteração), `Ult Comp` (última compra), `Dt Preço` e `Dt Custos`.

### Contrato visual (2026-10-02)

O documento vai por e-mail pro time, sem ninguém do lado pra explicar, então a
forma é parte do conteúdo. Três regras, todas em `pdf-comprador.ts`:

- **Toda página tem a mesma moldura**: marca MAX no topo à esquerda, nome da
  seção, contexto (comprador · formato · período) à direita, régua da cor da
  seção, e rodapé com marca, origem do dado e numeração. Desenhada de uma vez no
  fim (`moldura`), porque o autoTable quebra página sozinho — as páginas que ele
  cria herdam a seção da última marcada por `marcarPagina`.
- **Cada seção tem uma cor** (`SECOES`), que aparece na régua do topo, na tarja
  do título e no cabeçalho das tabelas: azul = visão geral e onde cortar,
  vermelho = ruptura, verde = transferência, grafite = legenda e anexos.
- **A ordem nunca muda** em nenhum formato: visão geral → onde cortar (uma
  página por departamento) → risco de ruptura → transferência → anexos.

Todas as tabelas passam por `tabela()`, que centraliza zebra, régua fina,
cabeçalho sólido e o alinhamento. ⚠️ **O alinhamento do cabeçalho é forçado em
`didParseCell`**, não em `columnStyles`: o autoTable aplica `headStyles` por cima
no cabeçalho, e o título saía à esquerda com o número à direita (confirmado no
PDF gerado). ⚠️ A soma das larguras fixas tem que caber nos 273mm úteis;
estourando, o autoTable espreme tudo e o alinhamento se perde — `tabela()` avisa
no console quando isso acontece (dois casos já pegos assim).

**Subtotal como PRIMEIRA linha** de toda tabela com mais de uma linha de dado
(decisão de 2026-10-02, mesmo padrão do Desempenho Comercial): no fim ele sumiria
abaixo da dobra nas tabelas longas. ⚠️ Percentual e DDE do subtotal são
**recalculados das parcelas somadas** (`somarMetricas` + `percentualCompraVenda`
/ `dde`), nunca a média dos filhos — média de percentual ignora o peso de cada um
e produz um número que não existe. Por isso `tabela()` recebe a linha pronta de
quem a monta, em vez de somar as células de texto.

**A tabela de produtos tem oito colunas** (decisão de 2026-10-02): Código,
Produto, Venda, Compra, % C/V, GAP R$, Comprou a mais, DDE. "Comprou a mais" é
`Qtde Compras − Qtde Vendas`, **em unidades do produto** — e por isso fica vazia
no subtotal: não se soma peça com quilo, nem pacote de 500g com o de 250g.
Chegou a existir como "GAP de pedido R$" (a parcela do GAP vinda de quantidade,
via `decomporGap`), mas o comprador precisa do número que ele controla, que é
quantas unidades pediu a mais. Eram doze — QC vs QV,
Equilíbrio, Histórico e Causa saíram para o relatório ficar objetivo na primeira
entrega ao time; continuam calculados em `priorizacao.ts` (`variacaoQuantidade`,
`percentualEquilibrio`, `Historico`, `acaoDoProduto` — esta ainda em uso, é ela
que monta a lista de transferências) e voltam quando o time estiver à vontade com
o básico. O espaço que sobrou virou fonte maior: 8pt em vez de 6,8pt.

## Venda Média Diária, Estoque e DDE

**Regra (decisão do usuário, 2026-10-02): a VMD é sempre a coluna
`Qtde Venda Média Diária` do arquivo — nunca recalculada aqui.** É o número que
o time enxerga no ERP, e manter duas contas diferentes para a mesma coisa cria
discussão em vez de resolver. Vale para o Compra e Venda e para o Entradas e
Saídas.

O que foi medido nos arquivos sobre essa coluna, e precisa ser levado em conta
por quem usar:

- **Fórmula**: `Qtde Vendas dos 3 meses fechados ÷ dias de calendário`.
  Confirmada em **58 de 58** pares Produto×Loja. A janela acompanha o
  fechamento: no arquivo de Setembro (extraído em 01/10) ela cobre Jun+Jul+Ago;
  depois que o ERP fecha Setembro, passa a cobrir Jul+Ago+Set.
- ⚠️ **O valor estampado no último dia do arquivo do mês corrente está
  parcial**: o ERP já rolou a janela pro trio seguinte mas o mês novo ainda não
  fechou e entra com zero, então sai ~25-30% menor (confirmado em 57 de 58). Por
  isso `REFS_ENTRADAS_SAIDAS_MEDIA_MOVEL` é lido da ocorrência mais **antiga** do
  mês, enquanto `Estoque Disponível` vem da mais **recente** — ver
  `reduzirPorProdutoLoja`. Sem essa separação, todo DDE saía inflado 26-51%.
- **Difere da tela "Análise Sugestão de Compra" do ERP**, que divide pelos dias
  em que havia estoque, não por dias de calendário. Na Mussarela Deale (583596)
  da Santa Rita: a tela mostra `4.120 ÷ 84 = 49,048/dia` e a coluna traz
  `3.794 ÷ 92 = 41,2/dia`. Consequência aceita: **em item que ficou zerado, o DDE
  do relatório aparece mais folgado que o da tela** (25 dias contra 20, nesse
  caso). Fechar essa diferença exigiria a contagem de dias com estoque, que o
  ERP tem internamente e não exporta — ver abaixo.

### As colunas de estoque não são série diária

Medido na amostra de Setembro/2026:

| Coluna | Comportamento |
|---|---|
| `Estoque Diário` | **1 valor único o mês inteiro em 100%** dos pares Produto×Loja (4.108 de 4.108), inclusive nos 4.010 que tiveram venda ou compra no mês. Não é estoque de abertura por data: o teste `abertura + compras − vendas = abertura do dia seguinte` bate em só 7,1% das transições, e justamente nos dias sem movimento. |
| `Estoque Disponível` | Muda, mas **só nas últimas 2 linhas do mês, em 100%** dos pares. O teste de fechamento diário bate em 11,6%. É a posição corrente na extração, carimbada em toda linha, com uma cauda de 1-2 dias reais no fim. |

Ou seja: **o arquivo não permite contar em quantos dias o produto teve estoque**,
e por isso não dá pra reproduzir o divisor da tela de Sugestão de Compra. Se um
dia isso for necessário, o caminho é pedir a coluna de dias com estoque na
extração do ERP.

Outras relações confirmadas na mesma conferência:

- `Estoque Disponível` = Estoque Físico − Venda On-Line (1.046 − 64 = 982 na tela
  do ERP). É o número certo pra cobertura: o reservado de pedido on-line não está
  na prateleira.
- Na tela do ERP, **"Saídas em Dias Normais" é a Qtde Vendas total** da janela, não
  o total menos as vendas em oferta — as "Saídas do Produto em Oferta" aparecem ao
  lado como informação e estão dentro do número maior (4.120 é exatamente o total
  de Jul+Ago+Set, com os 1.032 de oferta incluídos).

## Design system e padrões de UX

Cores da marca (`azul` #004C97, `vermelho` #E30000, verde #1E9E62 pra
semáforo), tipografia (Manrope + IBM Plex Sans — nunca Inter/Roboto/Arial), e
os 10 padrões de comportamento do módulo Desempenho Comercial (KPIs reativos,
drill-down de Estrutura + Lojas, ordenação, exportação Excel/PDF etc.) que
devem se repetir nos próximos módulos: **`docs/padroes-ux.md`** — leia antes
de implementar UI em qualquer módulo novo ou alterar o comportamento das
tabelas do Desempenho Comercial.
