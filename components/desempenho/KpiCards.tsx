import { Semaforo } from "@/components/ui/Semaforo";
import type { Metricas } from "@/lib/desempenho/aggregate";
import { calcDesvio, formatMoeda, formatPercent } from "@/lib/desempenho/format";

function KpiCard({
  titulo,
  valor,
  desvio,
  linhaComparacao,
  linhaDetalhe,
}: {
  titulo: string;
  valor: string;
  desvio: number | null;
  linhaComparacao?: string;
  linhaDetalhe?: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 border-t-4 border-t-azul bg-white px-5 py-4 shadow-sm">
      <div className="text-xs font-bold tracking-wide text-azul uppercase">{titulo}</div>
      <div className="mt-1 flex items-baseline gap-3">
        <span className="font-display text-2xl font-bold tabular-nums text-zinc-900">{valor}</span>
        <Semaforo valor={desvio} />
      </div>
      {linhaComparacao && <div className="mt-1 text-xs text-zinc-400">{linhaComparacao}</div>}
      {linhaDetalhe && <div className="mt-1.5 border-t border-zinc-100 pt-1.5 text-xs text-zinc-500">{linhaDetalhe}</div>}
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

  const percRegularVenda = atual.venda !== 0 ? (atual.vendaRegular / atual.venda) * 100 : 0;
  const percOfertaVenda = atual.venda !== 0 ? (atual.vendaOferta / atual.venda) * 100 : 0;
  const percRegularLucro = atual.lucro !== 0 ? (atual.lucroRegular / atual.lucro) * 100 : 0;
  const percOfertaLucro = atual.lucro !== 0 ? (atual.lucroOferta / atual.lucro) * 100 : 0;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <KpiCard
        titulo="Venda"
        valor={formatMoeda(atual.venda)}
        desvio={desvioVenda}
        linhaComparacao={comparacao ? `vs. ${formatMoeda(comparacao.venda)} na comparação` : undefined}
        linhaDetalhe={`Regular ${formatMoeda(atual.vendaRegular)} (${formatPercent(percRegularVenda, 0)}) · Oferta ${formatMoeda(atual.vendaOferta)} (${formatPercent(percOfertaVenda, 0)})`}
      />
      <KpiCard
        titulo="Lucro"
        valor={formatMoeda(atual.lucro)}
        desvio={desvioLucro}
        linhaComparacao={comparacao ? `vs. ${formatMoeda(comparacao.lucro)} na comparação` : undefined}
        linhaDetalhe={`Regular ${formatMoeda(atual.lucroRegular)} (${formatPercent(percRegularLucro, 0)}) · Oferta ${formatMoeda(atual.lucroOferta)} (${formatPercent(percOfertaLucro, 0)})`}
      />
      <KpiCard
        titulo="% Lucro"
        valor={formatPercent(atual.percLucro)}
        desvio={desvioPercLucro}
        linhaComparacao={comparacao ? `vs. ${formatPercent(comparacao.percLucro)} na comparação` : undefined}
        linhaDetalhe="Desvio em pontos percentuais"
      />
    </div>
  );
}
