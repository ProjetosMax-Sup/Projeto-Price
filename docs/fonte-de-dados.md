# Fonte de dados — Desempenho Comercial

Os dados vêm de arquivos **TXT delimitados por pipe (`|`)**, sincronizados via pasta
do OneDrive (caminho difere entre computador pessoal e notebook corporativo — **não
hardcodear o caminho**, usar variável de ambiente `DESEMPENHO_COMERCIAL_DATA_DIR`,
configurada em `.env.local`).

Arquitetura pensada para trocar depois para API do ERP sem reescrever os módulos:
toda leitura de dado passa por uma interface `DataProvider`, com duas implementações
possíveis por trás dela — `FileDataProvider` (atual) e `ApiDataProvider` (futuro).

⚠️ **Volume real**: o movimento de um mês sozinho já tem centenas de milhares de
linhas (~200-350MB por arquivo); somando os meses disponíveis hoje (Janeiro a Junho +
Agosto + Setembro, faltando só Julho) passa de 4 milhões de registros. Nunca mandar os
registros brutos para o cliente — toda filtragem/agregação roda no servidor
(`lib/desempenho/consulta.ts`, chamado pela página e por
`app/api/desempenho-comercial/route.ts`); o navegador só recebe o resultado já
agregado (KPIs + algumas dezenas/centenas de linhas). `lib/data-providers/file-provider.ts`
mantém cache em memória do processo (invalidado por `mtime` de cada arquivo mensal)
porque reprocessar tudo do zero a cada requisição é lento demais.

## Arquivos do módulo Desempenho Comercial

Ficam em `05 - Bases` (irmã da pasta deste projeto, `06 - Projetos`), com extensão
`.txt`:

| Arquivo | Conteúdo |
|---|---|
| `bd<Mês>.txt` (ex: `bdJaneiro.txt`, `bdSetembro.txt`) | Movimento completo (venda, compra, perda, transferência etc.) por produto e loja, grão diário — **um arquivo por mês do calendário** |
| `bdCadastro.txt` | Cadastro de produtos: hierarquia mercadológica + comprador (~130 colunas no total, só usamos ~7) |
| `bdLojas.txt` | As 11 lojas: nome, formato (Varejo/Atacado) |

Substituiu os antigos `bdDesempenhoComercialAtual.txt`/`...Comparação.txt` (fora de
uso — ver `docs/parametros.md` seção 1.1; os dois arquivos continuam no disco, só
paramos de referenciá-los no código). "Atual" e "Comparação" deixaram de ser dois
arquivos: agora são só dois recortes de data (`periodoAtual`/`periodoComparacao`,
calendário editável) sobre o **mesmo** conjunto de meses — ver
`DataProvider.getDesempenho()`, que devolve a união de todos os `bd<Mês>.txt`
encontrados.

`lib/desempenho/datas.ts` (`datasDisponiveis`) calcula quais datas existem de fato no
conjunto todo — os dois seletores de período (Atual/Comparação) compartilham essa
mesma lista, já que vêm da mesma fonte agora.

### Descoberta dos arquivos mensais

Não existe uma lista fixa de "quais meses existem" — `arquivosMensaisDisponiveis` em
`config/data-sources.ts` verifica, a cada invalidação de cache, quais `bd<Mês>.txt`
estão de fato na pasta (via `fs.readdir` local / listagem do OneDrive em produção) e
usa só esses, em ordem cronológica. Um mês ausente (ex: Julho, ainda não subido no
momento desta doc) é simplesmente ignorado — assim que o arquivo aparecer, o cache
invalida sozinho (a versão do cache inclui nome+mtime/eTag de cada arquivo encontrado)
e ele entra no conjunto sem precisar reiniciar nada.

