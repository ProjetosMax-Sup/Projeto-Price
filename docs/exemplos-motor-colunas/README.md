# Motor de colunas — o que é Parâmetros e o que é código

Documento de decisão (2026-09-29). Saiu de uma revisão crítica da camada de
Parâmetros: *"definir coluna por configuração não nos deixa limitado? Não seria
mais simples mudar código por cliente?"*. A conclusão está na seção **Modelo da
calculadora** abaixo, e foi **validada e aprovada** — é a direção a seguir quando
o avaliador de fórmula for construído.

Os arquivos `entradas-saidas-max.json` e `entradas-saidas-outra-rede.json` desta
pasta são exemplos no mesmo formato que o app salva em `data/parametros/` — dá
pra abrir os dois lado a lado e ver que a diferença é de duas linhas.

---

## Modelo da calculadora (a ideia central)

Três níveis, e não dois. A confusão de "config vs código" vem de tratar isso
como duas camadas quando são três:

| Nível | O que é | Onde mora | Quem mexe |
|---|---|---|---|
| **Dicionário** | os números disponíveis — só coluna **crua do arquivo** (as 83 do `bd<Mês>.txt`: Compras, Valor, Lucros, Transfer. Entradas...) | Dicionário de Colunas Nativas | ninguém inventa coluna aqui; vem do ERP |
| **Tipos de conta** | os **botões da calculadora**: `soma`, `razão`... e faltam `valorDoPeriodo`, `desvio`, `difPP`, `participação` | **Código** | dev, com deploy — mas de forma **aditiva** |
| **Colunas do relatório** | a **conta que você escreve**, apertando os botões nos números | **Parâmetros** (ConfigRelatorio, por módulo) | o negócio, sem deploy |

Ponto que costuma confundir: **"Entradas Totais" e "% Desvio" estão as duas no
mesmo nível** — as duas são contas escritas no relatório, nenhuma das duas entra
no Dicionário. A diferença é só que uma usa um botão que já existe (`soma`) e a
outra usa um botão que ainda não foi soldado na calculadora (`desvio`).

**Por isso Parâmetros não limita.** O que limita é o tamanho do catálogo de
botões — e esse catálogo cresce de forma aditiva: cada tipo novo é uma função
isolada no avaliador + um formulário na tela. Não toca em nenhum relatório que já
funciona.

---

## Cenário 1 — Transferências conta como Entrada? (config ganha)

No MAX, Transferências entre lojas entram como Entrada. Suponha outra rede que
não quer isso (trata transferência como movimento neutro, fora do fluxo).

**Config MAX** (`entradas-saidas-max.json`), coluna "Entradas Totais":

```json
{
  "nome": "Entradas Totais",
  "tipo": "soma",
  "termos": [
    { "sinal": "+", "colunaRef": "19" },   // Compras
    { "sinal": "+", "colunaRef": "23" },   // Outras Entradas
    { "sinal": "+", "colunaRef": "24" }    // Transfer. Entradas  ← só o MAX tem
  ]
}
```

**Config da outra rede** (`entradas-saidas-outra-rede.json`): a mesma coluna, sem
a terceira linha. Só isso.

| | MAX | Outra rede |
|---|---|---|
| Compras | 3.641.830 | 3.641.830 |
| Outras Entradas | 398.754 | 398.754 |
| Transfer. Entradas | 250.000 | *(não entra)* |
| **Entradas Totais** | **4.290.584** | **4.040.584** |

*(números ilustrativos, baseados na aba "Entradas x Saídas" da planilha do time)*

**Por que config e não código:** o código é byte a byte o mesmo nos dois casos.
Se isso virasse `if (cliente === "MAX")` no `aggregate.ts`, cada rede nova seria
um fork do arquivo de cálculo — e um bug corrigido numa rede não chegaria nas
outras. Aqui, é uma linha num JSON.

---

## Cenário 2 — Comparação e % Desvio (DECIDIDO)

