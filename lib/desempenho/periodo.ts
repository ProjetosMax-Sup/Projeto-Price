import Redis from "ioredis";
import type { RegistroDesempenho } from "@/lib/types";

const MESES = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

/** "DD/MM/AA" → Date (ano assumido 20XX). */
function parseDataBr(data: string): Date | null {
  const m = data.match(/^(\d{2})\/(\d{2})\/(\d{2})$/);
  if (!m) return null;
  const [, dia, mes, ano] = m;
  return new Date(2000 + Number(ano), Number(mes) - 1, Number(dia));
}

/**
 * Rótulo do período atual, derivado direto das datas em
 * bdDesempenhoComercialAtual.txt (único arquivo com grão diário). Ex: "1–16 Set/2026".
 */
export function calcularLabelPeriodoAtual(registros: RegistroDesempenho[]): string | null {
  let min: Date | null = null;
  let max: Date | null = null;
  for (const r of registros) {
    const d = parseDataBr(r.movimento.data);
    if (!d) continue;
    if (!min || d < min) min = d;
    if (!max || d > max) max = d;
  }
  if (!min || !max) return null;

  const mesAno = `${MESES[max.getMonth()]}/${max.getFullYear()}`;
  if (min.getMonth() === max.getMonth() && min.getFullYear() === max.getFullYear()) {
    return min.getDate() === max.getDate() ? `${min.getDate()} ${mesAno}` : `${min.getDate()}–${max.getDate()} ${mesAno}`;
  }
  return `${min.getDate()} ${MESES[min.getMonth()]}–${max.getDate()} ${mesAno}`;
}

// bdDesempenhoComercialComparação.txt não tem coluna de data (vem já agregado
// pro período inteiro) — não dá pra derivar do arquivo, por isso é configurável
// manualmente (usuário informa o que aquele arquivo representa).
const CHAVE_LABEL_COMPARACAO = "config:periodo_comparacao";

function obterCliente(): Redis | null {
  const url = process.env.REDIS_URL;
  return url ? new Redis(url) : null;
}

export async function lerLabelPeriodoComparacao(): Promise<string | null> {
  const cliente = obterCliente();
  if (!cliente) return null;
  try {
    return await cliente.get(CHAVE_LABEL_COMPARACAO);
  } finally {
    cliente.disconnect();
  }
}

export async function salvarLabelPeriodoComparacao(valor: string): Promise<void> {
  const cliente = obterCliente();
  if (!cliente) throw new Error("Redis não configurado (REDIS_URL).");
  try {
    await cliente.set(CHAVE_LABEL_COMPARACAO, valor);
  } finally {
    cliente.disconnect();
  }
}
