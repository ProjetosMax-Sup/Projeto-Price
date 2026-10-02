import { parsearFormula, refsDaFormula } from "@/lib/parametros/formula";
import type { ColunaCalculada, ColunaNativa, ConfigRelatorio, TermoFormula } from "@/lib/parametros/types";

/**
 * Regras do motor de colunas por relatório (docs/parametros.md, seção 3.1;
 * modelo geral em docs/exemplos-motor-colunas/README.md), puras (sem I/O) —
 * usadas tanto no client (editores da aba Calculadas) quanto nas rotas de API,
 * pra nunca divergir validação de tela vs. de servidor.
 *
 * Ref de coluna nativa é o NOME da coluna no arquivo; ref de calculada é
 * gerado com o prefixo "calc_" (nome de coluna do ERP nunca começa com isso,
 * então os dois espaços de nome não colidem).
 */

export function novoIdCalculada(): string {
  return `calc_${crypto.randomUUID()}`;
}

function ehRefCalculada(ref: string): boolean {
  return ref.startsWith("calc_");
}

/**
 * Em que momento uma coluna pode ser calculada:
 * - `linha`: vale por registro e SOMA na agregação (nativas e somas de nativas).
 * - `agregado`: só existe depois de agrupar, porque não é somável — dividir
 *   dois totais é diferente de somar duas divisões.
 *
 * Exemplo do porquê (duas lojas, venda 100/lucro 30 e venda 900/lucro 90): o
 * % Lucro do conjunto é 120/1000 = 12%, não 30% + 10% = 40% nem a média 20%.
 * Ver `docs/manual-de-formulas.md`.
 */
export type EstagioCalculo = "linha" | "agregado";

export function estagioDoTipo(tipo: ColunaCalculada["tipo"]): EstagioCalculo {
  return tipo === "soma" ? "linha" : "agregado";
}

/**
 * Uma referência dentro do texto de uma fórmula é o NOME de uma coluna
 * calculada (ex.: "% Margem") ou, quando não bate com nenhum nome cadastrado,
 * o ref bruto de uma nativa (ex.: "Compras", "Meta") — a mesma string que o
 * glossário insere. Resolve pro `id`/ref real que o resto do motor entende.
 */
function resolverTokenFormula(nomeOuRef: string, config: ConfigRelatorio): string {
  return config.calculadas.find((c) => c.nome === nomeOuRef)?.id ?? nomeOuRef;
}

/**
 * Como a coluna se chama NESTE relatório. Ordem de precedência: nome próprio da
 * calculada → rótulo definido pro relatório → tradução do Dicionário → o ref cru.
 * Usado pela tabela, pelo editor de fórmula e pela aba Ativas, pra o mesmo nome
 * aparecer em todo lugar.
 */
export function rotuloDaColuna(ref: string, config: ConfigRelatorio, dicionario: ColunaNativa[]): string {
  const calculada = config.calculadas.find((c) => c.id === ref);
  if (calculada) return calculada.nome;
  return config.rotulos?.[ref] || dicionario.find((c) => c.ref === ref)?.traducao || ref;
}

/** Todas as colunas que a fórmula referencia — independente do formato da fórmula. */
export function refsDaCalculada(c: ColunaCalculada): string[] {
  switch (c.tipo) {
    case "soma":
      return c.termos.map((t) => t.colunaRef);
    case "razao":
      return [...c.numerador, ...c.denominador].map((t) => t.colunaRef);
    case "valorDoPeriodo":
    case "desvio":
    case "difPP":
      return [c.coluna];
    case "diferenca":
      return [c.colunaA, c.colunaB];
    case "formula": {
      const { ast } = parsearFormula(c.expressao);
      return ast ? refsDaFormula(ast) : [];
    }
  }
}

/** Refs sintéticos: não vêm do Dicionário (nunca vão aparecer lá), mas são refs
 * válidos mesmo assim — injetados na agregação de quem precisa (ex.: "Meta",
 * cadastrada em `ConfigRelatorio.metas`, não é coluna de arquivo nenhum). */
