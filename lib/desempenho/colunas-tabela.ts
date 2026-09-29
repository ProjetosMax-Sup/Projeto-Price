import type { Metricas } from "./aggregate";
import { calcDesvio } from "./format";

/**
 * ⚠️ NÃO É MAIS O QUE A TELA USA. Desde 2026-09-29 as colunas do Desempenho
 * Comercial vêm da configuração de /parametros, via
 * `lib/desempenho/colunas-configuradas.ts` + `lib/parametros/avaliador.ts`.
 *
 * Este arquivo continua no projeto como **oráculo de regressão**: é a definição
 * antiga, já aprovada e conferida em produção, contra a qual
 * `app/api/verificar-avaliador` compara os números do avaliador, linha a linha.
 * Enquanto esse endpoint acusar 0 divergências, a configuração reproduz
 * exatamente o relatório de antes.
 *
 * Só apagar (junto com o endpoint) quando não fizer mais sentido comparar — ex.:
 * depois que alguém alterar as colunas de propósito pela tela, momento em que
 * divergir passa a ser o esperado.
 */
export const COLUNAS_METRICAS = [
  { chave: "vAtual", rotulo: "R$ Valor Total Atual", tipo: "moeda", largura: 110 },
  { chave: "lAtual", rotulo: "R$ Lucros Total Atual", tipo: "moeda", largura: 110 },
  { chave: "vComp", rotulo: "R$ Valor Total Comparação", tipo: "moeda", largura: 110 },
  { chave: "lComp", rotulo: "R$ Lucro Total Comparação", tipo: "moeda", largura: 110 },
  { chave: "dVenda", rotulo: "% Desv. Valor", tipo: "desvio", largura: 76 },
  { chave: "dLucro", rotulo: "% Desv. Lucro", tipo: "desvio", largura: 76 },
  { chave: "percLucroAtual", rotulo: "% Lucro Total Atual", tipo: "percent", largura: 84 },
  { chave: "percLucroComp", rotulo: "% Lucro Total Comparação", tipo: "percent", largura: 84 },
  { chave: "ppDesvioLucro", rotulo: "P.P Desv. Lucro", tipo: "pp", largura: 76 },
  { chave: "percPartOfAtual", rotulo: "% Part. Of Atual", tipo: "percent", largura: 84 },
  { chave: "percPartOfComp", rotulo: "% Part. Of Comparação", tipo: "percent", largura: 84 },
  { chave: "percLucroOfAtual", rotulo: "% Lucro Of Atual", tipo: "percent", largura: 84 },
  { chave: "percLucroOfComp", rotulo: "% Lucro Of Comparação", tipo: "percent", largura: 84 },
  { chave: "percLucroRegularAtual", rotulo: "% Lucro Regular Atual", tipo: "percent", largura: 84 },
  { chave: "percLucroRegularComp", rotulo: "% Lucro Regular Comparação", tipo: "percent", largura: 84 },
] as const;

export type ColunaMetrica = (typeof COLUNAS_METRICAS)[number]["chave"];
export type TipoColuna = (typeof COLUNAS_METRICAS)[number]["tipo"];

/** Largura (px) da 1ª coluna (nome da loja/nó de estrutura) e da última ("Part.") — usadas junto
 * com a soma das métricas pra calcular `LARGURA_MINIMA_TABELA` abaixo. 280 (não 200) porque a
 * linha de Loja tem código + nome + badge de formato (ex: "007 - Vila Brasília" + "Atacado") na
 * mesma célula truncada — 200px cortava o badge no meio pra nomes mais longos (confirmado em
 * 2026-09-21). Mantido em sincronia manualmente com os `min-w-[280px]` em
 * LojasPanel.tsx/EstruturaPanel.tsx (Tailwind não aceita variável JS dentro de `[...]`). */
export const LARGURA_COLUNA_NOME = 280;
export const LARGURA_COLUNA_PART = 64;

/**
 * Largura mínima (px) da tabela inteira (nome + todas as métricas + Part.) — usada como
 * `minWidth` no `<table>` de LojasPanel/EstruturaPanel. Sem isso, `table-fixed` + `width: 100%`
 * espreme a coluna de nome (sem largura própria) até quase zero quando a soma das métricas já
 * ocupa mais que o painel, em vez de deixar o `overflow-x-auto` do container rolar (confirmado em
 * 2026-09-21: coluna "Loja" mostrando só "00..." truncado). `minWidth` > `width: 100%` faz o
 * CSS priorizar o mínimo e a tabela ficar maior que o container, acionando o scroll horizontal.
 */
export const LARGURA_MINIMA_TABELA =
  LARGURA_COLUNA_NOME + COLUNAS_METRICAS.reduce((soma, c) => soma + c.largura, 0) + LARGURA_COLUNA_PART;

/** Colunas que mostram um valor do período de Comparação (marcadas visualmente diferente na tabela). */
export function ehColunaComparacao(chave: ColunaMetrica): boolean {
  return chave.endsWith("Comp");
}

const TIPO_POR_COLUNA: Record<ColunaMetrica, TipoColuna> = Object.fromEntries(
  COLUNAS_METRICAS.map((c) => [c.chave, c.tipo]),
) as Record<ColunaMetrica, TipoColuna>;

export function tipoColuna(chave: ColunaMetrica): TipoColuna {
  return TIPO_POR_COLUNA[chave];
}

function percLucroOf(venda: number, lucro: number): number {
  return venda !== 0 ? (lucro / venda) * 100 : 0;
}

/** Valor numérico de uma coluna (para exibir e para ordenar) — null quando não há comparação. */
export function valorColunaMetrica(
  atual: Metricas,
  comparacao: Metricas | null,
  chave: ColunaMetrica,
): number | null {
  switch (chave) {
    case "vAtual":
      return atual.venda;
    case "lAtual":
      return atual.lucro;
    case "vComp":
      return comparacao ? comparacao.venda : null;
    case "lComp":
      return comparacao ? comparacao.lucro : null;
    case "dVenda":
      return comparacao ? calcDesvio(atual.venda, comparacao.venda) : null;
    case "dLucro":
      return comparacao ? calcDesvio(atual.lucro, comparacao.lucro) : null;
    case "percLucroAtual":
      return atual.percLucro;
    case "percLucroComp":
      return comparacao ? comparacao.percLucro : null;
    case "ppDesvioLucro":
      return comparacao ? atual.percLucro - comparacao.percLucro : null;
    case "percPartOfAtual":
      return percLucroOf(atual.venda, atual.vendaOferta);
    case "percPartOfComp":
      return comparacao ? percLucroOf(comparacao.venda, comparacao.vendaOferta) : null;
    case "percLucroOfAtual":
      return percLucroOf(atual.vendaOferta, atual.lucroOferta);
    case "percLucroOfComp":
      return comparacao ? percLucroOf(comparacao.vendaOferta, comparacao.lucroOferta) : null;
    case "percLucroRegularAtual":
      return percLucroOf(atual.vendaRegular, atual.lucroRegular);
    case "percLucroRegularComp":
      return comparacao ? percLucroOf(comparacao.vendaRegular, comparacao.lucroRegular) : null;
  }
}
