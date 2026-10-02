import { avaliarColunas, formatoDaCalculada, type ValoresNativos } from "@/lib/parametros/avaliador";
import { ordemAtivasEfetiva, rotuloDaColuna } from "@/lib/parametros/colunas-relatorio";
import type { ColunaNativa, ConfigRelatorio, FormatoColuna } from "@/lib/parametros/types";
import type { Metricas } from "./aggregate";

/**
 * Ponte entre a configuração de Parâmetros e a tabela do Desempenho Comercial:
 * transforma `ordemAtivas` na lista de colunas que a tela desenha, e as métricas
 * agregadas nos valores de cada célula (via `lib/parametros/avaliador.ts`).
 *
 * Substitui a lista fixa que existia em `colunas-tabela.ts` — que continua no
 * projeto só como oráculo de regressão (ver `app/api/verificar-avaliador`).
 */

export interface ColunaRenderizavel {
  /** Ref de nativa ou id de calculada — é a chave do valor avaliado e da ordenação. */
  ref: string;
  rotulo: string;
  formato: FormatoColuna;
  /** `undefined` = usa o padrão de `CelulaMetrica.tsx` pro formato (0 moeda/número, 1 percentual). */
  casasDecimais?: number;
  largura: number;
  /** Desvio e diferença em p.p. aparecem como semáforo colorido, não como número solto. */
  semaforo: boolean;
  /** Valor do período de Comparação — fundo sombreado + itálico, pra não confundir com o Atual. */
  ehComparacao: boolean;
  /** "Meta - Realizado" e afins: fundo em escala vermelho→verde pelo valor, em vez de texto cinza. */
  heatmap: boolean;
  /** Troca o sentido da escala do heatmap (verde→vermelho pelo valor) — ver `ColunaCalculada` tipo "diferenca". */
  heatmapInvertido: boolean;
}

/** Larguras herdadas do layout aprovado (antes fixas em `colunas-tabela.ts`). */
const LARGURA_POR_FORMATO: Record<FormatoColuna, number> = {
  moeda: 110,
  percentual: 84,
  numero: 96,
  pontosPercentuais: 76,
};
const LARGURA_SEMAFORO = 76;
const LARGURA_MAXIMA_POR_ROTULO = 220;

/**
 * Largura mínima pro CABEÇALHO caber sem invadir a coluna vizinha. Nome de
 * calculada é texto livre (quem monta o relatório escolhe) — "GAP R$" cabe nos
 * 76-110px do formato, mas "% Compra/Venda" não. O cabeçalho já quebra linha
 * (`leading-tight`, sem `whitespace-nowrap`) nos espaços do rótulo, então só a
 * MAIOR PALAVRA precisa caber numa linha — dimensionar pelo rótulo inteiro
 * deixava "Meta - Realizado" bem mais largo do que precisava (3 palavras
 * curtas, nunca ficam juntas na mesma linha). ~6,8px por caractere é o que o
 * cabeçalho (13px, uppercase, bold) ocupa na prática; +22 cobre o padding
 * horizontal (px-2) e a seta de ordenação ao lado.
 */
function larguraParaRotulo(rotulo: string, larguraFormato: number): number {
  const maiorPalavra = Math.max(...rotulo.split(" ").map((p) => p.length));
  const estimativa = Math.ceil(maiorPalavra * 6.8) + 22;
  return Math.min(Math.max(larguraFormato, estimativa), LARGURA_MAXIMA_POR_ROTULO);
}

/** Largura (px) da 1ª coluna (nome) e da última ("Part."). 280 porque a linha de Loja tem
 * código + nome + badge de formato na mesma célula truncada (ver docs/padroes-ux.md). */
export const LARGURA_COLUNA_NOME = 280;
export const LARGURA_COLUNA_PART = 64;

