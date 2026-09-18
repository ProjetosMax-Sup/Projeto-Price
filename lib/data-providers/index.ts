import { DESEMPENHO_COMERCIAL_DATA_DIR } from "@/config/data-sources";
import { onedriveConfigurado } from "@/config/onedrive";
import { createCachedDataProvider } from "./cached-provider";
import { createFileDataProvider } from "./file-provider";
import { createMockDataProvider } from "./mock-provider";
import { createOneDriveDataProvider } from "./onedrive-provider";
import { createResilientProvider } from "./resilient-provider";
import type { DataProvider } from "./types";

/**
 * Ordem de prioridade:
 * 1. Dataset em cache no Redis (produção — atualizado 1x/dia via cron, ver
 *    app/api/cron/atualizar-dados), com fallback automático pro OneDrive
 *    direto se o cache ainda não existir.
 * 2. Pasta local (desenvolvimento — DESEMPENHO_COMERCIAL_DATA_DIR configurado)
 * 3. Dataset de exemplo (fallback, sem nenhuma fonte configurada)
 */
export function getDataProvider(): DataProvider {
  if (onedriveConfigurado()) {
    const oneDrive = createOneDriveDataProvider();
    return process.env.REDIS_URL ? createResilientProvider(createCachedDataProvider(), oneDrive) : oneDrive;
  }
  if (DESEMPENHO_COMERCIAL_DATA_DIR) {
    return createFileDataProvider();
  }
  return createMockDataProvider();
}

export type { DataProvider } from "./types";
