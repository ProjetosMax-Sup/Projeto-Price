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

export function formatNumero(valor: number): string {
  return valor.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

/** %Desvio entre atual e comparação. null quando não há base de comparação. */
export function calcDesvio(atual: number, comparacao: number): number | null {
  if (comparacao === 0) return atual === 0 ? 0 : null;
  return ((atual - comparacao) / comparacao) * 100;
}

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

/** "DD/MMM/AAAA", ex: "16/Set/2026". */
export function formatDataBr(data: Date): string {
  const dia = String(data.getDate()).padStart(2, "0");
  return `${dia}/${MESES[data.getMonth()]}/${data.getFullYear()}`;
}

/** "DD/MMM/AAAA – DD/MMM/AAAA" (ou só uma data quando início = fim). */
export function formatPeriodo(inicio: Date, fim: Date): string {
  const dIni = formatDataBr(inicio);
  const dFim = formatDataBr(fim);
  return dIni === dFim ? dIni : `${dIni} – ${dFim}`;
}
