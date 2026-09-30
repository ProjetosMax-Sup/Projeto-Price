import { REFS_NATIVOS_ENTRADAS_SAIDAS } from "@/config/data-sources";
import { parseTabela } from "./parse-tabela";
import type { Loja, Produto } from "@/lib/types";

/**
 * Parser do Entradas e Saídas — **de propósito separado** de
 * `normalizar-desempenho.ts`. Tentativa anterior (2026-09-30) colocou esses
 * campos dentro de `MovimentoVendas` (a estrutura que o Desempenho Comercial
 * já mantém em memória pros 5+ milhões de registros) e isso quase triplicou o
 * tempo de resposta dele (60s → 2min47, mesma máquina, mesmo dataset) só por
 * engordar um registro que ele nem lê — próximo da borda de heap
 * (`--max-old-space-size=8192`), qualquer bytes a mais por registro custa
 * caro em GC, não só em memória bruta. Revertido no mesmo commit.
 *
 * Por isso o Entradas e Saídas lê o MESMO arquivo mensal de novo, numa segunda
 * passada — mais I/O, mas zero risco pro que já funciona. Ainda não está
 * plugado em nenhum cache/rota (ver "Próximo passo" abaixo).
 */

// "Valor" (Vendas, ver REF_VENDAS em lib/parametros/seed.ts) não está em
// REFS_NATIVOS_ENTRADAS_SAIDAS porque aquele array é sobre os campos que só o
// Entradas e Saídas precisa — "Valor" já existe em MovimentoVendas.valorTotal,
// mas aqui, num registro próprio, é mais simples incluir tudo no mesmo lugar.
const REFS_NATIVOS = [...REFS_NATIVOS_ENTRADAS_SAIDAS, "Valor"] as const;
const CAMPOS = ["Código", "Unidade Código", "Data", ...REFS_NATIVOS] as const;

const INDICE_NATIVOS = new Map<string, number>(REFS_NATIVOS.map((ref, i) => [ref, i]));

export interface RegistroEntradasSaidas {
  codigo: string; // SKU, join com Produto.codigo
  unidadeCodigo: string; // join com Loja.codUnid
  data: string;
  produto: Produto | null;
  loja: Loja | null;
  /** Array de posição fixa (não objeto) — mesmo motivo de performance do
   * comentário acima. Ler por nome com `valorNativoEntradasSaidas()`, nunca
   * indexando na mão. */
  nativos: number[];
}

/** Números do arquivo usam vírgula decimal (padrão BR) — mesma regra de
 * `normalizar-desempenho.ts`, duplicada aqui de propósito pra este parser não
 * depender daquele módulo (import cruzado desnecessário entre os dois). */
function parseNumeroBr(valor: string | undefined): number {
  if (!valor) return 0;
  const normalizado = valor.replace(/\./g, "").replace(",", ".");
  const numero = Number(normalizado);
  return Number.isFinite(numero) ? numero : 0;
}

/** Valor de um campo nativo (Compras/Outras Entradas/Valor/.../Estoque Disponível)
 * pelo nome da coluna — `0` se o ref não existir na lista extraída aqui. */
export function valorNativoEntradasSaidas(registro: RegistroEntradasSaidas, ref: string): number {
  const indice = INDICE_NATIVOS.get(ref);
  return indice === undefined ? 0 : (registro.nativos[indice] ?? 0);
}

/**
 * Normaliza um arquivo mensal (mesmo `bd<Mês>.txt` do Desempenho Comercial, já
 * decodificado) pros campos que o Entradas e Saídas usa. Não valida cabeçalho
 * (`validarCabecalhoOuFalhar`) de novo — quem chama já validou ao processar
 * pelo caminho do Desempenho Comercial; ver nota de "Próximo passo" abaixo
 * sobre isso não estar plugado em nenhum lugar ainda.
 */
export function normalizarEntradasSaidas(
  conteudo: string,
  produtosPorCodigo: Map<string, Produto>,
  lojasPorCodigo: Map<string, Loja>,
): RegistroEntradasSaidas[] {
  const linhas = parseTabela(conteudo, CAMPOS, true);
  return linhas.map((l) => {
    const unidadeCodigo = l["Unidade Código"];
    return {
      codigo: l["Código"],
      unidadeCodigo,
      data: l["Data"],
      produto: produtosPorCodigo.get(l["Código"]) ?? null,
      loja: unidadeCodigo ? (lojasPorCodigo.get(unidadeCodigo) ?? null) : null,
      nativos: REFS_NATIVOS.map((ref) => parseNumeroBr(l[ref])),
    };
  });
}

/**
 * Próximo passo (não feito ainda): plugar isto num cache próprio em
 * `file-provider.ts` (`criarCacheVersionado`, mesmo padrão de
 * `getDesempenhoCache`) e numa função de agregação própria (análoga a
 * `agregarPorEstrutura`/`agregarPorLoja` em `lib/desempenho/aggregate.ts`, mas
 * lendo `RegistroEntradasSaidas.nativos` via `valorNativoEntradasSaidas` em vez
 * dos campos fixos de `Metricas`) — só nesse momento o módulo passa a ter
 * página/rota de verdade.
 */
