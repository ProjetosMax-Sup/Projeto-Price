import { formatMoeda } from "@/lib/desempenho/format";
import type { ColunaRenderizavel } from "@/lib/desempenho/colunas-configuradas";
import type { ConfigRelatorio } from "@/lib/parametros/types";

/**
 * Três cards: a coluna principal (Saldo, marcada em Parâmetros) + Entradas
 * Totais + Saídas Totais, se existirem no relatório — sem comparação de
 * período (decisão de 2026-09-30, diferente do Desempenho Comercial).
 */
export function KpiCardsEntradasSaidas({
  kpi,
  config,
  colunas,
}: {
  kpi: Record<string, number | null>;
  config: ConfigRelatorio;
  colunas: ColunaRenderizavel[];
}) {
  const principal = colunas.find((c) => c.ref === config.papeis?.principal) ?? colunas[0];
  const entradas = colunas.find((c) => c.rotulo.includes("Entradas Totais"));
  const saidas = colunas.find((c) => c.rotulo.includes("Saídas Totais"));
  const emDestaque = [entradas, saidas, principal].filter(
    (c, i, arr): c is ColunaRenderizavel => Boolean(c) && arr.findIndex((x) => x?.ref === c!.ref) === i,
  );

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {emDestaque.map((coluna) => {
        const valor = kpi[coluna.ref];
        return (
          <div key={coluna.ref} className="rounded-lg border border-zinc-200 border-t-4 border-t-azul bg-white px-5 py-4 shadow-sm">
            <div className="text-xs font-bold tracking-wide text-azul uppercase">{coluna.rotulo}</div>
            <div className="mt-1 font-display text-2xl font-bold tabular-nums text-zinc-900">
              {valor === null || valor === undefined ? "—" : formatMoeda(valor)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
