import { REFS_ENTRADAS_SAIDAS_SNAPSHOT, REFS_NATIVOS_ENTRADAS_SAIDAS } from "@/config/data-sources";
import { caminhoAteNivel, NIVEIS_ESTRUTURA, type NivelEstrutura, type NivelHierarquia } from "@/lib/desempenho/aggregate";
import { nomeCompradorPorDptoCadastro, type IndiceDepartamentos } from "@/lib/desempenho/comprador-cadastro";
import { valorNativoEntradasSaidas, type RegistroEntradasSaidas } from "@/lib/data-providers/normalizar-entradas-saidas";
import type { ValoresNativos } from "@/lib/parametros/avaliador";

/**
 * Agregação do Entradas e Saídas — separada de `lib/desempenho/aggregate.ts`
 * de propósito (mesmo motivo do parser: fonte de dado e forma da linha são
 * diferentes; reusa só as peças puras: `caminhoAteNivel`, `NIVEIS_ESTRUTURA`).
 *
 * Duas hierarquias raiz, cada uma com drill-down independente (decisão de
 * 2026-09-30, sem tabela de Loja):
 * - **Departamento**: Departamento → Seção → Categoria → Grupo → Sub Grupo → Produto.
 * - **Comprador**: Comprador → Departamento → ... → Produto (mesma cadeia, um
 *   nível a mais na frente).
 */

/** Refs que são fluxo do período (somam normalmente linha a linha) — todas as
 * nativas do Entradas e Saídas/Compra e Venda exceto `REFS_ENTRADAS_SAIDAS_SNAPSHOT`
 * (Estoque/Qtde VMD e afins, que são fotografia, ver abaixo). */
const REFS_SNAPSHOT_SET = new Set<string>(REFS_ENTRADAS_SAIDAS_SNAPSHOT);
const REFS_FLUXO = REFS_NATIVOS_ENTRADAS_SAIDAS.filter((ref) => !REFS_SNAPSHOT_SET.has(ref));

export type NivelEntradasSaidas = NivelEstrutura | "comprador";
export const NIVEIS_ENTRADAS_SAIDAS: NivelEntradasSaidas[] = ["comprador", ...NIVEIS_ESTRUTURA];

/**
 * Uma linha por Produto×Loja, já reduzida do período inteiro: campos de fluxo
 * somados entre todas as datas (cada dia é movimento novo, soma normal);
 * `REFS_ENTRADAS_SAIDAS_SNAPSHOT` (Estoque/Qtde VMD e afins) tomados de uma
 * ocorrência só (são o mesmo valor repetido em toda linha do mês — confirmado
 * no arquivo real em 2026-09-30; somar contaria o mesmo valor várias vezes). A
 * partir daqui, agregações maiores (por Departamento, por Comprador) somam
 * esta linha normalmente — inclusive os snapshot, porque aí já é soma entre
 * produtos DIFERENTES, que é válida.
 */
export interface LinhaReduzida {
  codigo: string;
  descricao: string;
  complemento: string;
  dpto: string;
  hierarquiaGrupos: string;
  formatoLoja: string;
  /** Código da loja (`codUnid`) — só usado pelo filtro de Loja (decisão de 2026-09-30);
   * agregação por Departamento/Comprador nunca olha pra isso. */
  lojaCodigo: string;
  valores: ValoresNativos;
}

/** "DD/MM/AA" → comparável lexicograficamente (AAAA-MM-DD) — só usado aqui pra
 * decidir qual ocorrência de Estoque/VMD é a mais recente dentro do período. */
