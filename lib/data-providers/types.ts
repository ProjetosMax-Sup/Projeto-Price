import type { Loja, Produto, PeriodoDesempenho } from "@/lib/types";

/**
 * Abstração de leitura de dados do módulo Desempenho Comercial.
 * FileDataProvider (atual, TXT pipe-delimited) e ApiDataProvider (futuro, ERP)
 * implementam esta interface — nenhum módulo deve depender do formato de origem.
 */
export interface DataProvider {
  getLojas(): Promise<Loja[]>;
  getProdutos(): Promise<Produto[]>;
  getDesempenhoAtual(): Promise<PeriodoDesempenho>;
  getDesempenhoComparacao(): Promise<PeriodoDesempenho>;
}
