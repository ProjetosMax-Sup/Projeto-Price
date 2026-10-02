import { Semaforo } from "@/components/ui/Semaforo";
import type { ColunaRenderizavel } from "@/lib/desempenho/colunas-configuradas";
import { formatMoeda, formatPercent, formatPontosPercentuais } from "@/lib/desempenho/format";

/**
 * Escala divergente vermelho/verde pra "Meta - Realizado" (em p.p.): 0 é o
 * pivô (quase branco), ±20p.p. já satura na cor cheia. Sem amarelo — só os
 * dois matizes fixos, a intensidade (não o matiz) que cresce com a distância
 * do pivô. Não é semáforo (3 estados fixos) — aqui é contínuo.
 */
const HEATMAP_SATURACAO_PP = 20;
const HEATMAP_MATIZ_VERMELHO = 0;
const HEATMAP_MATIZ_VERDE = 120;

function corHeatmap(valor: number, invertido: boolean): string {
  const t = Math.max(-1, Math.min(1, valor / HEATMAP_SATURACAO_PP));
  const intensidade = Math.abs(t);
  // Padrão: positivo = verde, negativo = vermelho. Invertido: o oposto
  // (ex.: "Custo - Meta", onde passar da meta pra cima é ruim, não bom).
  const positivoEhVerde = !invertido;
  const ehVerde = t >= 0 ? positivoEhVerde : !positivoEhVerde;
  const matiz = ehVerde ? HEATMAP_MATIZ_VERDE : HEATMAP_MATIZ_VERMELHO;
  // Luminosidade: 90% (quase branco) no pivô até 60% (cor cheia) no extremo saturado.
  const luminosidade = 90 - intensidade * 30;
  return `hsl(${matiz}, 70%, ${luminosidade}%)`;
}

function formatar(valor: number, coluna: ColunaRenderizavel): string {
  const casas = coluna.casasDecimais;
  switch (coluna.formato) {
    case "moeda":
      return formatMoeda(valor, casas ?? 0);
    case "numero":
      return valor.toLocaleString("pt-BR", { minimumFractionDigits: casas ?? 0, maximumFractionDigits: casas ?? 2 });
    case "percentual":
      return formatPercent(valor, casas ?? 1);
    case "pontosPercentuais":
      return formatPontosPercentuais(valor, casas ?? 1);
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
        style={{ backgroundColor: corHeatmap(valor, coluna.heatmapInvertido) }}
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
