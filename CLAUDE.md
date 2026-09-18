# MAX Supermercados — Plataforma de Dashboards e Análises

## Visão geral

Plataforma web interna para o time de Inteligência de Mercado / Comercial da MAX
Supermercados (rede de 11 lojas: 4 varejo, 7 atacado — confirmado em `bdLojas.txt`).
Composta por 5 módulos:

1. **Desempenho Comercial** ← primeiro módulo, escopo deste documento
2. Entradas e Saídas
3. Compra e Venda
4. Perdas e Quebras
5. Raio X Fornecedor

Regra permanente: **nunca excluir ou reorganizar pastas/arquivos sem aviso prévio e
instrução explícita do usuário.**

## Stack técnica

- **Next.js + TypeScript** (App Router), rodando localmente e hospedado na
  **Vercel** (free tier — decidido; ver seção "Deploy" abaixo)
- **Tailwind CSS** com tokens de cor nomeados semanticamente (ver Design System)
- **Recharts** para gráficos que forem além do que HTML/CSS resolve
- Parser próprio para os arquivos-fonte (não é Excel/CSV — ver Fonte de Dados)
- Proteção simples por senha (`SITE_PASSWORD`, cookie via `proxy.ts`) — sem
  autenticação complexa, já que é uso interno do time

## Deploy

Hospedado na **Vercel**, repo no GitHub — push na branch `master` publica
direto em produção (sem branch de staging). Em produção o app lê os arquivos
direto do **OneDrive via Microsoft Graph API** (não da pasta local — um
servidor na nuvem não enxerga o disco do usuário); em dev local continua
lendo da pasta local (`DESEMPENHO_COMERCIAL_DATA_DIR`).

Requisições normais (navegar, filtrar, clicar) **nunca tocam o OneDrive
direto** — lento demais numa função serverless. Um **cron da Vercel roda
1x/dia às 09:00** (America/Sao_Paulo), busca os 4 arquivos, processa e grava
num **cache Redis**; o botão "Atualizar dados" no header roda a mesma rotina
sob demanda. Toda leitura normal só lê esse cache. Ordem de fallback (sem
Redis configurado, ou fora do ar): OneDrive direto → pasta local → dataset de
exemplo (arquitetura `DataProvider`, ver "Fonte de dados" abaixo).

Checklist completo dos passos manuais (registro do app na Microsoft, projeto
na Vercel, Redis, variáveis de ambiente, conexão inicial com o OneDrive) está
no README.md.

## Fonte de dados (fase atual: arquivos)

Os dados vêm de arquivos **TXT delimitados por pipe (`|`)**, sincronizados via pasta
do OneDrive (caminho difere entre computador pessoal e notebook corporativo — **não
hardcodear o caminho**, usar variável de ambiente `DESEMPENHO_COMERCIAL_DATA_DIR`,
configurada em `.env.local`).

Arquitetura pensada para trocar depois para API do ERP sem reescrever os módulos:
toda leitura de dado passa por uma interface `DataProvider`, com duas implementações
possíveis por trás dela — `FileDataProvider` (atual) e `ApiDataProvider` (futuro).

⚠️ **Volume real**: os arquivos de movimento têm centenas de milhares de linhas
(`bdDesempenhoComercialAtual.txt` ~351 mil linhas / 41MB, `...Comparação.txt` ~45MB).
Nunca mandar os registros brutos para o cliente — toda filtragem/agregação roda no
servidor (`lib/desempenho/consulta.ts`, chamado pela página e por
`app/api/desempenho-comercial/route.ts`); o navegador só recebe o resultado já
agregado (KPIs + algumas dezenas/centenas de linhas). `lib/data-providers/file-provider.ts`
mantém cache em memória do processo (invalidado por `mtime` do arquivo) porque
reprocessar do zero a cada requisição é lento demais.

### Arquivos do módulo Desempenho Comercial

Ficam em `05 - Bases` (irmã da pasta deste projeto, `06 - Projetos`), com extensão
`.txt`:

