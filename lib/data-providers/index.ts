import { DESEMPENHO_COMERCIAL_DATA_DIR } from "@/config/data-sources";
import { createFileDataProvider } from "./file-provider";
import { createMockDataProvider } from "./mock-provider";
import type { DataProvider } from "./types";

/**
 * Enquanto DESEMPENHO_COMERCIAL_DATA_DIR não estiver configurado (.env.local),
 * usa dataset de exemplo para permitir desenvolver a UI sem os arquivos reais.
 */
export function getDataProvider(): DataProvider {
  if (DESEMPENHO_COMERCIAL_DATA_DIR) {
    return createFileDataProvider();
  }
  return createMockDataProvider();
}

export type { DataProvider } from "./types";
