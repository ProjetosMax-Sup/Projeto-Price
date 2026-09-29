import { Semaforo } from "@/components/ui/Semaforo";
import type { Metricas } from "@/lib/desempenho/aggregate";
import { valoresDaLinha, type ColunaRenderizavel } from "@/lib/desempenho/colunas-configuradas";
import { calcDesvio, formatMoeda, formatPercent } from "@/lib/desempenho/format";
import type { ConfigRelatorio } from "@/lib/parametros/types";

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

/**
 * Três cards: a coluna marcada como **principal** em /parametros (a estrela na aba
 * Ativas) e as duas colunas seguintes da ordem configurada. É assim que o topo da
 * tela deixa de depender de "venda/lucro/% lucro" estarem escritos no código.
 */
export function KpiCards({
  atual,
  comparacao,
  config,
  colunas,
}: {
  atual: Metricas;
  comparacao: Metricas | null;
  config: ConfigRelatorio;
  colunas: ColunaRenderizavel[];
}) {
  const valoresAtual = valoresDaLinha(config, atual, comparacao);
  const refPrincipal = config.papeis?.principal;
  const principal = colunas.find((c) => c.ref === refPrincipal) ?? colunas[0];
  const demais = colunas.filter((c) => c.ref !== principal?.ref && !c.ehComparacao && !c.semaforo).slice(0, 2);
  const emDestaque = [principal, ...demais].filter((c): c is ColunaRenderizavel => Boolean(c));

  const formatar = (coluna: ColunaRenderizavel, valor: number | null) => {
    if (valor === null) return "—";
    return coluna.formato === "moeda" ? formatMoeda(valor) : formatPercent(valor);
  };

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {emDestaque.map((coluna) => {
        const valorAtual = valoresAtual[coluna.ref] ?? null;
        // Comparação do card: o mesmo valor no período anterior, avaliado pelo mesmo
        // caminho da tabela — sem fórmula paralela escrita à mão aqui.
        const valorComparacao = comparacao ? (valoresDaLinha(config, comparacao, null)[coluna.ref] ?? null) : null;
        const desvio =
          valorAtual !== null && valorComparacao !== null ? calcDesvio(valorAtual, valorComparacao) : null;
        return (
          <KpiCard
            key={coluna.ref}
            titulo={coluna.rotulo}
            valor={formatar(coluna, valorAtual)}
            desvio={desvio}
            linhaComparacao={
              valorComparacao !== null ? `vs. ${formatar(coluna, valorComparacao)} na comparação` : undefined
            }
          />
        );
      })}
    </div>
  );
}