Tentar escrever "% Desv. Valor" com o modelo de chips de hoje não funciona:

```json
{
  "tipo": "razao",
  "numerador":   [{ "sinal": "+", "colunaRef": "48" }],   // Valor... de qual período?
  "denominador": [{ "sinal": "+", "colunaRef": "48" }]    // Valor... do outro período?
}
```

O ref `48` aponta pra uma coluna do arquivo, não pra "a mesma coluna no outro
recorte de data". Atual e Comparação não são duas colunas — são o mesmo conjunto
filtrado por duas datas (`periodoAtual` / `periodoComparacao`).

### Decisão: Comparação vira um TIPO de coluna, aplicável a qualquer coluna

```json
{ "nome": "R$ Valor Comparação", "tipo": "valorDoPeriodo", "coluna": "48", "periodo": "comparacao" }
{ "nome": "% Desv. Valor",       "tipo": "desvio",         "coluna": "48" }
{ "nome": "P.P Desv. Lucro",     "tipo": "difPP",          "coluna": "calc_percLucro" }
```

Hoje existem 15 colunas fixas em `colunas-tabela.ts`, e 9 delas são variações de
"Comparação" de 6 colunas base. Como tipo, **Comparação passa a valer pra
qualquer coluna** — inclusive as calculadas que forem criadas depois, no Entradas
e Saídas ou em qualquer módulo novo. É mais flexível que hoje, não menos.

### Decisão: cada variante é uma linha explícita em Ativas

Avaliamos duas formas e **ficou decidido pela primeira**:

| | A — coluna explícita (**escolhida**) | B — checkbox na coluna base |
|---|---|---|
| Como fica | 1 linha em Ativas = 1 coluna na tela | 1 linha gera 2-3 colunas |
| Tamanho da lista | ~15 linhas no Desempenho Comercial | ~6 linhas |
| Ordem das colunas | **livre, qualquer arranjo** | variantes ficam grudadas na base |

**Por que A:** a ordem real da tabela de hoje é propositalmente irregular — as 6
primeiras agrupam por *variante* (Atual, Atual, Comp, Comp, Desv, Desv) e da 7ª
em diante agrupa por *coluna base* (%Lucro Atual, %Lucro Comp, P.P Desv). Com a
opção B isso seria impossível de reproduzir.

Ativas do Desempenho Comercial ficaria assim — uma linha por coluna da tela:

```
1.  Valor                      → nativa (ref 48)
2.  Lucros                     → nativa (ref 49)
3.  Valor Comparação           → valorDoPeriodo(Valor, comparação)
4.  Lucros Comparação          → valorDoPeriodo(Lucros, comparação)
5.  % Desv. Valor              → desvio(Valor)
6.  % Desv. Lucro              → desvio(Lucros)
7.  % Lucro                    → razão(Lucros ÷ Valor)
8.  % Lucro Comparação         → valorDoPeriodo(% Lucro, comparação)
9.  P.P Desv. Lucro            → difPP(% Lucro)
10. % Part. Oferta             → razão(Vendas Oferta ÷ Valor)
11. % Part. Oferta Comparação  → valorDoPeriodo(% Part. Oferta, comparação)
...
```

**Importante:** exibir o desvio **não obriga** a exibir o valor da Comparação. O
tipo `desvio` calcula internamente (sempre tem os dois períodos na mão). São
escolhas independentes — dá pra ter só o desvio, sem poluir a tela com o valor
absoluto do período anterior.

**Custo aceito:** montar 2-3 entradas por conceito na mão é tedioso. Resolver com
um atalho na tela: ao criar uma coluna, oferecer *"criar também: Comparação ·
% Desvio"*, que gera as três de uma vez — depois ficam independentes e
reordenáveis.

---

## Cenário 3 — A armadilha que o modelo atual permite (mais grave)

Duas lojas, período Atual:

| Loja | Venda | Lucro | % Lucro |
|---|---|---|---|
| A | 100 | 30 | 30% |
| B | 900 | 90 | 10% |

