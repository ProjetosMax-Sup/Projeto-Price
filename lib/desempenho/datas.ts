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
export function dataParaIso(d: Date): string {
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

/** Quantidade de dias do mês (1-12), já tratando ano bissexto nativamente. */
export function diasNoMes(mes: number, ano: number): number {
  return new Date(ano, mes, 0).getDate();
}

/**
 * Desloca uma data ISO em N meses, mantendo o dia quando possível — quando o mês de destino é
 * mais curto (ex: 31/Jan − 1 mês → Fevereiro não tem dia 31), cai pro último dia daquele mês.
 * Usado pelos atalhos "mesmo período, mês anterior" / "...ano anterior" (delta = ±1 / ±12).
 */
export function deslocarMeses(iso: string, deltaMeses: number): string {
  const d = isoParaDataLocal(iso);
  if (!d) return iso;
  const indiceMesAbsoluto = d.getFullYear() * 12 + d.getMonth() + deltaMeses;
  const novoAno = Math.floor(indiceMesAbsoluto / 12);
  const novoMes = ((indiceMesAbsoluto % 12) + 12) % 12; // 0-11
  const dia = Math.min(d.getDate(), diasNoMes(novoMes + 1, novoAno));
  return dataParaIso(new Date(novoAno, novoMes, dia));
}

/** {ano, mes0 (0-11)} de uma data ISO. */
export function anoMesDeIso(iso: string): { ano: number; mes0: number } {
  const [ano, mes] = iso.split("-").map(Number);
  return { ano, mes0: mes - 1 };
}

/**
 * Reaplica o mesmo par de dias-do-mês (inicial e final) de `referencia` num outro mês/ano —
 * usado pelos seletores rápidos "mesmo período, mês" (mesmo ano) / "...ano anterior" e pelo
 * período padrão (mês mais recente / mês anterior). Cai pro último dia do mês de destino quando
 * ele for mais curto (ex: dia 31 num mês de 30 dias).
 */
export function periodoNoMes(referencia: { inicio: string; fim: string }, ano: number, mes0: number): { inicio: string; fim: string } {
  const diaIni = isoParaDataLocal(referencia.inicio)?.getDate() ?? 1;
  const diaFim = isoParaDataLocal(referencia.fim)?.getDate() ?? 1;
  const max = diasNoMes(mes0 + 1, ano);
  return {
    inicio: dataParaIso(new Date(ano, mes0, Math.min(diaIni, max))),
    fim: dataParaIso(new Date(ano, mes0, Math.min(diaFim, max))),
  };
}

/** Período padrão: do 1º ao último dia do mês mais recente com dado disponível no arquivo. */
export function periodoMesMaisRecente(datasDisponiveis: string[]): { inicio: string; fim: string } | null {
  if (datasDisponiveis.length === 0) return null;
  const ultima = datasDisponiveis.at(-1)!;
  const prefixoMes = ultima.slice(0, 7); // "AAAA-MM"
  const doMes = datasDisponiveis.filter((d) => d.startsWith(prefixoMes));
  return { inicio: doMes[0], fim: doMes.at(-1)! };
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

/**
 * Primeira data (ISO) com venda registrada (valor > 0) por loja — proxy de "data de abertura",
 * já que não existe coluna de abertura em `bdLojas.txt`. Usado pelo filtro "Mesmas Lojas".
 */
export function primeiraVendaPorLoja(registros: RegistroDesempenho[]): Map<string, string> {
  const mapa = new Map<string, string>();
  for (const r of registros) {
    if (!r.loja || r.movimento.valorTotal <= 0) continue;
    const iso = dataBrParaIso(r.movimento.data);
    if (!iso) continue;
    const atual = mapa.get(r.loja.codUnid);
    if (!atual || iso < atual) mapa.set(r.loja.codUnid, iso);
  }
  return mapa;
}

/**
 * "Loja aberta desde o início do período" (proxy): a primeira venda registrada da loja cai até
 * 2 dias corridos depois do início do período — folga pra não penalizar loja que só não vendeu
 * nos primeiros dias por causa de feriado. Usado pelo filtro "Mesmas Lojas" (ver
 * `docs/regras-de-negocio.md`).
 */
export function lojaAbertaDesdeInicio(primeiraVenda: string | undefined, inicioPeriodo: string): boolean {
  if (!primeiraVenda) return false;
  const p = isoParaDataLocal(primeiraVenda);
  const i = isoParaDataLocal(inicioPeriodo);
  if (!p || !i) return false;
  const diffDias = (p.getTime() - i.getTime()) / 86400000;
  return diffDias <= 2;
}

/**
 * Dias (ISO) com venda registrada (valor > 0) por loja — usado pra detectar fechamento/feriado
 * dentro de um período (ver `intervalosFechamento`).
 */
export function diasComVendaPorLoja(registros: RegistroDesempenho[]): Map<string, Set<string>> {
  const mapa = new Map<string, Set<string>>();
  for (const r of registros) {
    if (!r.loja || r.movimento.valorTotal <= 0) continue;
    const iso = dataBrParaIso(r.movimento.data);
    if (!iso) continue;
    if (!mapa.has(r.loja.codUnid)) mapa.set(r.loja.codUnid, new Set());
    mapa.get(r.loja.codUnid)!.add(iso);
  }
  return mapa;
}

/**
 * Intervalos (ISO, inclusive) sem venda dentro do período, cada um começando logo depois de um
 * dia COM venda (dentro do intervalo) — "fechamento", diferente de "abertura" (que
 * `lojaAbertaDesdeInicio` cobre): uma loja com fechamento no meio do período já tinha histórico
 * antes, só ficou fechada por feriado/reforma; não deve ser tratada como loja nova (ver
 * docs/regras-de-negocio.md). Lista vazia = sem fechamento detectado.
 */
export function intervalosFechamento(diasComVenda: Set<string> | undefined, periodo: { inicio: string; fim: string }): { inicio: string; fim: string }[] {
  if (!diasComVenda || diasComVenda.size === 0) return [];
  const inicio = isoParaDataLocal(periodo.inicio);
  const fim = isoParaDataLocal(periodo.fim);
  if (!inicio || !fim) return [];

  const intervalos: { inicio: string; fim: string }[] = [];
  let cursor = inicio;
  let ontemTinhaVenda = false;
  let gapInicio: string | null = null;
  let gapFim: string | null = null;

  while (cursor <= fim) {
    const iso = dataParaIso(cursor);
    const temHoje = diasComVenda.has(iso);
    if (!temHoje) {
      if (ontemTinhaVenda || gapInicio) {
        gapInicio = gapInicio ?? iso;
        gapFim = iso;
      }
    } else if (gapInicio && gapFim) {
      intervalos.push({ inicio: gapInicio, fim: gapFim });
      gapInicio = null;
      gapFim = null;
    }
    ontemTinhaVenda = temHoje;
    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1);
  }
  if (gapInicio && gapFim) intervalos.push({ inicio: gapInicio, fim: gapFim });
  return intervalos;
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