| Arquivo | Conteúdo |
|---|---|
| `bdDesempenhoComercialAtual.txt` | Vendas/margem por produto — período atual, grão diário, **sem quebra por loja** (ver aviso abaixo) |
| `bdDesempenhoComercialComparação.txt` | Vendas/margem por produto **e loja**, grão diário — período de comparação |
| `bdCadastro.txt` | Cadastro de produtos: hierarquia mercadológica + comprador (~130 colunas no total, só usamos ~7) |
| `bdLojas.txt` | As 11 lojas: nome, formato (Varejo/Atacado) |

`bdDesempenhoComercialAtual.txt` inclui `Unidade Código`/`Unidade Nome`, então
o painel "Lojas" funciona também pro período atual. Os dois arquivos de
movimento (Atual e Comparação) têm coluna `Data` (grão diário) — os dois
períodos são calculados automaticamente a partir do min/máx de `Data` do
respectivo arquivo (`lib/desempenho/periodo.ts`, `calcularLabelPeriodo`, usada
pros dois). Não precisa (nem tem como, no momento) configurar manualmente —
sempre pega a primeira e a última data de cada arquivo.

### Formato dos arquivos

- Encoding: **`bdLojas.txt` é UTF-8**; os outros três (`bdCadastro`,
  `bdDesempenhoComercialAtual`, `...Comparação`) são **ISO-8859-1/Latin-1** —
  confirmado byte a byte nos arquivos reais. Não presumir o mesmo encoding para
  todos os arquivos.
- Números usam **vírgula como separador decimal** (padrão BR)
- `bdDesempenhoComercialAtual`, `bdDesempenhoComercialComparação` e `bdCadastro`:
  **cabeçalho em 2 linhas** — linha 1 = nome principal da coluna, linha 2 =
  complemento (quando presente, junta como `"{linha1} {linha2}"`, senão usa só a
  linha 1). `bdCadastro.txt` tem nomes de coluna repetidos na linha 1 (ex: duas
  colunas "Código", duas "Classe") — a linha 2 sempre desambigua o nome combinado;
  ao resolver uma coluna pelo nome, usar a **primeira ocorrência** do nome já
  combinado (ver `lerTabela` em `file-provider.ts`).
- `bdLojas`: cabeçalho **normal de 1 linha**, sem complemento — não presumir que
  todo arquivo segue o padrão de 2 linhas, checar por arquivo.

### Colunas confirmadas — `bdDesempenhoComercialAtual.txt`

```
Código | Descricao (sem acento) | Complemento | Marca | Código Barras
Qtde Vendas | Valor | Lucros
Qtde Vendas Oferta | Vendas Oferta | Lucros Oferta
Vendas Ct Empresa (descartar — não utilizado)
Data (grão diário; NÃO tem Unidade Código/Nome — ver aviso acima)
```

### Colunas confirmadas — `bdDesempenhoComercialComparação.txt`

```
Código | Descricao (sem acento) | Complemento | Marca | Código Barras
Unidade Código (= código da loja) | Unidade Nome (= nome da loja)
Qtde Vendas | Valor | Lucros
Qtde Vendas Oferta | Vendas Oferta | Lucros Oferta
Vendas Ct Empresa (descartar — não utilizado)
Data (grão diário — mesma estrutura do Atual)
```

**Regular = Total − Oferta.** Não é uma coluna do arquivo, é campo calculado na
camada de normalização (vale para Qtde, Valor e Lucro).

### Colunas confirmadas — `bdCadastro.txt`

```
Código (SKU)
Dpto (código do departamento, 3 dígitos, ex: "014")
Grupo (código numérico do nível mais baixo — Sub Grupo)
Nome Grupo (nome do Sub Grupo)
Hierarquia de Grupos → string única, níveis separados por vírgula:
    "Departamento, Seção, Categoria, Grupo, Sub Grupo"
    ⚠️ NEM SEMPRE tem os 5 níveis — parser precisa tratar isso sem quebrar
    ✅ Confirmado com o usuário: não existe fonte estruturada separada para
    Categoria/Grupo — basta dividir esta string pelo delimitador ","
Compr / Nome Comprador → NÃO USADO — ver "Compradores padronizados" abaixo
```