Qual é o % Lucro do total (A+B)?

- **Certo**: agrega primeiro, divide depois → (30+90) / (100+900) = **12%**
- **Errado**: soma/faz média das razões → (30% + 10%) / 2 = **20%**

12% vs 20%. É por isso que `aggregate.ts` calcula `percLucro` dentro de
`fecharMetricas()` — **depois** de somar, nunca por linha.

**O problema:** o modelo atual deixa montar isso:

```json
{
  "nome": "Média dos percentuais",
  "tipo": "soma",
  "termos": [
    { "sinal": "+", "colunaRef": "calc_percLucro" },       // ← uma razão
    { "sinal": "+", "colunaRef": "calc_percLucroOferta" }  // ← outra razão
  ]
}
```

Salva sem reclamar, aparece bonito na tela e devolve número errado —
silenciosamente, no subtotal e no total. Ninguém percebe até conferir na mão.

**O que falta:** cada tipo declara **em que estágio roda**, e o editor recusa
combinação inválida na hora de montar:

| Tipo | Estágio | Pode ser termo de outra soma? |
|---|---|---|
| `soma` de nativas | por linha, antes de agregar | sim |
| `razao` | só depois de agregar | **não** |
| `valorDoPeriodo`, `desvio`, `difPP`, `participacao` | só depois de agregar | **não** |

---

## Cenário 4 — `ref` por posição é frágil (e isso aconteceu hoje)

Os refs do Dicionário são a **posição** da coluna no arquivo. A config de
Entradas e Saídas usa:

```json
"nativasVisiveis": ["19", "48", "76", "75"]
//                              ↑     ↑
//                   Estoque Disponível, Qtde Venda Média Diária
```

Em 29/09/2026 o `bdSetembro.txt` foi reexportado com **79 colunas em vez de 83** —
sumiram 4 colunas nas posições 74-77, exatamente `Estoques Preço Venda`,
`Qtde Venda Média Diária`, `Estoque Disponível`, `Valor Venda Média Diária`.

O que salvou: o parser tem validação estrita de cabeçalho e **recusou o arquivo
inteiro**, então nada foi lido errado (foi um erro pontual de exportação,
corrigido depois). Mas num arquivo que mudasse mantendo 83 colunas, o ref `76`
continuaria apontando pra "posição 76" — e a tela mostraria "Estoque" exibindo o
valor de outra coluna, silenciosamente.

O Dicionário assume hoje que *"nenhuma coluna nativa pode ser excluída — ela
sempre existe no arquivo-fonte"* (`docs/parametros.md`, seção 3.1). O ERP provou
que essa premissa é falsa.

**Em aberto:**
1. Ref deveria ser o **nome** da coluna, não a posição? (Nome é estável; posição não.)
2. Validação "esta config aponta pra colunas que não existem no arquivo atual" —
   mesmo tratamento que já existe pra calculada quebrada (`calculadaQuebrada`),
   mas para nativas.

---

## Cenário 5 — O código precisa de âncoras, não de nomes

Os KPI Cards mostram Venda, Lucro e % Lucro. O "Top Altas e Quedas" ordena por
desvio de venda. A exportação destaca a coluna principal.

Se todas as colunas passam a ser configuráveis, **como o código sabe qual é a
principal?** Não pode ser por nome ("Venda" pode virar "Faturamento" noutra rede)
nem por ref (a composição muda por cliente).

**O que falta:** um campo de papel na coluna:

```json
{ "nome": "Entradas Totais", "tipo": "soma", "termos": [ ... ], "papel": "principal" }
```

KPI Card usa a `principal`, Top Altas/Quedas ordena pela `principal`, semáforo
colore a `comparavel`. Cada relatório define quem é quem; o código continua
genérico.

---

## Resumo: a linha de corte

