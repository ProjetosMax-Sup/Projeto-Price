import type { RegistroDesempenho } from "@/lib/types";
import { formatPeriodo } from "./format";

/** "DD/MM/AA" → Date (ano assumido 20XX). */
function parseDataBr(data: string): Date | null {
  const m = data.match(/^(\d{2})\/(\d{2})\/(\d{2})$/);
  if (!m) return null;
  const [, dia, mes, ano] = m;
  return new Date(2000 + Number(ano), Number(mes) - 1, Number(dia));
}

/**
 * Rótulo de um período (Atual ou Comparação), derivado direto do min/máx da
 * coluna `Data` do arquivo correspondente. Ex: "01 a 16/Set 2026".
 */
export function calcularLabelPeriodo(registros: RegistroDesempenho[]): string | null {
  let min: Date | null = null;
  let max: Date | null = null;
  for (const r of registros) {
    const d = parseDataBr(r.movimento.data);
    if (!d) continue;
    if (!min || d < min) min = d;
    if (!max || d > max) max = d;
  }
  if (!min || !max) return null;
  return formatPeriodo(min, max);
}