export function colunasDoRelatorio(config: ConfigRelatorio, dicionario: ColunaNativa[]): ColunaRenderizavel[] {
  const nativaPorRef = new Map(dicionario.map((c) => [c.ref, c]));
  const calculadaPorId = new Map(config.calculadas.map((c) => [c.id, c]));

  return ordemAtivasEfetiva(config).map((ref): ColunaRenderizavel => {
    const calculada = calculadaPorId.get(ref);
    if (!calculada) {
      const rotulo = rotuloDaColuna(ref, config, dicionario);
      const nativa = nativaPorRef.get(ref);
      const formato = nativa?.formato ?? "moeda";
      return {
        ref,
        rotulo,
        formato,
        largura: larguraParaRotulo(rotulo, LARGURA_POR_FORMATO[formato]),
        casasDecimais: undefined,
        semaforo: false,
        ehComparacao: false,
        heatmap: false,
        heatmapInvertido: false,
      };
    }
    const formato = formatoDaCalculada(calculada);
    const semaforo = calculada.tipo === "desvio" || calculada.tipo === "difPP";
    return {
      ref,
      rotulo: calculada.nome,
      formato,
      casasDecimais: calculada.casasDecimais,
      largura: semaforo ? LARGURA_SEMAFORO : larguraParaRotulo(calculada.nome, LARGURA_POR_FORMATO[formato]),
      semaforo,
      ehComparacao: calculada.tipo === "valorDoPeriodo" && calculada.periodo === "comparacao",
      heatmap: (calculada.tipo === "diferenca" || calculada.tipo === "formula") && calculada.heatmap === true,
      heatmapInvertido: (calculada.tipo === "diferenca" || calculada.tipo === "formula") && calculada.heatmapInvertido === true,
    };
  });
}

/**
 * Sem isso, `table-fixed` + `width: 100%` espreme a coluna de nome até truncar quando
 * as métricas já ocupam mais que o painel, em vez de deixar o container rolar.
 */
export function larguraMinimaTabela(colunas: ColunaRenderizavel[]): number {
  return LARGURA_COLUNA_NOME + colunas.reduce((soma, c) => soma + c.largura, 0) + LARGURA_COLUNA_PART;
}

/**
 * As métricas agregadas do Desempenho Comercial já SÃO a soma das colunas nativas
 * que ele usa — aqui é só renomear pros refs do Dicionário, que é a linguagem do
 * avaliador. Quando o parser passar a extrair mais colunas do arquivo (necessário
 * pro Entradas e Saídas), é este mapa que cresce.
 */
export function nativasDeMetricas(m: Metricas): ValoresNativos {
  return {
    Valor: m.venda,
    Lucros: m.lucro,
    "Vendas Oferta": m.vendaOferta,
    "Lucros Oferta": m.lucroOferta,
  };
}

/** Valores de todas as colunas de uma linha, prontos pra exibir e pra ordenar. */
export function valoresDaLinha(
  config: ConfigRelatorio,
  atual: Metricas,
  comparacao: Metricas | null,
): Record<string, number | null> {
  return avaliarColunas(config, {
    atual: nativasDeMetricas(atual),
    comparacao: comparacao ? nativasDeMetricas(comparacao) : null,
  });
}

/**
 * Colunas que viram card de KPI no topo da tela (botão "Destacar no card" na aba
 * Ativas, `config.destaquesKpi`). Sem nada marcado, cai no padrão de sempre
 * (principal + as duas colunas seguintes da ordem, sem comparação nem semáforo) —
 * nenhum módulo fica sem card só porque ainda não configurou nada. Usar sempre
 * ref/id (nunca o rótulo) é o que faz renomear uma coluna nunca derrubar o card.
 */
export function colunasKpi(config: ConfigRelatorio, colunas: ColunaRenderizavel[]): ColunaRenderizavel[] {
  if (config.destaquesKpi && config.destaquesKpi.length > 0) {
    const porRef = new Map(colunas.map((c) => [c.ref, c]));
    return config.destaquesKpi.map((ref) => porRef.get(ref)).filter((c): c is ColunaRenderizavel => Boolean(c));
  }
  const principal = colunas.find((c) => c.ref === config.papeis?.principal) ?? colunas[0];
  const demais = colunas.filter((c) => c.ref !== principal?.ref && !c.ehComparacao && !c.semaforo).slice(0, 2);
  return [principal, ...demais].filter((c): c is ColunaRenderizavel => Boolean(c));
}

/**
 * Valor da coluna marcada como principal (a estrela na aba Ativas) — é o que
 * alimenta ranking, barra de proporção e a coluna "Part.". Sem principal definida,
 * cai na primeira coluna ativa, pra tela nunca ficar sem referência.
 */
export function valorPrincipal(
  config: ConfigRelatorio,
  valores: Record<string, number | null>,
  colunas: ColunaRenderizavel[],
): number {
  const ref = config.papeis?.principal ?? colunas[0]?.ref;
  return (ref ? valores[ref] : null) ?? 0;
}
