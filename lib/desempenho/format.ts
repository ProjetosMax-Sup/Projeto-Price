export function formatMoeda(valor: number): string {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

/** Valores tipicamente pequenos (ex: ticket médio) precisam de casas decimais. */
export function formatMoedaDetalhada(valor: number): string {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatPercent(valor: number, casas = 1): string {
  return `${valor.toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  })}%`;
}

/** Diferença entre dois percentuais (pontos percentuais) — não é uma variação %, então usa "pp". */
export function formatPontosPercentuais(valor: number, casas = 1): string {
  return `${valor.toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  })} pp`;
}

export function formatNumero(valor: number): string {
  return valor.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

/** %Desvio entre atual e comparação. null quando não há base de comparação. */
/**
 * Variação percentual entre os dois períodos. Divide pelo **módulo** da base: com
 * base negativa (departamento que fechou o período anterior no prejuízo), dividir
 * pelo valor com sinal inverte a leitura — sair de −100 pra −50 é melhora, mas
 * apareceria como −50%. Corrigido em 2026-09-29; antes usava o valor com sinal.
 *
 * Base zero não é 0%: é "não há com o que comparar" (`null` → célula vazia), a
 * menos que o atual também seja zero.
 */
export function calcDesvio(atual: number, comparacao: number): number | null {
  if (comparacao === 0) return atual === 0 ? 0 : null;
  return ((atual - comparacao) / Math.abs(comparacao)) * 100;
}

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

/** "DD a DD/MMM AAAA" (ou só "DD/MMM AAAA" quando início = fim) — formato fixo pros períodos Atual/Comparação. */
export function formatPeriodo(inicio: Date, fim: Date): string {
  const diaIni = String(inicio.getDate()).padStart(2, "0");
  const diaFim = String(fim.getDate()).padStart(2, "0");
  const mes = MESES[fim.getMonth()];
  const ano = fim.getFullYear();
  return diaIni === diaFim ? `${diaFim}/${mes} ${ano}` : `${diaIni} a ${diaFim}/${mes} ${ano}`;
}