const REFS_SINTETICOS = new Set(["Meta"]);

/** Nativa é sempre valor de linha; calculada depende do tipo dela. */
export function estagioDoRef(ref: string, config: ConfigRelatorio): EstagioCalculo {
  const calculada = config.calculadas.find((c) => c.id === ref);
  return calculada ? estagioDoTipo(calculada.tipo) : "linha";
}

export function refValida(ref: string, config: ConfigRelatorio): boolean {
  if (!ehRefCalculada(ref)) return true; // nativa: sempre existe
  return config.calculadas.some((c) => c.id === ref);
}

export function termosDaCalculada(c: ColunaCalculada, config: ConfigRelatorio): TermoFormula[] {
  if (c.tipo === "soma") return c.termos;
  if (c.tipo === "razao") return [...c.numerador, ...c.denominador];
  if (c.tipo === "diferenca") return [{ sinal: "+", colunaRef: c.colunaA }, { sinal: "-", colunaRef: c.colunaB }];
  if (c.tipo === "formula") {
    const { ast } = parsearFormula(c.expressao);
    if (!ast) return [];
    return refsDaFormula(ast).map((nome) => ({ sinal: "+" as const, colunaRef: resolverTokenFormula(nome, config) }));
  }
  // valorDoPeriodo/desvio/difPP apontam pra uma coluna só, sem sinal.
  return [{ sinal: "+", colunaRef: c.coluna }];
}

/**
 * Refs que podem virar termo de uma fórmula: **todas** as nativas do dicionário +
 * as outras calculadas (nunca ela mesma, pra não criar ciclo).
 *
 * Usa o dicionário inteiro, não só `nativasVisiveis`: marcar/desmarcar em Nativas
 * é sobre **aparecer na tabela**, nunca sobre existir — uma coluna pode alimentar
 * uma fórmula sem ser exibida (ex.: "Vendas Oferta" entra no cálculo de
 * "% Participação Oferta" mas não é coluna da tela). Mesma regra que as
 * calculadas já seguiam com o campo `oculta`.
 *
 * Numa **soma**, só entram refs de estágio `linha` — somar/subtrair um percentual
 * (razão) produz número errado assim que a linha vira subtotal ou total. Numa
 * **razão**, qualquer ref serve: numerador e denominador já são avaliados depois
 * da agregação.
 */
export function refsDisponiveisParaTermo(
  config: ConfigRelatorio,
  dicionario: ColunaNativa[],
  idCalculadaAtual?: string,
  tipoDaFormula: ColunaCalculada["tipo"] = "razao",
): string[] {
  const nativas = dicionario.filter((c) => !c.chaveAutomatica).map((c) => c.ref);
  const calculadas = config.calculadas.filter((c) => c.id !== idCalculadaAtual).map((c) => c.id);
  const todas = [...nativas, ...calculadas, ...REFS_SINTETICOS];
  if (tipoDaFormula !== "soma") return todas;
  return todas.filter((ref) => estagioDoRef(ref, config) === "linha");
}

/**
 * Erro que impede salvar uma coluna calculada — `null` quando está válida. Mesma
 * função no editor (antes de deixar salvar) e na rota de API (antes de gravar).
 */
