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

/** "DD a DD/MMM" (ou só "DD/MMM" quando início = fim) — formato fixo pros períodos Atual/Comparação. */
export function formatPeriodo(inicio: Date, fim: Date): string {
  const diaIni = String(inicio.getDate()).padStart(2, "0");
  const diaFim = String(fim.getDate()).padStart(2, "0");
  const mes = MESES[fim.getMonth()];
  return diaIni === diaFim ? `${diaFim}/${mes}` : `${diaIni} a ${diaFim}/${mes}`;
}