#### Compradores padronizados por Departamento

✅ Confirmado com o usuário: a coluna `Compr`/`Nome Comprador` de `bdCadastro`
não é confiável — o comprador exibido no app vem de uma tabela fixa por Dpto
(`lib/desempenho/compradores.ts`), não do arquivo. Dois departamentos (Açougue
e Hortifruti) têm comprador diferente por Formato de loja (Varejo × Atacado);
os demais têm um único comprador nos dois formatos.

```
001 - Acougue         - Johathan (Varejo) / Jairo (Atacado)
002 - Peixaria         - Johathan
003 - Hortifruti       - Marrone (Varejo) / Jairo (Atacado)
004 - Padaria Propria  - Nil
005 - Padaria Industria- Nil
006 - Pereciveis Frios e Congelados - Johathan
007 - Pereciveis Lacteos - Bruna
008 - Mercearia Basica - Divino
009 - Mercearia Leite  - Manoel
010 - Mercearia Doce   - Bruna
011 - Mercearia Salgada- Ricardo
012 - Mercearia Saudavel - Bruna
013 - Bebidas          - Sandro
014 - Limpeza          - Manoel
015 - Perfumaria       - Manoel
016 - Bazar            - Edvaldo
017 - Eletro           - Edvaldo
018 - Sazonais         - Bruna
099 - Apropriacoes     - S/ Comprador
```

#### Códigos de Departamento (Dpto) confirmados

```
001 - Acougue
002 - Peixaria
003 - Hortifruti
004 - Padaria Propria
005 - Padaria Industria
006 - Pereciveis Frios e Congelados
007 - Pereciveis Lacteos
008 - Mercearia Basica
009 - Mercearia Leite
010 - Mercearia Doce
011 - Mercearia Salgada
012 - Mercearia Saudavel
013 - Bebidas
014 - Limpeza
015 - Perfumaria
016 - Bazar
017 - Eletro
018 - Sazonais
099 - Apropriacoes
```

### Colunas confirmadas — `bdLojas`

```
Cód Unid | Cód Unid Reduzido | Nome Sistema | Nome Loja | Formato (Varejo/Atacado)
```

### Chaves de join

```
bdDesempenhoComercialAtual/Comparação.Código  →  bdCadastro.Código        (SKU)
bdDesempenhoComercialAtual/Comparação.Unidade Código → bdLojas.Cód Unid   (loja)
```

## Regra de negócio: qualidade de cadastro

Produtos com hierarquia mercadológica incompleta (ex: caem em "Verificar Dpto") que
tenham **movimentação** (venda > 0) **não deveriam aparecer** nos relatórios — é
rotina da equipe do usuário tratar/corrigir esses produtos regularmente.

Se algum produto nessa situação aparecer com movimentação:
- **avisar o usuário**
- exibir contagem num **badge discreto na interface** (não um banner chamativo);
  clicar no badge baixa um `.txt` com os códigos (SKU) desses produtos, pra
  facilitar levar a lista pra quem corrige o cadastro
- excluir esses produtos dos números consolidados até serem corrigidos

⚠️ A contagem é de **produtos (SKU) únicos**, não de linhas — o mesmo produto
tem uma linha por loja/dia em `bdDesempenhoComercialAtual.txt`, então contar
linhas infla o número (`lib/data-providers/normalizar-desempenho.ts`,
`normalizarPeriodo`, usa um `Set` de códigos).

## Design system

Cores extraídas da logo oficial da MAX:

| Token | Hex | Uso |
|---|---|---|
| `azul` (primário) | `#004C97` | header, ações primárias, destaque |
| `vermelho` (marca/alerta) | `#E30000` | badge "SUPERMERCADOS", alertas, desvio negativo |
| Verde (não é cor de marca) | `#1E9E62` | desvio positivo — semáforo |

