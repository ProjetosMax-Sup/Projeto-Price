import type { Loja, Produto, PeriodoDesempenho } from "@/lib/types";

/**
 * Abstração de leitura de dados do módulo Desempenho Comercial.
 * FileDataProvider (atual, TXT pipe-delimited) e ApiDataProvider (futuro, ERP)
 * implementam esta interface — nenhum módulo deve depender do formato de origem.
 */
export interface DataProvider {
  getLojas(): Promise<Loja[]>;
  getProdutos(): Promise<Produto[]>;
  /**
   * Todos os registros de movimento disponíveis (união de todos os arquivos
   * mensais `bd<Mês>.txt` encontrados) — não é mais um recorte pré-fatiado por
   * período. "Atual" e "Comparação" são só dois filtros de data escolhidos
   * pelo usuário sobre este mesmo conjunto (ver `lib/desempenho/consulta.ts`).
   */
  getDesempenho(): Promise<PeriodoDesempenho>;
}
