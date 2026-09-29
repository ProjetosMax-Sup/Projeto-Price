import { Semaforo } from "@/components/ui/Semaforo";
import type { ColunaRenderizavel } from "@/lib/desempenho/colunas-configuradas";
import { formatMoeda, formatPercent } from "@/lib/desempenho/format";

function formatar(valor: number, coluna: ColunaRenderizavel): string {
  switch (coluna.formato) {
    case "moeda":
      return formatMoeda(valor);
    case "numero":
      return valor.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
    case "percentual":
    case "pontosPercentuais":
      return formatPercent(valor);
  }
}

export function CelulaMetrica({
  coluna,
  valor,
  enfase = false,
}: {
  coluna: ColunaRenderizavel;
  valor: number | null;
  /** Linha de subtotal — número em destaque (azul, negrito) em vez do cinza padrão. */
  enfase?: boolean;
}) {
  // Valores de Comparação ganham fundo levemente sombreado + itálico, pra não
  // confundir com os valores do período Atual ao correr o olho pela tabela.
  const fundoComparacao = coluna.ehComparacao ? "bg-zinc-500/5 italic" : "";

  if (coluna.semaforo) {
    return (
      <td className="px-3 py-2 text-right whitespace-nowrap">
        <Semaforo valor={valor} tamanho="sm" unidade={coluna.formato === "pontosPercentuais" ? "pp" : "percent"} />
      </td>
    );
  }
  if (valor === null) {
    return (
      <td
        className={`px-3 py-2 text-right tabular-nums whitespace-nowrap ${fundoComparacao} ${enfase ? "text-azul/40" : "text-zinc-400"}`}
      >
        —
      </td>
    );
  }
  return (
    <td
      className={`px-3 py-2 text-right tabular-nums whitespace-nowrap ${fundoComparacao} ${enfase ? "font-semibold text-azul" : coluna.ehComparacao ? "text-zinc-500" : "text-zinc-700"}`}
    >
      {formatar(valor, coluna)}
    </td>
  );
}
