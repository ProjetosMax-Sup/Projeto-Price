import type { Metricas } from "./aggregate";
import { calcDesvio } from "./format";

/**
 * Conjunto de colunas compartilhado pelas tabelas de Estrutura Mercadológica e
 * de Lojas — mesmas métricas nos dois lugares (pedido do usuário, seguindo o
 * layout de uma planilha de referência).
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
