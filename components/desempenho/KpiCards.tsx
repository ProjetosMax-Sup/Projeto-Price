import { Semaforo } from "@/components/ui/Semaforo";
import type { Metricas } from "@/lib/desempenho/aggregate";
import { colunasKpi, formatarColuna, valoresDaLinha, type ColunaRenderizavel } from "@/lib/desempenho/colunas-configuradas";
import { calcDesvio } from "@/lib/desempenho/format";
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
 * Cards de KPI — colunas marcadas com "Destacar no card" na aba Ativas
 * (`config.destaquesKpi`), ou, sem nada marcado ainda, a coluna **principal** +
 * as duas seguintes da ordem configurada (ver `colunasKpi`). Sempre por ref/id,
 * nunca por nome — é o que faz o topo da tela nunca depender de "venda/lucro/%
 * lucro" estarem escritos no código, nem sumir quando alguém renomeia a coluna.
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
  const emDestaque = colunasKpi(config, colunas);

  return (
    <div className="grid grid-cols-1 gap-3 sm:[grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
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
            valor={formatarColuna(coluna, valorAtual)}
            desvio={desvio}
            linhaComparacao={
              valorComparacao !== null ? `vs. ${formatarColuna(coluna, valorComparacao)} na comparação` : undefined
            }
          />
        );
      })}
    </div>
  );
}
