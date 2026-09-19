# Fonte de dados — Desempenho Comercial

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

## Arquivos do módulo Desempenho Comercial

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

## Formato dos arquivos

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
  combinado (ver `parseTabela` em `lib/data-providers/parse-tabela.ts`).
- `bdLojas`: cabeçalho **normal de 1 linha**, sem complemento — não presumir que
  todo arquivo segue o padrão de 2 linhas, checar por arquivo.

## Colunas confirmadas — `bdDesempenhoComercialAtual.txt`

```
Código | Descricao (sem acento) | Complemento | Marca | Código Barras
Qtde Vendas | Valor | Lucros
Qtde Vendas Oferta | Vendas Oferta | Lucros Oferta
Vendas Ct Empresa (descartar — não utilizado)
Data (grão diário; NÃO tem Unidade Código/Nome — ver aviso acima)
```

## Colunas confirmadas — `bdDesempenhoComercialComparação.txt`

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

## Colunas confirmadas — `bdCadastro.txt`

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
Compr / Nome Comprador → NÃO USADO — ver docs/regras-de-negocio.md
```

## Colunas confirmadas — `bdLojas`

```
Cód Unid | Cód Unid Reduzido | Nome Sistema | Nome Loja | Formato (Varejo/Atacado)
```

## Chaves de join

```
bdDesempenhoComercialAtual/Comparação.Código  →  bdCadastro.Código        (SKU)
bdDesempenhoComercialAtual/Comparação.Unidade Código → bdLojas.Cód Unid   (loja)
```
