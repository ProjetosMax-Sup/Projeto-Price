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
