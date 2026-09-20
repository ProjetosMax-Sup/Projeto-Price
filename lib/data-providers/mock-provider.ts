import {
  LOJAS_MOCK,
  MOVIMENTOS_ATUAL_MOCK,
  MOVIMENTOS_COMPARACAO_MOCK,
  PRODUTOS_MOCK,
} from "@/lib/desempenho/mock-data";
import type { Loja, MovimentoVendas, PeriodoDesempenho, Produto } from "@/lib/types";
import type { DataProvider } from "./types";

function montarPeriodo(
  movimentos: MovimentoVendas[],
  produtos: Produto[],
  lojas: Loja[],
): PeriodoDesempenho {
  const produtosPorCodigo = new Map(produtos.map((p) => [p.codigo, p]));
  const lojasPorCodigo = new Map(lojas.map((l) => [l.codUnid, l]));
  // Conta produtos (SKU) únicos descartados, não linhas.
  const codigosDescartados = new Set<string>();

  const registros = movimentos
    .map((movimento) => ({
      movimento,
      produto: produtosPorCodigo.get(movimento.codigo) ?? null,
      loja: lojasPorCodigo.get(movimento.unidadeCodigo) ?? null,
    }))
    .filter(({ movimento, produto }) => {
      const descartar = (produto?.cadastroIncompleto ?? false) && movimento.qtdeVendasTotal > 0;
      if (descartar) codigosDescartados.add(movimento.codigo);
      return !descartar;
    });

  return {
    registros,
    produtosDescartados: codigosDescartados.size,
    produtosDescartadosCodigos: Array.from(codigosDescartados),
  };
}

/** Dataset de exemplo — usado enquanto DESEMPENHO_COMERCIAL_DATA_DIR não estiver configurado. */
export function createMockDataProvider(): DataProvider {
  return {
    async getLojas() {
      return LOJAS_MOCK;
    },
    async getProdutos() {
      return PRODUTOS_MOCK;
    },
    async getDesempenho() {
      // Sem arquivos mensais de exemplo — reaproveita os dois conjuntos mock antigos
      // (datas diferentes) só pra dar variação de período pra escolher no calendário.
      return montarPeriodo([...MOVIMENTOS_ATUAL_MOCK, ...MOVIMENTOS_COMPARACAO_MOCK], PRODUTOS_MOCK, LOJAS_MOCK);
    },
  };
}
