# Manual de Fórmulas

Como montar colunas na aba **Calculadas** de `/parametros` → Colunas (por
relatório). Escrito pra quem está montando relatório, não pra quem programa.

O modelo geral (o que é configuração e o que é código) está em
`docs/exemplos-motor-colunas/README.md`.

---

## As peças

| Peça | O que é | Onde aparece |
|---|---|---|
| **Coluna nativa** | vem pronta do arquivo do ERP (Compras, Valor, Lucros, Perdas...) | aba **Nativas** — você só marca se aparece ou não |
| **Coluna calculada** | uma conta que você monta a partir de outras colunas | aba **Calculadas** |
| **Ativas** | a ordem final das colunas na tela e na exportação | aba **Ativas** |

Toda calculada tem, no fim do editor, um seletor de **formato de saída**
(Contábil R$ / Volume sem símbolo / %) e de **casas decimais** — sem escolher
nada, vale o padrão do tipo (0 casas pra R$/volume, 1 casa pra %).

Fórmula é texto, no estilo Excel: `[Nome da Coluna]` entre colchetes + os
operadores `+ − * / ( )`. Mas nunca dá pra referenciar algo que não existe — o
botão Salvar fica bloqueado enquanto a fórmula tiver erro (colchete não
fechado, coluna desconhecida, fórmula se referenciando), e a mesma checagem
roda de novo no servidor antes de gravar.

```
Entradas Totais       = [Compras] + [Outras Entradas] + [Transfer. Entradas]
Vendas Regular        = [Valor] - [Vendas Oferta]
Saldo Entradas-Saídas = [Entradas Totais] - [Saídas Totais]
% Lucro                = [Lucros] / [Valor] * 100
% Part. Oferta         = [Vendas Oferta] / [Valor] * 100
DDE                    = [Estoque Disponível] / [Qtde Venda Média Diária]
GAP R$ (Compra e Venda) = [Compras] - [Meta] / 100 * [Valor]
```

Uma referência pode ser uma coluna nativa (ex.: `[Compras]`) **ou** outra
coluna calculada já criada neste relatório, pelo **nome** dela (ex.:
`[Entradas Totais]`) — é assim que se monta em camadas. Divisão por zero nunca
quebra a tela: o resultado vira `0` ("zero é mais honesto que Infinity" — a
mesma regra que já valia pra razão).

No campo da fórmula, um glossário lista as colunas disponíveis: clicar insere
a referência certa na posição do cursor, sem precisar digitar o nome exato.

Dois tipos antigos continuam existindo só pra ler configs já salvas antes
desta mudança (`soma` e `razão`, por seleção de sinal + coluna numa lista, sem
texto livre) — toda coluna nova de aritmética pura nasce como fórmula de
texto.

---

## A regra que o editor não deixa quebrar

**Uma fórmula de texto nunca pode ser termo de uma soma antiga.** A lista de
colunas disponíveis dentro de uma soma (tipo legado) simplesmente não oferece
fórmulas/razões como opção — e se chegar uma config assim pela API, ela é
recusada.

### Por que

Duas lojas, no mesmo período:

| Loja | Venda | Lucro | % Lucro |
|---|---|---|---|
| A | 100 | 30 | 30% |
| B | 900 | 90 | 10% |

Qual é o % Lucro das duas juntas?

- Somando os percentuais: 30% + 10% = **40%** ❌
- Tirando a média: (30% + 10%) ÷ 2 = **20%** ❌
- Somando primeiro e dividindo depois: (30+90) ÷ (100+900) = **12%** ✅

A loja B pesa 9 vezes mais que a A, e percentual não carrega esse peso. Por isso
uma razão só pode ser calculada **depois** que as linhas já foram somadas.

### Como fazer o que você queria

Se a intenção era "somar dois percentuais", quase sempre o que se quer é uma razão
com mais termos em cima ou embaixo:

| Em vez de | Faça |
|---|---|
| `soma(% Lucro, % Lucro Oferta)` | `razão((Lucros + Lucros Oferta) ÷ (Valor))` |
| "média de % Lucro por loja" | `razão(Lucros ÷ Valor)` — já é a média ponderada correta |

---

## Momento de cálculo (o que está por trás da regra)

| Tipo | Quando é calculada | Pode virar termo de uma soma? |
|---|---|---|
| Coluna nativa | por linha do arquivo | sim |
| **Soma** (legado) | por linha, e soma normalmente nos subtotais | sim |
| **Fórmula** (texto) | só depois de agrupar (loja, departamento, total) | **não** |
| **Razão** (legado) | só depois de agrupar | **não** |
| **Valor de outro período / % Desvio / Dif. p.p.** | só depois de agrupar | **não** |

---

## Coluna principal (a estrela na aba Ativas)

Cada relatório marca **uma** coluna como principal. É a que o sistema usa quando
precisa de "o número mais importante deste relatório":

- o KPI grande no topo da tela;
- o eixo do Top Altas e Quedas;
- a ordenação padrão das tabelas.

No Desempenho Comercial a principal é **Valor** (venda). No Entradas e Saídas é
**Entradas Totais − Saídas Totais** (o saldo).

Se a principal não estiver marcada, o relatório não sabe qual número destacar —
marque antes de publicar.

---

## Avisos que podem aparecer

| Aviso | O que houve | O que fazer |
|---|---|---|
| **depende de coluna excluída** | uma calculada que a sua fórmula usava foi apagada | edite a fórmula e escolha outra coluna |
| **coluna não existe mais no arquivo** | o ERP mudou o layout e a coluna nativa sumiu | conferir a exportação; se a mudança for permanente, trocar a coluna na fórmula |
| **não é possível publicar** | existe alguma fórmula quebrada no relatório | corrija as pendências acima; publicar fica liberado sozinho |

---

## Colunas que comparam dois períodos

Atual e Comparação não são duas colunas do arquivo — são o mesmo dado filtrado por
duas datas. Por isso existem três tipos próprios, que se aplicam a **qualquer**
coluna (nativa ou calculada):

| Tipo | Botão | O que faz | Exemplo |
|---|---|---|---|
| `valorDoPeriodo` | **+ Valor de outro período** | mostra a mesma coluna no período escolhido | "R$ Valor Total Comparação" |
| `desvio` | **+ % Desvio** | variação % contra a Comparação | "% Desv. Valor" |
| `difPP` | **+ Diferença em p.p.** | Atual − Comparação, pra coluna que já é % | "P.P Desv. Lucro" |

Quando não há período de Comparação escolhido, essas colunas aparecem vazias (—)
em vez de zero: vazio é "não dá pra comparar", zero seria um número inventado.

As 15 colunas do Desempenho Comercial hoje são montadas exatamente assim — 2
nativas + 13 calculadas. Dá pra conferir em `/parametros` → Colunas (por
relatório) → Desempenho Comercial.

### Ainda não construído

| Tipo | Pra que serviria |
|---|---|
| `participacao` | quanto a linha representa do total (% de participação) |
