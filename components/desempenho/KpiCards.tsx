import { Semaforo } from "@/components/ui/Semaforo";
import type { Metricas } from "@/lib/desempenho/aggregate";
import { calcDesvio, formatMoeda, formatPercent } from "@/lib/desempenho/format";

function KpiCard({
  titulo,
  valor,
  desvio,
}: {
  titulo: string;
  valor: string;
  desvio: number | null;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-5 py-4">
      <div className="text-sm font-medium text-zinc-500">{titulo}</div>
      <div className="mt-1 flex items-baseline gap-3">
        <span className="font-display text-2xl font-bold tabular-nums text-zinc-900">{valor}</span>
        <Semaforo valor={desvio} />
      </div>
    </div>
  );
}

export function KpiCards({
  atual,
  comparacao,
}: {
  atual: Metricas;
  comparacao: Metricas | null;
}) {
  const desvioVenda = comparacao ? calcDesvio(atual.venda, comparacao.venda) : null;
  const desvioLucro = comparacao ? calcDesvio(atual.lucro, comparacao.lucro) : null;
  const desvioPercLucro = comparacao ? atual.percLucro - comparacao.percLucro : null;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <KpiCard titulo="Venda" valor={formatMoeda(atual.venda)} desvio={desvioVenda} />
      <KpiCard titulo="Lucro" valor={formatMoeda(atual.lucro)} desvio={desvioLucro} />
      <KpiCard titulo="% Lucro" valor={formatPercent(atual.percLucro)} desvio={desvioPercLucro} />
    </div>
  );
}
