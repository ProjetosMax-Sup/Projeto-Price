import { CABECALHO_REFERENCIA_MENSAL } from "@/config/data-sources";
import { adivinharFormato } from "@/lib/parametros/dicionario";
import { refsDaCalculada } from "@/lib/parametros/colunas-relatorio";
import type { ColunaCalculada, ColunaNativa, ConfigRelatorio } from "@/lib/parametros/types";

/**
 * Migração única: até 2026-09-29 o `ref` de uma coluna nativa era a POSIÇÃO dela
 * no arquivo ("48"); passou a ser o NOME ("Valor"), porque posição muda quando o
 * ERP altera o layout do arquivo e faz toda config apontar pra coluna errada em
 * silêncio (ver docs/exemplos-motor-colunas/README.md, cenário 4).
 *
 * Converte o que já estava salvo (dicionário e configs de relatório) em vez de
 * descartar — o cadastro pode ter tradução/movimento editados à mão. A conversão
 * é determinística: a posição antiga indexa CABECALHO_REFERENCIA_MENSAL.
 *
 * Pode ser apagado quando dev e produção já tiverem lido/gravado uma vez (as
 * funções viram no-op assim que nenhum ref numérico existir mais).
 */

function ehRefAntigo(ref: string): boolean {
  return /^\d+$/.test(ref);
}

function nomeDaPosicao(ref: string): string | null {
  return CABECALHO_REFERENCIA_MENSAL[Number(ref)] ?? null;
}

/** Devolve o mesmo array quando não há nada a migrar (evita regravar à toa). */
export function migrarDicionario(dicionario: ColunaNativa[]): ColunaNativa[] {
  const refAntigo = dicionario.some((c) => ehRefAntigo(c.ref));
  // `formato` (moeda/número/percentual) não existia antes de 2026-09-30 — cadastro salvo
  // antes disso não tem essa chave, e cai no fallback "moeda" de `colunas-configuradas.ts`
  // mesmo pra colunas de contagem (Qtde VMD, Estoque...). Recalcula só quem ainda não tem.
  const semFormato = dicionario.some((c) => c.formato === undefined && c.tipoDado === "Número");
  if (!refAntigo && !semFormato) return dicionario;
  return dicionario.map((coluna) => ({
    ...coluna,
    ref: refAntigo ? coluna.nomeArquivo : coluna.ref,
    formato: coluna.formato ?? adivinharFormato(coluna.nomeArquivo, coluna.tipoDado),
  }));
}

function migrarRef(ref: string): string {
  if (!ehRefAntigo(ref)) return ref;
  return nomeDaPosicao(ref) ?? ref;
}

function migrarCalculada(calculada: ColunaCalculada): ColunaCalculada {
  const termo = (t: { sinal: "+" | "-"; colunaRef: string }) => ({ ...t, colunaRef: migrarRef(t.colunaRef) });
  if (calculada.tipo === "soma") return { ...calculada, termos: calculada.termos.map(termo) };
  if (calculada.tipo === "razao") {
    return { ...calculada, numerador: calculada.numerador.map(termo), denominador: calculada.denominador.map(termo) };
  }
  if (calculada.tipo === "diferenca") {
    return { ...calculada, colunaA: migrarRef(calculada.colunaA), colunaB: migrarRef(calculada.colunaB) };
  }
  // formula não existia quando ref era posicional — nada a migrar.
  if (calculada.tipo === "formula") return calculada;
  // valorDoPeriodo/desvio/difPP: uma coluna só. Não existiam quando refs eram
  // numéricos, mas migrar é barato e evita um caso especial se alguém criar antes
  // de a migração rodar.
  return { ...calculada, coluna: migrarRef(calculada.coluna) };
}

export function migrarConfigRelatorio(config: ConfigRelatorio): ConfigRelatorio {
  const temRefAntigo =
    config.nativasVisiveis.some(ehRefAntigo) ||
    config.ordemAtivas.some(ehRefAntigo) ||
    (config.papeis?.principal ? ehRefAntigo(config.papeis.principal) : false) ||
    config.calculadas.some((c) => refsDaCalculada(c).some(ehRefAntigo));
  if (!temRefAntigo) return config;

  return {
    ...config,
    nativasVisiveis: config.nativasVisiveis.map(migrarRef),
    ordemAtivas: config.ordemAtivas.map(migrarRef),
    calculadas: config.calculadas.map(migrarCalculada),
    papeis: config.papeis?.principal ? { ...config.papeis, principal: migrarRef(config.papeis.principal) } : config.papeis,
  };
}