Tipografia: **Manrope** (display/headings) + **IBM Plex Sans** (corpo) via Google
Fonts. Evitar Inter/Roboto/Arial (padrão genérico de IA).

Painéis de tabela (Estrutura Mercadológica, Lojas, Top Altas/Quedas) usam
cabeçalho sólido `azul` com texto branco (igual ao header do site) — não só a
barra de título do site, os painéis internos também carregam a cor da marca.
Linha de subtotal em `azul/10` com números em `azul` negrito; linha
selecionada (produto/loja) em `vermelho/10`; zebra sutil nas linhas pares.

## Padrões de UX (módulo Desempenho Comercial)

Referência de comportamento pra manter consistência nos próximos módulos:

1. **KPI cards reativos ao filtro** — Venda, Lucro, %Lucro sempre refletem o recorte
   ativo (categoria × loja × produto selecionados), não um total fixo da empresa.
   Mostrar claramente que os números refletem o recorte quando ele não é "toda a
   empresa × todas as lojas". Ticket Médio foi removido dos cards (cálculo com
   inconsistência a investigar antes de voltar a exibir).
2. **Duas tabelas que se filtram mutuamente**: Estrutura Mercadológica (com
   drill-down completo Departamento → Seção → Categoria → Grupo → Sub Grupo →
   **Produto**, via breadcrumb clicável pra voltar a qualquer nível) e Lojas,
   **empilhadas** (Lojas abaixo de Estrutura, não lado a lado — as duas
   ocupam a largura toda pra caber o conjunto grande de colunas abaixo).
   - Produto (folha do drill-down) é rotulado no padrão "Código - Descrição -
     Complemento" e agrupado por SKU (não faz parte da Hierarquia de Grupos).
   - Clicar numa linha de Departamento/Seção/Categoria/Grupo/Sub Grupo desce um
     nível (breadcrumb cresce) e também filtra a tabela de Lojas pra mostrar a
     performance daquele nó em cada loja.
   - Clicar num Produto **não desce nível** (é a folha) — em vez disso
     seleciona aquele SKU específico (clique de novo desmarca), filtrando
     KPIs e a tabela de Lojas pela performance daquele produto por loja, sem
     sair da lista de produtos irmãos (pra comparar vários rapidamente).
   - Clicar numa loja filtra a tabela de Estrutura para mostrar só a performance
     daquela loja (clique de novo para desmarcar).
   - Barra de status mostrando o recorte ativo + botão "Limpar seleção".
   - Cliques nas tabelas (e no breadcrumb) ficam bloqueados enquanto uma busca
     está em andamento — evita que um clique numa tabela desatualizada empurre
     um nó errado/duplicado pro breadcrumb.
   - **Subtotal como primeira linha** de cada tabela (Estrutura e Lojas, não no
     rodapé), somando as linhas visíveis.
   - **Conjunto rico de colunas** (mesmo em Estrutura e em Lojas — layout
     inspirado numa planilha de referência do usuário): R$ Valor/Lucro Total
     Atual e Comparação, %Desv. Valor/Lucro, %Lucro Total Atual/Comparação,
     P.P Desv. Lucro, %Part. Of (participação da Oferta no Valor) Atual/
     Comparação, %Lucro Of Atual/Comparação, %Lucro Regular Atual/Comparação,
     Part. (participação no total geral) — mesmo conjunto nos dois painéis,
     largura fixa por coluna (cabeçalho quebra em vez de alargar). P.P Desv.
     Lucro é diferença entre dois percentuais (pontos percentuais) — mostrado
     com sufixo "pp", não "%", pra não confundir com uma variação relativa.
   - **Colunas clicáveis pra ordenar** — clique alterna asc/desc. Ordenação
     padrão (sem coluna escolhida) da 1ª coluna: por código em todos os
     níveis de Estrutura, exceto Produto, que ordena por nome/descrição
     (código de SKU não é uma sequência significativa); Lojas ordena por
     código da loja. Clicar explicitamente na 1ª coluna segue a mesma regra
     (código vs. nome conforme o nível).
   - **1ª coluna fixa** em ambas as tabelas — rolando a tabela pra o lado, o
     nome do Departamento/Produto/Loja nunca some de vista.
   - **Cabeçalho da tabela travado ao rolar** — títulos das colunas ficam
     fixos no topo do próprio container da tabela. Bloco de Filtros+KPIs no
     topo da página também fica fixo, soltando só quando a 1ª tabela
     (Estrutura) chega, pra abrir espaço pro cabeçalho dela.
   - **Valores de Comparação marcados visualmente** (itálico + fundo
     ligeiramente sombreado) em todas as colunas "…Comparação", pra não
     confundir com os valores do período Atual ao ler a tabela.
