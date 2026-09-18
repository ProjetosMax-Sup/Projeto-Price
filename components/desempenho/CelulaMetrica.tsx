import { Semaforo } from "@/components/ui/Semaforo";
import type { Metricas } from "@/lib/desempenho/aggregate";
import { ehColunaComparacao, tipoColuna, valorColunaMetrica, type ColunaMetrica } from "@/lib/desempenho/colunas-tabela";
import { formatMoeda, formatPercent } from "@/lib/desempenho/format";

export function CelulaMetrica({
  atual,
  comparacao,
  coluna,
  enfase = false,
}: {
  atual: Metricas;
  comparacao: Metricas | null;
  coluna: ColunaMetrica;
  /** Linha de subtotal — número em destaque (azul, negrito) em vez do cinza padrão. */
  enfase?: boolean;
}) {
  const valor = valorColunaMetrica(atual, comparacao, coluna);
  const tipo = tipoColuna(coluna);
  // Valores de Comparação ganham fundo levemente sombreado + itálico, pra não
  // confundir com os valores do período Atual ao correr o olho pela tabela.
  const ehComparacao = ehColunaComparacao(coluna);
  const fundoComparacao = ehComparacao ? "bg-zinc-500/5 italic" : "";

  if (tipo === "desvio") {
    return (
      <td className="px-3 py-2 text-right whitespace-nowrap">
        <Semaforo valor={valor} tamanho="sm" />
      </td>
    );
  }
  if (valor === null) {
    return (
      <td className={`px-3 py-2 text-right tabular-nums whitespace-nowrap ${fundoComparacao} ${enfase ? "text-azul/40" : "text-zinc-400"}`}>
        —
      </td>
    );
  }
  return (
    <td
      className={`px-3 py-2 text-right tabular-nums whitespace-nowrap ${fundoComparacao} ${enfase ? "font-semibold text-azul" : ehComparacao ? "text-zinc-500" : "text-zinc-700"}`}
    >
      {tipo === "moeda" ? formatMoeda(valor) : formatPercent(valor)}
    </td>
  );
}
