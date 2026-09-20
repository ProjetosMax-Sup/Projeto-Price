import type { DataProvider } from "./types";

/**
 * Tenta o provider principal (cache no Redis); se falhar (ainda não tem
 * dataset, Redis fora do ar etc.), cai pro provider de reserva (OneDrive
 * direto — mais lento, mas funciona) em vez de quebrar a página.
 */
export function createResilientProvider(principal: DataProvider, reserva: DataProvider): DataProvider {
  async function comFallback<T>(chamar: (p: DataProvider) => Promise<T>): Promise<T> {
    try {
      return await chamar(principal);
    } catch (erro) {
      console.error("Cache do dataset indisponível, lendo direto do OneDrive:", erro);
      return chamar(reserva);
    }
  }

  return {
    getLojas: () => comFallback((p) => p.getLojas()),
    getProdutos: () => comFallback((p) => p.getProdutos()),
    getDesempenho: () => comFallback((p) => p.getDesempenho()),
  };
}
