import type { RegistroDesempenho } from "@/lib/types";

/** "DD/MM/AA" → Date (ano assumido 20XX, meia-noite local). */
export function parseDataBr(data: string): Date | null {
  const m = data.match(/^(\d{2})\/(\d{2})\/(\d{2})$/);
  if (!m) return null;
  const [, dia, mes, ano] = m;
  return new Date(2000 + Number(ano), Number(mes) - 1, Number(dia));
}

/**
 * Date → "AAAA-MM-DD", montado a partir dos componentes locais (getFullYear/getMonth/getDate).
 * Nunca usar `.toISOString()` aqui — é UTC e pode deslocar o dia dependendo do fuso do servidor.
 */
function dataParaIso(d: Date): string {
  const ano = String(d.getFullYear()).padStart(4, "0");
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

/** "DD/MM/AA" → "AAAA-MM-DD". */
export function dataBrParaIso(data: string): string | null {
  const d = parseDataBr(data);
  return d ? dataParaIso(d) : null;
}

/**
 * "AAAA-MM-DD" → Date (meia-noite local). Nunca usar `new Date(iso)` direto pra esse fim — uma
 * string ISO de só-data é interpretada como UTC pelo spec, o que quebraria a comparação com as
 * datas locais vindas de `parseDataBr`.
 */
export function isoParaDataLocal(iso: string): Date | null {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const [, ano, mes, dia] = m;
  return new Date(Number(ano), Number(mes) - 1, Number(dia));
}

/**
 * Confere se dia/mês/ano formam uma data de calendário real — o `Date` do JS rola datas
 * inválidas silenciosamente (ex: 30/Fev vira 2 de março) em vez de sinalizar erro.
 */
export function dataValida(dia: number, mes: number, ano: number): boolean {
  const d = new Date(ano, mes - 1, dia);
  return d.getFullYear() === ano && d.getMonth() === mes - 1 && d.getDate() === dia;
}

/** Quantidade de dias do mês (1-12), já tratando ano bissexto nativamente. */
export function diasNoMes(mes: number, ano: number): number {
  return new Date(ano, mes, 0).getDate();
}

/** Datas (ISO, distintas, ordenadas) presentes nos registros — usado pra validar os seletores de período. */
export function datasDisponiveis(registros: RegistroDesempenho[]): string[] {
  const datas = new Set<string>();
  for (const r of registros) {
    const iso = dataBrParaIso(r.movimento.data);
    if (iso) datas.add(iso);
  }
  return Array.from(datas).sort();
}

export const NOMES_MESES_COMPLETOS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];
