import { DESEMPENHO_COMERCIAL_DATA_DIR } from "@/config/data-sources";
import { onedriveConfigurado } from "@/config/onedrive";
import { createFileDataProvider } from "./file-provider";
import { createMockDataProvider } from "./mock-provider";
import { createOneDriveDataProvider } from "./onedrive-provider";
import type { DataProvider } from "./types";

/**
 * Ordem de prioridade:
 * 1. OneDrive via Microsoft Graph (produção/Vercel — MICROSOFT_CLIENT_ID configurado)
 * 2. Pasta local (desenvolvimento — DESEMPENHO_COMERCIAL_DATA_DIR configurado)
 * 3. Dataset de exemplo (fallback, sem nenhuma das duas env vars acima)
 */
export function getDataProvider(): DataProvider {
  if (onedriveConfigurado()) {
    return createOneDriveDataProvider();
  }
  if (DESEMPENHO_COMERCIAL_DATA_DIR) {
    return createFileDataProvider();
  }
  return createMockDataProvider();
}

export type { DataProvider } from "./types";