| Pergunta | Onde mora |
|---|---|
| Quais campos entram nesta conta? | **Parâmetros** (chips) |
| Esta coluna aparece? Em que ordem? | **Parâmetros** |
| Como ela se chama nesse relatório? | **Parâmetros** |
| Quem enxerga este relatório? | **Parâmetros** |
| Qual coluna é a "principal" pro KPI? | **Parâmetros** (papel) |
| Que *tipo* de conta é (razão, desvio, participação, DDE)? | **Código** (catálogo de tipos) |
| Em que estágio ela pode ser calculada? | **Código** (declarado no tipo) |
| Qual o eixo do drill-down? | **Código** (já decidido, `docs/parametros.md` seção 3.2) |

**Em uma frase:** o catálogo de *tipos de conta* mora no código e cresce devagar,
de forma aditiva; a *composição* de cada conta mora em Parâmetros e muda livre,
por cliente, sem deploy.

---

## Status das decisões

| Decisão | Status |
|---|---|
| Modelo da calculadora (3 níveis: Dicionário / Tipos / Colunas) | ✅ **aprovado** (2026-09-29) |
| Comparação e Desvio como *tipos* aplicáveis a qualquer coluna | ✅ **implementado** — `valorDoPeriodo`, `desvio` e `difPP` em `lib/parametros/avaliador.ts`, com formulário próprio na aba Calculadas |
| Cada variante = linha explícita em Ativas (opção A) | ✅ **aprovado** |
| Ref por nome em vez de posição (cenário 4) | ✅ **implementado** — `ColunaNativa.ref` é o nome; migração automática do que já estava salvo em `lib/parametros/migracao-refs.ts`; aviso na tela quando a config aponta pra coluna que sumiu do arquivo |
| Editor recusar fórmula matematicamente inválida (cenário 3) | ✅ **implementado** — `estagioDoRef`/`erroDaCalculada` em `colunas-relatorio.ts`; razão não aparece como opção dentro de soma, e a API recusa se vier assim |
| Campo `papel` pras âncoras do código (cenário 5) | ✅ **implementado** — `ConfigRelatorio.papeis.principal`, marcado pela estrela na aba Ativas (Desempenho = Valor; Entradas e Saídas = saldo) |
| Manual de fórmulas pra quem monta relatório | ✅ **escrito** — `docs/manual-de-formulas.md` |
| Nativa pode alimentar fórmula sem ser exibida | ✅ **implementado** — `refsDisponiveisParaTermo` passou a usar o dicionário inteiro; marcar em Nativas é só sobre exibir, como o spec sempre disse |
| **Avaliador de fórmula** | ✅ **construído** — `lib/parametros/avaliador.ts`. Avalia no nível do grupo (soma é linear, então agregar as nativas e aplicar a fórmula dá o mesmo resultado que calcular linha a linha, muito mais barato) |
| **Verificação: avaliador == lógica atual** | ✅ **provado** — `/api/verificar-avaliador` roda os dois caminhos sobre os dados reais: 29 linhas × 15 colunas = **435 comparações, 0 divergências**. `colunas-tabela.ts` virou oráculo de regressão (não é mais o que a tela usa) |
| **Renderização lendo a config** | ✅ **trocado** — tabelas, KPIs, ordenação, ranking, coluna "Part." e exportação Excel/PDF agora vêm de `ordemAtivas` + `papeis.principal`. Nenhuma coluna do Desempenho Comercial está escrita no código |
| Desvio com base negativa | ✅ **corrigido** — `calcDesvio` passou a dividir pelo módulo da base: sair de −100 pra −50 agora é +50% (melhora), não −50%. Muda número só onde a base é negativa |
| Atalho "criar também Comparação/% Desvio" ao criar coluna | 💡 ideia, não detalhada |
| **Vale a pena construir o avaliador?** | ⬜ decisão de negócio — só se paga com multi-rede ou autonomia do negócio; se for só o MAX e só o Gabriel, congelar Parâmetros onde está é mais rápido e seguro |
