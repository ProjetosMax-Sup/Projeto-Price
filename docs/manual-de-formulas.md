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

Nunca se escreve fórmula em texto livre. Sempre por seleção: um **sinal** (+ ou −)
e uma **coluna** escolhida numa lista. Assim é impossível referenciar algo que não
existe.

---

## Os dois tipos de conta disponíveis hoje

### Soma / Subtração

Junta colunas com + e −. Use pra **agrupar** ou **descontar**.

```
Entradas Totais      = + Compras  + Outras Entradas  + Transfer. Entradas
Vendas Regular       = + Valor    − Vendas Oferta
Saldo Entradas-Saídas = + Entradas Totais  − Saídas Totais
```

Um termo pode ser uma coluna nativa **ou** outra soma que você já criou — é assim
que se monta em camadas (Outras Entradas Totais → Entradas Totais → Saldo).

### Razão (÷)

Divide um grupo de colunas por outro. Use pra **percentual** e para **indicadores
por unidade**.

```
% Lucro   = (Lucros) ÷ (Valor)
% Part. Oferta = (Vendas Oferta) ÷ (Valor)
DDE       = (Estoque Disponível) ÷ (Qtde Venda Média Diária)
```

Numerador e denominador são montados do mesmo jeito (lista de sinal + coluna),
então dá pra dividir somas por somas — ex.: `(Lucros − Lucros Oferta) ÷ (Valor −
Vendas Oferta)`.

---

## A regra que o editor não deixa quebrar

**Percentual (razão) não pode entrar dentro de uma soma.** A lista de colunas
disponíveis dentro de uma soma simplesmente não oferece razões — e se chegar uma
config assim pela API, ela é recusada.

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
| **Soma** | por linha, e soma normalmente nos subtotais | sim |
| **Razão** | só depois de agrupar (loja, departamento, total) | **não** |
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
