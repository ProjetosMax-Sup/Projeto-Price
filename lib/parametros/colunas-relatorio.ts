import type { ColunaCalculada, ConfigRelatorio, TermoFormula } from "@/lib/parametros/types";

/**
 * Regras do motor de colunas por relatório (docs/parametros.md, seção 3.1),
 * puras (sem I/O) — usadas tanto no client (UsuariosTable-like editors) quanto
 * nas rotas de API, pra nunca divergir validação de tela vs. de servidor.
 *
 * Refs de coluna nativa são a posição no arquivo (string numérica, ex. "12") —
 * nunca desaparecem, existem enquanto o dicionário existir. Refs de coluna
 * calculada são gerados com o prefixo "calc_", e SÓ essas podem "quebrar"
 * (uma calculada excluída deixa de existir de verdade — nativa nunca se
 * exclui, só se oculta, então nunca quebra uma fórmula que a referencia).
 */

export function novoIdCalculada(): string {
  return `calc_${crypto.randomUUID()}`;
}

function ehRefCalculada(ref: string): boolean {
  return ref.startsWith("calc_");
}

export function refValida(ref: string, config: ConfigRelatorio): boolean {
  if (!ehRefCalculada(ref)) return true; // nativa: sempre existe
  return config.calculadas.some((c) => c.id === ref);
}

export function termosDaCalculada(c: ColunaCalculada): TermoFormula[] {
  return c.tipo === "soma" ? c.termos : [...c.numerador, ...c.denominador];
}

/** Refs disponíveis pra virar termo de uma NOVA fórmula: nativas visíveis + outras calculadas (nunca ela mesma). */
export function refsDisponiveisParaTermo(config: ConfigRelatorio, idCalculadaAtual?: string): string[] {
  const calculadas = config.calculadas.filter((c) => c.id !== idCalculadaAtual).map((c) => c.id);
  return [...config.nativasVisiveis, ...calculadas];
}

/** Quebrada = alguma fórmula referencia uma calculada que não existe mais (foi excluída). */
export function calculadaQuebrada(c: ColunaCalculada, config: ConfigRelatorio): boolean {
  return termosDaCalculada(c).some((t) => !refValida(t.colunaRef, config));
}

/** Nomes das calculadas que dependem (via termo) da ref informada — pra avisar antes de excluir. */
export function quemDependeDe(ref: string, config: ConfigRelatorio): string[] {
  return config.calculadas.filter((c) => termosDaCalculada(c).some((t) => t.colunaRef === ref)).map((c) => c.nome);
}

/** Bloqueio de publicação (seção 3.1): nenhuma calculada pode estar quebrada. */
export function podePublicar(config: ConfigRelatorio): boolean {
  return !config.calculadas.some((c) => calculadaQuebrada(c, config));
}

/**
 * Ordem final (aba Ativas, seção 3.1): união do que está visível em Nativas +
 * Calculadas, preservando a ordem já escolhida (ordemAtivas) e acrescentando
 * no fim quem ficou visível agora mas ainda não tinha posição — nunca some
 * silenciosamente quem deixou de ser visível.
 */
export function ordemAtivasEfetiva(config: ConfigRelatorio): string[] {
  const visiveis = new Set([...config.nativasVisiveis, ...config.calculadas.filter((c) => !c.oculta).map((c) => c.id)]);
  const jaOrdenados = config.ordemAtivas.filter((ref) => visiveis.has(ref));
  const novos = [...visiveis].filter((ref) => !jaOrdenados.includes(ref));
  return [...jaOrdenados, ...novos];
}
