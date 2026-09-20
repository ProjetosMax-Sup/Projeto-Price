import { criarCacheVersionado } from "./cache-versionado";
import { lerDataset, lerVersaoDataset } from "@/lib/desempenho/dataset-cache";
import type { DataProvider } from "./types";

/**
 * Lê o dataset já processado do Redis (escrito pelo cron diário — ver
 * app/api/cron/atualizar-dados). Requisições normais nunca tocam o OneDrive:
 * só leem esse cache, o que é rápido e não depende de instância "quente".
 */
const getDatasetCache = criarCacheVersionado(
  () => lerVersaoDataset().then((v) => v ?? "sem-dataset"),
  async () => {
    const dataset = await lerDataset();
    if (!dataset) throw new Error("Nenhum dataset em cache ainda — force uma atualização em /api/atualizar-dados.");
    return dataset;
  },
);

export function createCachedDataProvider(): DataProvider {
  return {
    async getLojas() {
      return (await getDatasetCache()).lojas;
    },
    async getProdutos() {
      return (await getDatasetCache()).produtos;
    },
    async getDesempenho() {
      const d = await getDatasetCache();
      return {
        registros: d.registros,
        produtosDescartados: d.produtosDescartados,
        produtosDescartadosCodigos: d.produtosDescartadosCodigos,
      };
    },
  };
}
