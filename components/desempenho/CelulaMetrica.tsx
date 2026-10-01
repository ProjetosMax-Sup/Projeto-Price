import { Semaforo } from "@/components/ui/Semaforo";
import type { ColunaRenderizavel } from "@/lib/desempenho/colunas-configuradas";
import { formatMoeda, formatPercent } from "@/lib/desempenho/format";

/**
 * Escala divergente vermelho→amarelo→verde pra "Meta - Realizado" (em p.p.):
 * 0 é o pivô (amarelo pálido), ±20p.p. já satura na cor cheia. Não é semáforo
 * (3 estados fixos) — aqui a intensidade cresce com a distância da meta.
 */
const HEATMAP_SATURACAO_PP = 20;

function corHeatmap(valor: number): string {
  const t = Math.max(-1, Math.min(1, valor / HEATMAP_SATURACAO_PP));
  // Matiz: 0 (vermelho) até 120 (verde), passando por 60 (amarelo) no pivô.
  const matiz = 60 + t * 60;
  return `hsl(${matiz}, 75%, 88%)`;
}

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
  if (coluna.heatmap) {
    return (
      <td
        className="px-3 py-2 text-right tabular-nums whitespace-nowrap text-zinc-800"
        style={{ backgroundColor: corHeatmap(valor) }}
      >
        {formatar(valor, coluna)}
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
