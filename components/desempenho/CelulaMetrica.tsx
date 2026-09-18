import { Semaforo } from "@/components/ui/Semaforo";
import type { Metricas } from "@/lib/desempenho/aggregate";
import { tipoColuna, valorColunaMetrica, type ColunaMetrica } from "@/lib/desempenho/colunas-tabela";
import { formatMoeda, formatPercent } from "@/lib/desempenho/format";

export function CelulaMetrica({
  atual,
  comparacao,
  coluna,
}: {
  atual: Metricas;
  comparacao: Metricas | null;
  coluna: ColunaMetrica;
}) {
  const valor = valorColunaMetrica(atual, comparacao, coluna);
  const tipo = tipoColuna(coluna);

  if (tipo === "desvio") {
    return (
      <td className="px-3 py-2 text-right">
        <Semaforo valor={valor} tamanho="sm" />
      </td>
    );
  }
  if (valor === null) {
    return <td className="px-3 py-2 text-right tabular-nums text-zinc-400">—</td>;
  }
  return (
    <td className="px-3 py-2 text-right tabular-nums text-zinc-700">
      {tipo === "moeda" ? formatMoeda(valor) : formatPercent(valor)}
    </td>
  );
}
