import { avaliarFormula, parsearFormula, refsDaFormula } from "@/lib/parametros/formula";
import type { ColunaCalculada, ConfigRelatorio, FormatoColuna, TermoFormula } from "@/lib/parametros/types";

/**
 * O avaliador: recebe a fórmula (montada em /parametros) + os valores já agregados
 * de um grupo (uma loja, um departamento, o total) e devolve o número.
 *
 * Por que os valores chegam JÁ agregados, e não linha a linha: soma é uma
 * combinação linear, então somar por linha e agrupar depois dá exatamente o mesmo
 * resultado que agrupar as nativas e aplicar a fórmula uma vez só
 * (Σ(a−b) = Σa − Σb). Fazer no nível do grupo é idêntico no resultado e ordens de
 * grandeza mais barato — o dataset tem 4+ milhões de registros. Já razão/desvio
 * NÃO são lineares (ver docs/manual-de-formulas.md), e é justamente por isso que
 * só podem ser calculadas aqui, depois da agregação.
 */

/** Valores nativos de um grupo, por ref (nome da coluna no arquivo). */
export type ValoresNativos = Record<string, number>;

export interface ContextoAvaliacao {
  atual: ValoresNativos;
  /** null quando o usuário não escolheu período de Comparação. */
  comparacao: ValoresNativos | null;
}

const PERIODO_PADRAO = "atual" as const;
type Periodo = "atual" | "comparacao";

/** Refs sintéticos (não vêm do arquivo, ver `ConfigRelatorio.metas`) onde AUSENTE
 * significa "não cadastrado" (mostra "—" na tela), não "zero" — diferente de uma
 * nativa de arquivo de verdade, onde ausente é sempre "sem movimento" = 0. Sem
 * isso, "Meta - Realizado" de um Departamento sem meta cadastrada mostraria um
 * número grande e enganoso (0 − Realizado) em vez de vazio. */
const REFS_SINTETICOS_SEM_PADRAO_ZERO = new Set(["Meta"]);

function somarTermos(
  termos: TermoFormula[],
  periodo: Periodo,
  resolver: (ref: string, periodo: Periodo) => number | null,
): number | null {
  let total = 0;
  for (const termo of termos) {
    const valor = resolver(termo.colunaRef, periodo);
    if (valor === null) return null;
    total += termo.sinal === "-" ? -valor : valor;
  }
  return total;
}

/**
 * Avalia todas as colunas calculadas de uma vez para um grupo. Devolve um mapa
 * `ref → valor` (nativas inclusas), com `null` onde não há como calcular — ex.:
 * qualquer coluna de Comparação quando não existe período de comparação.
 *
 * Resolve dependência entre calculadas sob demanda (uma calculada pode ser termo
 * de outra) e memoriza, então cada coluna é calculada no máximo uma vez por
 * período. Ciclo nunca acontece pela tela (o editor não deixa uma coluna se
 * referenciar), mas há guarda aqui pra uma config escrita à mão não travar o app.
 */
