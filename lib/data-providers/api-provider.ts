import type { DataProvider } from "./types";

/**
 * Placeholder para quando a fonte de dados migrar de arquivos TXT para a API
 * do ERP. Nenhum módulo deve depender diretamente de FileDataProvider ou
 * ApiDataProvider — sempre programar contra a interface DataProvider.
 */
export function createApiDataProvider(): DataProvider {
  throw new Error("ApiDataProvider ainda não implementado — fase atual usa FileDataProvider.");
}
