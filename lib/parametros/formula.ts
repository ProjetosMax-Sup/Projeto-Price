/**
 * Fórmula estilo Excel para coluna calculada (tipo "formula" em
 * `lib/parametros/types.ts`) — texto com `[Nome da Coluna]`, números e os
 * operadores `+ - * / ( )`. Ver docs/manual-de-formulas.md.
 *
 * Puro (sem I/O, sem depender de ConfigRelatorio/dicionário): quem resolve um
 * `[Nome]` pra um valor é o chamador (avaliador.ts passa uma função resolver).
 * Isso mantém este arquivo testável isoladamente e sem acoplamento ao resto
 * do motor de colunas.
 *
 * Nunca lança exceção — erro de sintaxe volta como `{ ast: null, erro }`,
 * nunca quebra a tela nem a API.
 */

export type NoFormula =
  | { tipo: "numero"; valor: number }
  | { tipo: "ref"; nome: string }
  | { tipo: "neg"; valor: NoFormula }
  | { tipo: "bin"; op: "+" | "-" | "*" | "/"; esquerda: NoFormula; direita: NoFormula };

export interface ResultadoParse {
  ast: NoFormula | null;
  erro: string | null;
}

type Token =
  | { tipo: "numero"; valor: number }
  | { tipo: "ref"; nome: string }
  | { tipo: "op"; valor: "+" | "-" | "*" | "/" }
  | { tipo: "abre" }
  | { tipo: "fecha" };

function tokenizar(expressao: string): { tokens: Token[]; erro: string | null } {
  const tokens: Token[] = [];
  let i = 0;
  while (i < expressao.length) {
    const c = expressao[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (c === "[") {
      const fim = expressao.indexOf("]", i + 1);
      if (fim === -1) return { tokens, erro: `Colchete não fechado em "${expressao.slice(i)}".` };
      const nome = expressao.slice(i + 1, fim).trim();
      if (!nome) return { tokens, erro: "Referência de coluna vazia: [] não é válido." };
      tokens.push({ tipo: "ref", nome });
      i = fim + 1;
      continue;
    }
    if (c === "]") return { tokens, erro: `"]" sem "[" correspondente.` };
    if ("+-*/".includes(c)) {
      tokens.push({ tipo: "op", valor: c as "+" | "-" | "*" | "/" });
      i++;
      continue;
    }
    if (c === "(") {
      tokens.push({ tipo: "abre" });
      i++;
      continue;
    }
    if (c === ")") {
      tokens.push({ tipo: "fecha" });
      i++;
      continue;
    }
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < expressao.length && /[0-9.]/.test(expressao[j])) j++;
      const texto = expressao.slice(i, j);
      const valor = Number(texto);
      if (Number.isNaN(valor)) return { tokens, erro: `Número inválido: "${texto}".` };
      tokens.push({ tipo: "numero", valor });
      i = j;
      continue;
    }
    return { tokens, erro: `Caractere inesperado: "${c}".` };
  }
  return { tokens, erro: null };
}

/** Recursivo-descendente clássico: expr → termo (+ ou -) → fator (* ou /) → átomo. */
export function parsearFormula(expressao: string): ResultadoParse {
  if (!expressao?.trim()) return { ast: null, erro: "A fórmula está vazia." };

  const { tokens, erro: erroTokenizacao } = tokenizar(expressao);
  if (erroTokenizacao) return { ast: null, erro: erroTokenizacao };

  let pos = 0;
  const atual = () => tokens[pos] ?? null;

  function erroInesperado(): ResultadoParse {
    const t = atual();
    return { ast: null, erro: t ? `Token inesperado perto de "${JSON.stringify(t)}".` : "A fórmula termina de forma inesperada." };
  }

  function parseAtomo(): NoFormula | null {
    const t = atual();
    if (!t) return null;
    if (t.tipo === "numero") {
      pos++;
      return { tipo: "numero", valor: t.valor };
    }
    if (t.tipo === "ref") {
      pos++;
      return { tipo: "ref", nome: t.nome };
    }
    if (t.tipo === "abre") {
      pos++;
      const interno = parseExpr();
      if (!interno) return null;
      if (atual()?.tipo !== "fecha") return null;
      pos++;
      return interno;
    }
    return null;
  }

  function parseFator(): NoFormula | null {
    const t = atual();
    if (t?.tipo === "op" && (t.valor === "-" || t.valor === "+")) {
      pos++;
      const valor = parseFator();
      if (!valor) return null;
      return t.valor === "-" ? { tipo: "neg", valor } : valor;
    }
    return parseAtomo();
  }

  function parseTermo(): NoFormula | null {
    let esquerda = parseFator();
    if (!esquerda) return null;
    while (atual()?.tipo === "op" && ((atual() as Token & { tipo: "op" }).valor === "*" || (atual() as Token & { tipo: "op" }).valor === "/")) {
      const op = (tokens[pos] as Token & { tipo: "op" }).valor as "*" | "/";
      pos++;
      const direita = parseFator();
      if (!direita) return null;
      esquerda = { tipo: "bin", op, esquerda, direita };
    }
    return esquerda;
  }

  function parseExpr(): NoFormula | null {
    let esquerda = parseTermo();
    if (!esquerda) return null;
    while (atual()?.tipo === "op" && ((atual() as Token & { tipo: "op" }).valor === "+" || (atual() as Token & { tipo: "op" }).valor === "-")) {
      const op = (tokens[pos] as Token & { tipo: "op" }).valor as "+" | "-";
      pos++;
      const direita = parseTermo();
      if (!direita) return null;
      esquerda = { tipo: "bin", op, esquerda, direita };
    }
    return esquerda;
  }

  const ast = parseExpr();
  if (!ast) return erroInesperado();
  if (pos < tokens.length) return erroInesperado();
  return { ast, erro: null };
}

/** Todas as refs citadas na fórmula (nomes, ainda não resolvidos a ref/id reais). */
export function refsDaFormula(ast: NoFormula): string[] {
  const refs: string[] = [];
  function visitar(n: NoFormula) {
    if (n.tipo === "ref") refs.push(n.nome);
    else if (n.tipo === "neg") visitar(n.valor);
    else if (n.tipo === "bin") {
      visitar(n.esquerda);
      visitar(n.direita);
    }
  }
  visitar(ast);
  return [...new Set(refs)];
}

/**
 * Avalia a árvore. `valores(nome)` resolve uma ref pro valor atual (já
 * agregado) — propaga `null` se qualquer ref não existir/não puder ser
 * calculada, nunca lança exceção.
 *
 * Divisão por zero devolve 0, nunca Infinity/NaN — mesma regra de "razão" em
 * `avaliador.ts` ("zero é mais honesto que Infinity"). É isso que garante que
 * uma fórmula salva nunca produz erro em tempo de exibição.
 */
export function avaliarFormula(ast: NoFormula, valores: (nome: string) => number | null): number | null {
  switch (ast.tipo) {
    case "numero":
      return ast.valor;
    case "ref":
      return valores(ast.nome);
    case "neg": {
      const v = avaliarFormula(ast.valor, valores);
      return v === null ? null : -v;
    }
    case "bin": {
      const a = avaliarFormula(ast.esquerda, valores);
      const b = avaliarFormula(ast.direita, valores);
      if (a === null || b === null) return null;
      switch (ast.op) {
        case "+":
          return a + b;
        case "-":
          return a - b;
        case "*":
          return a * b;
        case "/":
          return b === 0 ? 0 : a / b;
      }
    }
  }
}