3. **Toggle Tabela ↔ Ranking** no painel de Estrutura — Tabela é a visão detalhada
   com todas as colunas; Ranking é barras horizontais ordenadas por valor, mais
   rápidas de escanear.
4. **Painel Top Altas/Quedas** com **toggle de nível independente** (Seção /
   Categoria / Grupo) — ranqueia por %Desvio de Venda no nível escolhido, escopado
   pela loja selecionada (se houver) e **preso só ao Departamento** selecionado
   (1º nó do caminho de drill-down) — continua mostrando a visão daquele
   departamento mesmo descendo mais fundo (Seção → Categoria → Grupo → Sub
   Grupo → Produto), não precisa acompanhar o drill-down inteiro. Rótulo no
   formato "Departamento - Nome"; um item nunca aparece nos dois grupos ao
   mesmo tempo (quem caiu não entra em Altas, quem subiu não entra em Quedas).
5. **Semaforização automática**: todo %Desvio (venda e lucro) fica verde
   (positivo) ou vermelho (negativo) — cor + fundo leve, nunca só a cor do texto.
6. **Ordenação em modo Tabela por código** (`003 - Bazar`, `002 - Vila Mutirão`)
   por padrão — ver "Colunas clicáveis pra ordenar" acima. Modo Ranking continua
   ordenado por valor (maior → menor).
7. **Exportar Excel / PDF** — botões no header (implementado, ver seção "Exportação" abaixo).
8. Filtros no topo: Loja, Formato (Varejo/Atacado) e Comprador são todos
   **multi-seleção**. Período Atual e Período de Comparação mostrados como
   texto estático (não clicável, sem seletor), sempre calculados a partir do
   min/máx de `Data` do respectivo arquivo — nunca configurados manualmente
   (ver "Fonte de dados" acima). Formato fixo pros dois: "DD a DD/MMM AAAA
   Atual"/"... Comparação".
9. Navegação entre os 5 módulos como abas no header (mesmo estando só o primeiro
   implementado).
10. **Badge de cadastro pendente é clicável** — baixa um `.txt` com os códigos
    (SKU) dos produtos descartados por hierarquia incompleta (ver "Regra de
    negócio: qualidade de cadastro").

## Em aberto / a validar com o usuário

- Metas/objetivos ficaram fora de escopo por enquanto (mencionado explicitamente
  pelo usuário ao revisar referências de outra rede)

## Exportação (Desempenho Comercial)

Exportar Excel/PDF gera o arquivo a partir do recorte ativo (mesmos números
exibidos nos KPIs, na Estrutura Mercadológica e nas Lojas no momento do clique).

- Excel: `exceljs` (client-side) — planilhas "Resumo", "Estrutura Mercadológica"
  e "Lojas". Não usar o pacote `xlsx`/SheetJS — a versão publicada no npm tem
  vulnerabilidade conhecida sem correção.
- PDF: `jspdf` + `jspdf-autotable` (client-side) — cabeçalho com recorte ativo e
  KPIs, seguido das mesmas duas tabelas, paisagem.
- Implementação em `lib/desempenho/export.ts`, chamada pelos botões do header em
  `components/desempenho/DesempenhoDashboard.tsx`.