function dataOrdenavel(data: string): string {
  const m = data.match(/^(\d{2})\/(\d{2})\/(\d{2})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
}

export function reduzirPorProdutoLoja(registros: RegistroEntradasSaidas[]): LinhaReduzida[] {
  const mapa = new Map<
    string,
    { codigo: string; descricao: string; complemento: string; dpto: string; hierarquiaGrupos: string; formatoLoja: string; lojaCodigo: string; fluxo: Record<string, number>; snapshot: Record<string, number>; ultimaData: string }
  >();

  for (const r of registros) {
    if (!r.produto || !r.loja) continue;
    const chave = `${r.codigo}|${r.unidadeCodigo}`;
    let entrada = mapa.get(chave);
    if (!entrada) {
      entrada = {
        codigo: r.codigo,
        descricao: r.descricao,
        complemento: r.complemento,
        dpto: r.produto.dpto,
        hierarquiaGrupos: r.produto.hierarquiaGrupos,
        formatoLoja: r.loja.formato,
        lojaCodigo: r.loja.codUnid,
        fluxo: {},
        snapshot: {},
        ultimaData: "",
      };
      mapa.set(chave, entrada);
    }
    for (const ref of REFS_FLUXO) {
      entrada.fluxo[ref] = (entrada.fluxo[ref] ?? 0) + valorNativoEntradasSaidas(r, ref);
    }
    const ordenavel = dataOrdenavel(r.data);
    if (ordenavel >= entrada.ultimaData) {
      entrada.ultimaData = ordenavel;
      for (const ref of REFS_ENTRADAS_SAIDAS_SNAPSHOT) {
        entrada.snapshot[ref] = valorNativoEntradasSaidas(r, ref);
      }
    }
  }

  return Array.from(mapa.values()).map((e) => ({
    codigo: e.codigo,
    descricao: e.descricao,
    complemento: e.complemento,
    dpto: e.dpto,
    hierarquiaGrupos: e.hierarquiaGrupos,
    formatoLoja: e.formatoLoja,
    lojaCodigo: e.lojaCodigo,
    valores: { ...e.fluxo, ...e.snapshot },
  }));
}

/**
 * Junta as linhas já reduzidas de VÁRIOS meses (decisão de 2026-10-01 — período
 * deixou de ser só 1 mês) numa linha só por Produto×Loja. Precisa ser feito aqui,
 * não só concatenar os arrays (`.flat()`): campos de FLUXO (Compras, Valor, ...)
 * somam normalmente entre meses, mas os de FOTO (`REFS_ENTRADAS_SAIDAS_SNAPSHOT`
 * — Estoque Disponível, Qtde VMD, ...) são o mesmo problema de somar dentro de um
 * mês só multiplicado: cada mês carrega seu PRÓPRIO snapshot (o estoque no fim
 * daquele mês), e somar os snapshots de 2 meses inventa um "estoque" que não
 * existe (contaria o mesmo estoque físico mais de uma vez). Por isso o campo de
 * foto fica com o valor do mês mais RECENTE entre os escolhidos, nunca a soma —
 * `porMes` precisa vir em ordem cronológica (mesma ordem de `NOMES_MESES_ARQUIVO`,
 * garantida por quem chama, ver `file-provider.ts`).
 */
export function mesclarMeses(porMes: LinhaReduzida[][]): LinhaReduzida[] {
  const mapa = new Map<string, LinhaReduzida>();
  for (const linhasDoMes of porMes) {
    for (const linha of linhasDoMes) {
      const chave = `${linha.codigo}|${linha.lojaCodigo}`;
      const anterior = mapa.get(chave);
      if (!anterior) {
        mapa.set(chave, linha);
        continue;
      }
      const valoresFundidos: ValoresNativos = { ...anterior.valores };
      for (const [ref, valor] of Object.entries(linha.valores)) {
        valoresFundidos[ref] = REFS_SNAPSHOT_SET.has(ref) ? valor : (valoresFundidos[ref] ?? 0) + valor;
      }
      mapa.set(chave, { ...linha, valores: valoresFundidos });
    }
  }
  return Array.from(mapa.values());
}

function somarValores(a: ValoresNativos, b: ValoresNativos): ValoresNativos {
  const resultado = { ...a };
  for (const [ref, valor] of Object.entries(b)) resultado[ref] = (resultado[ref] ?? 0) + valor;
  return resultado;
}

export interface NoEntradasSaidas {
  chave: string;
  codigo: string | null;
  nome: string;
  nivel: NivelEntradasSaidas;
  valores: ValoresNativos;
}

/** Nível "Produto" — folha do drill-down, agrupado por SKU (igual ao Desempenho Comercial). */
function agregarPorProduto(linhas: LinhaReduzida[]): NoEntradasSaidas[] {
  const mapa = new Map<string, { nome: string; valores: ValoresNativos }>();
  for (const linha of linhas) {
    const chave = linha.codigo;
    if (!chave) continue;
    const nome = [linha.descricao, linha.complemento].filter(Boolean).join(" - ");
    const atual = mapa.get(chave);
    mapa.set(chave, { nome, valores: somarValores(atual?.valores ?? {}, linha.valores) });
  }
  return Array.from(mapa.entries()).map(([chave, dados]) => ({
    chave,
    codigo: chave,
    nome: dados.nome,
    nivel: "produto" as const,
    valores: dados.valores,
  }));
}

/** Departamento → Seção → Categoria → Grupo → Sub Grupo (mesma cadeia do Desempenho Comercial). */
function agregarPorEstrutura(linhas: LinhaReduzida[], nivel: NivelHierarquia): NoEntradasSaidas[] {
  const mapa = new Map<string, { nome: string; codigo: string | null; valores: ValoresNativos }>();
  for (const linha of linhas) {
    const chave = caminhoAteNivel(linha.hierarquiaGrupos, nivel);
    if (!chave) continue;
    const nome = chave.split(" > ").at(-1) ?? chave;
    const codigo = nivel === "departamento" ? linha.dpto : null;
    const atual = mapa.get(chave);
    mapa.set(chave, { nome, codigo, valores: somarValores(atual?.valores ?? {}, linha.valores) });
  }
  return Array.from(mapa.entries()).map(([chave, dados]) => ({
    chave,
    codigo: dados.codigo,
    nome: dados.nome,
    nivel,
    valores: dados.valores,
  }));
}

/**
 * Agrega pra um nível da cadeia Departamento→...→Produto (raiz "Departamento").
 * `caminho` é o breadcrumb já escolhido (drill-down); `linhas` já vem filtrada
 * pelo nó ativo (ver `lib/entradas-saidas/consulta.ts`).
 */
export function agregarDepartamento(linhas: LinhaReduzida[], nivel: NivelEstrutura): NoEntradasSaidas[] {
  if (nivel === "produto") return agregarPorProduto(linhas);
  const nos = agregarPorEstrutura(linhas, nivel);
  // Departamento contábil (ex: "Apropriações") não tem Seção/Categoria/Grupo/Sub Grupo de
  // verdade — a Hierarquia de Grupos dos seus produtos é curta demais pra alcançar este
  // nível, e `caminhoAteNivel` devolve `null` pra todo mundo (ver função acima). Sem este
  // fallback a tabela fica vazia ao descer, mesmo com linhas de sobra — cai direto pra
  // Produto (que agrupa por SKU, não depende da Hierarquia de Grupos) em vez de sumir.
  if (nos.length === 0 && linhas.length > 0) return agregarPorProduto(linhas);
  return nos;
}

/**
 * Agrega pra um nível da cadeia Comprador→Departamento→...→Produto (raiz
 * "Comprador"). Comprador não é um nível da Hierarquia de Grupos do produto —
 * vem do cadastro Departamento→Comprador (por formato de loja, seção 2.3 de
 * docs/parametros.md), resolvido aqui por linha antes de agrupar.
 */
export function agregarComprador(linhas: LinhaReduzida[], indiceComprador: IndiceDepartamentos): NoEntradasSaidas[] {
  const mapa = new Map<string, ValoresNativos>();
  for (const linha of linhas) {
    const nome = nomeCompradorPorDptoCadastro(indiceComprador, linha.dpto, linha.formatoLoja);
    mapa.set(nome, somarValores(mapa.get(nome) ?? {}, linha.valores));
  }
  return Array.from(mapa.entries()).map(([nome, valores]) => ({
    chave: nome,
    codigo: null,
    nome,
    nivel: "comprador" as const,
    valores,
  }));
}

/** Restringe as linhas reduzidas ao Comprador escolhido no drill-down — mesma
 * resolução de `agregarComprador`, aplicada por linha. */
export function filtrarPorComprador(linhas: LinhaReduzida[], comprador: string, indiceComprador: IndiceDepartamentos): LinhaReduzida[] {
  return linhas.filter((l) => nomeCompradorPorDptoCadastro(indiceComprador, l.dpto, l.formatoLoja) === comprador);
}

/** Restringe as linhas reduzidas ao nó de Estrutura escolhido no drill-down
 * (Departamento/Seção/Categoria/Grupo/Sub Grupo) — igual a `pertenceAoNo` do
 * Desempenho Comercial, mas sobre `LinhaReduzida` em vez de `RegistroDesempenho`. */
export function filtrarPorNoEstrutura(linhas: LinhaReduzida[], nivel: NivelHierarquia, chave: string): LinhaReduzida[] {
  return linhas.filter((l) => caminhoAteNivel(l.hierarquiaGrupos, nivel) === chave);
}

/** Filtro de Loja (decisão de 2026-09-30, Entradas e Saídas e Compra e Venda) —
 * recorte prévio, igual Formato no Compra e Venda: reduz `linhas` ANTES de
 * agregar por Departamento/Comprador, não cria tabela própria (isso é um
 * pedido separado, ainda não construído). Lista vazia = nenhum filtro (todas
 * as lojas), mesmo padrão do `MultiSelect` (seleção vazia = "Todas"). */
export function filtrarPorLojas(linhas: LinhaReduzida[], codigosLoja: string[]): LinhaReduzida[] {
  if (codigosLoja.length === 0) return linhas;
  const selecionadas = new Set(codigosLoja);
  return linhas.filter((l) => selecionadas.has(l.lojaCodigo));
}

/** Soma um conjunto de nós (ex: linhas de uma tabela) num subtotal. */
export function somarNos(nos: NoEntradasSaidas[]): ValoresNativos {
  return nos.reduce((acc, no) => somarValores(acc, no.valores), {} as ValoresNativos);
}

/** Soma um conjunto de linhas reduzidas direto (sem agrupar por nível) — usado pro KPI total. */
export function somarLinhas(linhas: LinhaReduzida[]): ValoresNativos {
  return linhas.reduce((acc, l) => somarValores(acc, l.valores), {} as ValoresNativos);
}

/** Um nó da tabela informativa de Lojas (decisão de 2026-09-30: painel à parte,
 * não-navegável, pra comparar lojas do MESMO recorte que está selecionado em
 * Departamento ou Comprador — "essa loja está com excesso, essa está precisando",
 * decisão de transferência interna). Nome/formato resolvidos à parte, pelo
 * cadastro de Lojas — aqui só o código e os valores agregados. */
export interface NoLoja {
  codigo: string;
  valores: ValoresNativos;
}

export function agregarPorLoja(linhas: LinhaReduzida[]): NoLoja[] {
  const mapa = new Map<string, ValoresNativos>();
  for (const l of linhas) mapa.set(l.lojaCodigo, somarValores(mapa.get(l.lojaCodigo) ?? {}, l.valores));
  return Array.from(mapa.entries()).map(([codigo, valores]) => ({ codigo, valores }));
}