export function avaliarColunas(config: ConfigRelatorio, contexto: ContextoAvaliacao): Record<string, number | null> {
  const calculadaPorId = new Map(config.calculadas.map((c) => [c.id, c]));
  const memo = new Map<string, number | null>();
  const emCurso = new Set<string>();

  function valores(periodo: Periodo): ValoresNativos | null {
    return periodo === "atual" ? contexto.atual : contexto.comparacao;
  }

  function resolver(ref: string, periodo: Periodo): number | null {
    const chave = `${periodo}:${ref}`;
    if (memo.has(chave)) return memo.get(chave) ?? null;

    if (emCurso.has(chave)) {
      // Ciclo: devolve null em vez de estourar a pilha. A coluna aparece vazia,
      // o que é visível e corrigível — nunca um número inventado.
      console.error(`Ciclo de fórmula detectado em "${ref}" (relatório ${config.modulo}).`);
      return null;
    }
    emCurso.add(chave);
    const valor = calcular(ref, periodo);
    emCurso.delete(chave);

    memo.set(chave, valor);
    return valor;
  }

  function calcular(ref: string, periodo: Periodo): number | null {
    const calculada = calculadaPorId.get(ref);
    if (!calculada) {
      // Nativa: vem direto do grupo. Ausente = 0 (o arquivo não trouxe movimento
      // dessa coluna pra este grupo), exceto quando o período inteiro não existe.
      const doPeriodo = valores(periodo);
      if (!doPeriodo) return null;
      if (REFS_SINTETICOS_SEM_PADRAO_ZERO.has(ref) && !(ref in doPeriodo)) return null;
      return doPeriodo[ref] ?? 0;
    }

    switch (calculada.tipo) {
      case "soma":
        return somarTermos(calculada.termos, periodo, resolver);

      case "razao": {
        const numerador = somarTermos(calculada.numerador, periodo, resolver);
        const denominador = somarTermos(calculada.denominador, periodo, resolver);
        if (numerador === null || denominador === null) return null;
        // Denominador zero não é erro: é "não há base pra comparar" (ex.: DDE de um
        // produto sem venda média). Zero é mais honesto que Infinity na tela.
        if (denominador === 0) return 0;
        // Só multiplica por 100 quando a coluna é percentual — DDE também é uma
        // razão, mas o resultado dela é em dias.
        const razao = numerador / denominador;
        return formatoDaCalculada(calculada) === "percentual" ? razao * 100 : razao;
      }

      case "valorDoPeriodo":
        return resolver(calculada.coluna, calculada.periodo);

      case "desvio": {
        const atual = resolver(calculada.coluna, "atual");
        const anterior = resolver(calculada.coluna, "comparacao");
        if (atual === null || anterior === null) return null;
        // Mesma regra de `calcDesvio` (lib/desempenho/format.ts) — as duas precisam
        // andar juntas, e /api/verificar-avaliador quebra se divergirem.
        if (anterior === 0) return atual === 0 ? 0 : null;
        return ((atual - anterior) / Math.abs(anterior)) * 100;
      }

      case "difPP": {
        const atual = resolver(calculada.coluna, "atual");
        const anterior = resolver(calculada.coluna, "comparacao");
        if (atual === null || anterior === null) return null;
        return atual - anterior;
      }

      case "diferenca": {
        const a = resolver(calculada.colunaA, periodo);
        const b = resolver(calculada.colunaB, periodo);
        if (a === null || b === null) return null;
        return a - b;
      }

      case "formula": {
        const { ast } = parsearFormula(calculada.expressao);
        if (!ast) return null;
        const porNome = new Map(config.calculadas.map((c) => [c.nome, c.id]));
        return avaliarFormula(ast, (nomeOuRef) => resolver(porNome.get(nomeOuRef) ?? nomeOuRef, periodo));
      }
    }
  }

  const resultado: Record<string, number | null> = {};
  for (const ref of Object.keys(contexto.atual)) resultado[ref] = resolver(ref, PERIODO_PADRAO);
  for (const calculada of config.calculadas) resultado[calculada.id] = resolver(calculada.id, PERIODO_PADRAO);
  return resultado;
}

/** Avalia uma coluna só — atalho pra quando não se precisa do mapa inteiro. */
export function avaliarColuna(ref: string, config: ConfigRelatorio, contexto: ContextoAvaliacao): number | null {
  return avaliarColunas(config, contexto)[ref] ?? null;
}

/** Formato de exibição de uma calculada, com o padrão de cada tipo. */
export function formatoDaCalculada(calculada: ColunaCalculada): FormatoColuna {
  if (calculada.formato) return calculada.formato;
  switch (calculada.tipo) {
    case "soma":
      return "moeda";
    case "razao":
    case "desvio":
      return "percentual";
    case "difPP":
    case "diferenca":
      return "pontosPercentuais";
    case "valorDoPeriodo":
    case "formula":
      return "moeda";
  }
}

/**
 * Quais refs nativos precisam ser somados por grupo pra esta config funcionar —
 * evita carregar/somar as 83 colunas do arquivo quando o relatório usa 6.
 */
export function refsNativasNecessarias(config: ConfigRelatorio): string[] {
  const calculadaPorId = new Map(config.calculadas.map((c) => [c.id, c]));
  const necessarias = new Set<string>(config.nativasVisiveis);
  const visitadas = new Set<string>();

  function percorrer(ref: string) {
    if (visitadas.has(ref)) return;
    visitadas.add(ref);
    const calculada = calculadaPorId.get(ref);
    if (!calculada) {
      necessarias.add(ref);
      return;
    }
    switch (calculada.tipo) {
      case "soma":
        calculada.termos.forEach((t) => percorrer(t.colunaRef));
        break;
      case "razao":
        [...calculada.numerador, ...calculada.denominador].forEach((t) => percorrer(t.colunaRef));
        break;
      case "valorDoPeriodo":
      case "desvio":
      case "difPP":
        percorrer(calculada.coluna);
        break;
      case "diferenca":
        percorrer(calculada.colunaA);
        percorrer(calculada.colunaB);
        break;
      case "formula": {
        const { ast } = parsearFormula(calculada.expressao);
        if (!ast) break;
        const porNome = new Map(config.calculadas.map((c) => [c.nome, c.id]));
        refsDaFormula(ast).forEach((nome) => percorrer(porNome.get(nome) ?? nome));
        break;
      }
    }
  }

  config.calculadas.forEach((c) => percorrer(c.id));
  return [...necessarias];
}
