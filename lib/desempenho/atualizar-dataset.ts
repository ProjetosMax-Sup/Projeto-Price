import { createOneDriveDataProvider } from "@/lib/data-providers/onedrive-provider";
import { salvarDataset } from "./dataset-cache";

/** Busca tudo direto do OneDrive (lento) e grava o resultado processado no Redis. */
export async function atualizarDataset(): Promise<{ geradoEm: string; registros: number }> {
  const provider = createOneDriveDataProvider();
  const [lojas, produtos, desempenho] = await Promise.all([
    provider.getLojas(),
    provider.getProdutos(),
    provider.getDesempenho(),
  ]);

  const geradoEm = await salvarDataset({ lojas, produtos, desempenho });
  return { geradoEm, registros: desempenho.registros.length };
}