Se o cabeçalho de algum `bd<Mês>.txt` não bater exatamente com o esperado (já
aconteceu: um bloco de Julho veio de uma extração diferente do ERP, 111 colunas em
outra ordem), o parser **recusa processar aquele arquivo** (loga um erro alto) em vez
de tentar às cegas — mas os outros meses continuam funcionando normalmente, só aquele
mês fica de fora do conjunto até ser corrigido.

## Formato dos arquivos

- Encoding: **`bdLojas.txt` é UTF-8**; os demais (`bdCadastro`, `bd<Mês>.txt`) são
  **ISO-8859-1/Latin-1** — confirmado byte a byte nos arquivos reais. Não presumir o
  mesmo encoding para todos os arquivos.
- Números usam **vírgula como separador decimal, ponto como separador de milhar**
  (padrão BR) — nunca remover só a vírgula sem antes remover os pontos, ou um valor
  como `"1.234,56"` vira `1.234` (truncado). **Estoque pode ser negativo** — não
  assumir não-negatividade no parser.
- `bd<Mês>.txt` e `bdCadastro.txt`: **cabeçalho em 2 linhas** — linha 1 = nome
  principal da coluna, linha 2 = complemento (quando presente, junta como
  `"{linha1} {linha2}"`, senão usa só a linha 1). As duas têm nomes de coluna
  repetidos na linha 1 (`bd<Mês>.txt` repete "Qtde" 4x, "Compras" 4x etc.;
  `bdCadastro.txt` repete "Código", "Classe") — a linha 2 sempre desambigua o nome
  combinado; ao resolver uma coluna pelo nome, usar a **primeira ocorrência** do nome
  já combinado (ver `parseTabela` em `lib/data-providers/parse-tabela.ts`). Todo nome
  combinado que o Desempenho Comercial usa hoje é único entre as colunas do arquivo —
  não precisa de posição fixa pra extrair.
- `bdLojas`: cabeçalho **normal de 1 linha**, sem complemento — não presumir que todo
  arquivo segue o padrão de 2 linhas, checar por arquivo.
- Granularidade: uma linha por **SKU × Loja × Dia**, e só existe linha nos dias em que
  houve algum movimento (arquivo esparso, não é um calendário denso com todo dia
  preenchido).

## Colunas confirmadas — `bd<Mês>.txt`

83 colunas — o motor de cálculo do ERP já traz cada tipo de movimentação (compra,
venda, perda, transferência, devolução, bonificação, consignação, produção, sobra,
falta, consumo interno etc.) como coluna própria; **não existe coluna "Tipo
Movimento"** pra filtrar linha por tipo. Cabeçalho de referência completo (posição →
nome combinado linha1+linha2), validado campo a campo contra os arquivos reais em
`config/data-sources.ts` (`CABECALHO_REFERENCIA_MENSAL`). O Desempenho Comercial usa
só um subconjunto:

```
Código | Descricao (sem acento) | Complemento | Marca | Dpto
Código Barras | Unidade Código (= código da loja) | Unidade Nome (= nome da loja, cru — ex: "Ap.Independência")
Qtde Vendas | Valor | Lucros
Qtde Vendas Oferta | Vendas Oferta | Lucros Oferta
Vendas Ct Empresa (descartar — não utilizado)
Data (grão diário)
```

`Dpto` (departamento, 3 dígitos) vem direto em cada linha agora — não depende mais de
join com `bdCadastro` pra saber o departamento (a hierarquia completa — Seção,
Categoria, Grupo, Sub Grupo — ainda vem só de lá, ver abaixo). O Desempenho Comercial
ainda não usa esse campo direto (continua lendo `Produto.dpto` via join, ver "Em
aberto" em `docs/parametros.md`) — fica registrado aqui como algo que o arquivo já
oferece, pra ser aproveitado quando a camada de Parâmetros (seção 2 de
`docs/parametros.md`) for construída.

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
bd<Mês>.Código        →  bdCadastro.Código        (SKU)
bd<Mês>.Unidade Código →  bdLojas.Cód Unid          (loja)
```
