import { formatMoeda, formatPercent } from "@/lib/desempenho/format";
import type { ColunaRenderizavel } from "@/lib/desempenho/colunas-configuradas";
import type { ConfigRelatorio } from "@/lib/parametros/types";

/**
 * Espelho de KpiCardsEntradasSaidas.tsx — Compra, Venda e a coluna principal
 * (% Compra/Venda), sem período de Comparação.
 */
export function KpiCardsCompraVenda({
  kpi,
  config,
  colunas,
}: {
  kpi: Record<string, number | null>;
  config: ConfigRelatorio;
  colunas: ColunaRenderizavel[];
}) {
  const compra = colunas.find((c) => c.rotulo === "Compra");
  const venda = colunas.find((c) => c.rotulo === "Venda");
  const percCompraVenda = colunas.find((c) => c.rotulo === "% Compra/Venda");
  const principal = colunas.find((c) => c.ref === config.papeis?.principal) ?? colunas[0];
  const emDestaque = [compra, venda, percCompraVenda, principal].filter(
    (c, i, arr): c is ColunaRenderizavel => Boolean(c) && arr.findIndex((x) => x?.ref === c!.ref) === i,
  );

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {emDestaque.map((coluna) => {
        const valor = kpi[coluna.ref];
        const formatado =
          valor === null || valor === undefined
            ? "—"
            : coluna.formato === "percentual" || coluna.formato === "pontosPercentuais"
              ? formatPercent(valor)
              : formatMoeda(valor);
        return (
          <div key={coluna.ref} className="rounded-lg border border-zinc-200 border-t-4 border-t-azul bg-white px-5 py-4 shadow-sm">
            <div className="text-xs font-bold tracking-wide text-azul uppercase">{coluna.rotulo}</div>
            <div className="mt-1 font-display text-2xl font-bold tabular-nums text-zinc-900">{formatado}</div>
          </div>
        );
      })}
    </div>
  );
}