export function erroDaCalculada(coluna: ColunaCalculada, config: ConfigRelatorio): string | null {
  if (!coluna.nome?.trim()) return "Toda coluna calculada precisa de um nome.";

  const duplicada = config.calculadas.some((c) => c.id !== coluna.id && c.nome.trim() === coluna.nome.trim());
  if (duplicada) return `Já existe uma coluna calculada chamada "${coluna.nome}" neste relatório.`;

  if (coluna.tipo === "soma") {
    if (coluna.termos.length === 0) return `Coluna "${coluna.nome}": adicione ao menos 1 termo.`;
    const invalido = coluna.termos.find((t) => estagioDoRef(t.colunaRef, config) === "agregado");
    if (invalido) {
      const nome = config.calculadas.find((c) => c.id === invalido.colunaRef)?.nome ?? invalido.colunaRef;
      return `Coluna "${coluna.nome}": "${nome}" só existe depois da agregação (percentual/comparação) e não pode entrar numa soma — somar percentuais dá resultado errado no subtotal e no total. Ver docs/manual-de-formulas.md.`;
    }
    return null;
  }

  if (coluna.tipo === "razao") {
    if (coluna.numerador.length === 0 || coluna.denominador.length === 0) {
      return `Coluna "${coluna.nome}": razão precisa de ao menos 1 termo no numerador e 1 no denominador.`;
    }
    return null;
  }

  if (coluna.tipo === "formula") {
    const { ast, erro } = parsearFormula(coluna.expressao);
    if (!ast) return `Coluna "${coluna.nome}": ${erro}`;
    const refs = refsDaFormula(ast).map((nome) => resolverTokenFormula(nome, config));
    if (refs.includes(coluna.id)) return `Coluna "${coluna.nome}": a fórmula não pode se referenciar.`;
    const invalida = refs.find((r) => !refValida(r, config));
    if (invalida) return `Coluna "${coluna.nome}": "${invalida}" não é uma coluna conhecida deste relatório.`;
    return null;
  }

  if (coluna.tipo === "diferenca") {
    if (!coluna.colunaA || !coluna.colunaB) return `Coluna "${coluna.nome}": escolha as duas colunas (A e B).`;
    if (!refValida(coluna.colunaA, config) || !refValida(coluna.colunaB, config)) {
      return `Coluna "${coluna.nome}": alguma das colunas não existe mais neste relatório.`;
    }
    if (coluna.colunaA === coluna.id || coluna.colunaB === coluna.id) {
      return `Coluna "${coluna.nome}": não pode apontar pra ela mesma.`;
    }
    return null;
  }

  // valorDoPeriodo / desvio / difPP: apontam pra uma coluna só, que precisa existir.
  if (!coluna.coluna) return `Coluna "${coluna.nome}": escolha a coluna de origem.`;
  if (!refValida(coluna.coluna, config)) {
    return `Coluna "${coluna.nome}": a coluna de origem não existe mais neste relatório.`;
  }
  if (coluna.coluna === coluna.id) return `Coluna "${coluna.nome}": não pode apontar pra ela mesma.`;
  return null;
}

/** Todos os erros da configuração — usada pela rota de API antes de gravar. */
export function errosDaConfig(config: ConfigRelatorio): string[] {
  return config.calculadas.map((c) => erroDaCalculada(c, config)).filter((e): e is string => e !== null);
}

/**
 * Refs de nativa que a config usa mas que não existem mais no dicionário — o
 * arquivo do ERP pode mudar de layout (já mudou: ver cenário 4 em
 * `docs/exemplos-motor-colunas/README.md`). Aviso visível, nunca silencioso.
 */
export function refsNativasInexistentes(config: ConfigRelatorio, dicionario: ColunaNativa[]): string[] {
  const existentes = new Set(dicionario.map((c) => c.ref));
  const usados = new Set<string>(config.nativasVisiveis);
  for (const calculada of config.calculadas) {
    for (const termo of termosDaCalculada(calculada, config)) {
      if (!ehRefCalculada(termo.colunaRef)) usados.add(termo.colunaRef);
    }
  }
  return [...usados].filter((ref) => !existentes.has(ref) && !REFS_SINTETICOS.has(ref));
}

/** Quebrada = alguma fórmula referencia uma calculada que não existe mais (foi excluída). */
export function calculadaQuebrada(c: ColunaCalculada, config: ConfigRelatorio): boolean {
  return termosDaCalculada(c, config).some((t) => !refValida(t.colunaRef, config));
}

/** Nomes das calculadas que dependem (via termo) da ref informada — pra avisar antes de excluir. */
export function quemDependeDe(ref: string, config: ConfigRelatorio): string[] {
  return config.calculadas.filter((c) => termosDaCalculada(c, config).some((t) => t.colunaRef === ref)).map((c) => c.nome);
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
