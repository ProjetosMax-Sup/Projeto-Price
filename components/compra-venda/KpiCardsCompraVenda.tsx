import { colunasKpi, formatarColuna, type ColunaRenderizavel } from "@/lib/desempenho/colunas-configuradas";
import type { ConfigRelatorio } from "@/lib/parametros/types";

/**
 * Cards de KPI — colunas marcadas com "Destacar no card" na aba Ativas
 * (`config.destaquesKpi`), ou, sem nada marcado ainda, a coluna principal + as
 * duas seguintes da ordem (ver `colunasKpi`). Sempre por ref/id, nunca por
 * rótulo — é o bug que fazia o card sumir ao renomear uma coluna (ex.: "Compra").
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
  const emDestaque = colunasKpi(config, colunas);

  return (
    <div className="grid grid-cols-1 gap-3 sm:[grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
      {emDestaque.map((coluna) => (
        <div key={coluna.ref} className="rounded-lg border border-zinc-200 border-t-4 border-t-azul bg-white px-5 py-4 shadow-sm">
          <div className="text-xs font-bold tracking-wide text-azul uppercase">{coluna.rotulo}</div>
          <div className="mt-1 font-display text-2xl font-bold tabular-nums text-zinc-900">{formatarColuna(coluna, kpi[coluna.ref])}</div>
        </div>
      ))}
    </div>
  );
}
