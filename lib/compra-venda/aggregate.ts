import { nomeCompradorPorDptoCadastro, type IndiceDepartamentos } from "@/lib/desempenho/comprador-cadastro";
import { filtrarPorComprador, filtrarPorNoEstrutura, type LinhaReduzida, type NoEntradasSaidas } from "@/lib/entradas-saidas/aggregate";
import type { ConsultaEntradasSaidas, NoSelecionadoES, ResultadoEntradasSaidas } from "@/lib/entradas-saidas/consulta";

/**
 * Compra e Venda reaproveita o motor inteiro do Entradas e Saídas (mesma linha
 * reduzida, mesmas funções de agregação/drill-down em
 * `lib/entradas-saidas/aggregate.ts` e `lib/entradas-saidas/consulta.ts`) — só
 * acréscimos de propósito (decisão de 2026-09-30): filtrar por Formato antes
 * de agregar (ou "Todos", somando os formatos), e injetar a Meta cadastrada —
 * tanto nos nós de Departamento quanto nos de Comprador (decisão de
 * 2026-09-30: a meta é cadastrada por Departamento×Formato, mas o Comprador
 * também precisa ver a dele, ponderada pelas Vendas atuais dos Departamentos
 * que ele compra).
 */

/** "Todos" soma Varejo + Atacado juntos — não filtra nada. */
export const FORMATO_TODOS = "Todos";

export function filtrarPorFormato(linhas: LinhaReduzida[], formato: string): LinhaReduzida[] {
  if (formato === FORMATO_TODOS) return linhas;
  return linhas.filter((l) => l.formatoLoja === formato);
}

/** Peso (Venda atual) de cada par Departamento×Formato no mês selecionado —
 * base pra ponderar a Meta quando "Todos" mistura Varejo e Atacado (cada um
 * pode ter uma meta própria) e pra ponderar a Meta de cada Comprador pelos
 * Departamentos que ele compra. Vem de `linhasBrutas` (SEM filtrar por
 * Formato — precisa dos dois lados pra ponderar). */
export interface PesoDepartamentoFormato {
  dpto: string;
  formato: string;
  venda: number;
}

export function pesosPorDepartamentoFormato(linhasBrutas: LinhaReduzida[]): PesoDepartamentoFormato[] {
  const mapa = new Map<string, PesoDepartamentoFormato>();
  for (const linha of linhasBrutas) {
    const chave = `${linha.dpto}|${linha.formatoLoja}`;
    const atual = mapa.get(chave) ?? { dpto: linha.dpto, formato: linha.formatoLoja, venda: 0 };
    atual.venda += linha.valores.Valor ?? 0;
    mapa.set(chave, atual);
  }
  return Array.from(mapa.values());
}

/** Média ponderada por `peso`, só sobre os itens que TÊM meta (item sem meta não entra
 * nem no numerador nem no denominador — "sem meta cadastrada" não é "meta zero"). */
function metaPonderadaPorChave(itens: { chave: string; peso: number; meta: number | undefined }[]): Map<string, number> {
  const somaPonderada = new Map<string, number>();
  const pesoComMeta = new Map<string, number>();
  for (const item of itens) {
    if (item.meta === undefined) continue;
    somaPonderada.set(item.chave, (somaPonderada.get(item.chave) ?? 0) + item.meta * item.peso);
    pesoComMeta.set(item.chave, (pesoComMeta.get(item.chave) ?? 0) + item.peso);
  }
  const resultado = new Map<string, number>();
  for (const [chave, peso] of pesoComMeta) {
    if (peso > 0) resultado.set(chave, somaPonderada.get(chave)! / peso);
  }
  return resultado;
}

/** Meta por Departamento na visão escolhida — com um Formato específico é a meta
 * cadastrada direto; em "Todos" é a média ponderada entre Varejo e Atacado pela
 * Venda atual de cada um (pedido de 2026-09-30). */
export function metasPorDepartamento(
  pesos: PesoDepartamentoFormato[],
  metas: Record<string, number>,
  formatoView: string,
): Map<string, number> {
  const itens = pesos
    .filter((p) => formatoView === FORMATO_TODOS || p.formato === formatoView)
    .map((p) => ({ chave: p.dpto, peso: p.venda, meta: metas[`${p.dpto}|${p.formato}`] }));
  return metaPonderadaPorChave(itens);
}

/** Meta do TOTAL (card de KPI) — uma única média ponderada pela Venda atual de
 * todos os Departamentos (mesmo espírito de `metasPorDepartamento`, só que
 * colapsado numa chave só em vez de uma por Departamento). Sem isso, o ref
 * sintético "Meta" nunca existe no nível do KPI — só nos nós de Departamento/
 * Comprador — e qualquer calculada que dependa dela (ex.: "GAP R$") fica vazia
 * no card mesmo tendo dado na tabela. */
export function metaTotalPonderada(
  pesos: PesoDepartamentoFormato[],
  metas: Record<string, number>,
  formatoView: string,
): number | undefined {
  const itens = pesos
    .filter((p) => formatoView === FORMATO_TODOS || p.formato === formatoView)
    .map((p) => ({ chave: "total", peso: p.venda, meta: metas[`${p.dpto}|${p.formato}`] }));
  return metaPonderadaPorChave(itens).get("total");
}

/** Meta por Comprador — ponderada pela Venda atual de cada Departamento que ele
 * compra (mesmo espírito do Total: metas percentuais não somam, têm que ser
 * ponderadas pelo volume de cada parte). */
export function metasPorComprador(
  pesos: PesoDepartamentoFormato[],
  metas: Record<string, number>,
  formatoView: string,
  indiceComprador: IndiceDepartamentos,
): Map<string, number> {
  const itens = pesos
    .filter((p) => formatoView === FORMATO_TODOS || p.formato === formatoView)
    .map((p) => ({
      chave: nomeCompradorPorDptoCadastro(indiceComprador, p.dpto, p.formato),
      peso: p.venda,
      meta: metas[`${p.dpto}|${p.formato}`],
    }));
  return metaPonderadaPorChave(itens);
}

/** Injeta o ref sintético "Meta" nos nós que têm meta calculada — por `codigo`
 * (nós de Departamento) ou por `nome` (nós de Comprador). Nível mais fundo do
 * drill-down (Seção/Categoria/Produto) nunca casa (não tem meta cadastrada
 * nesse grão) — "Meta - Realizado" mostra "—", correto. */
export function injetarMetas(
  nos: NoEntradasSaidas[],
  metasPorChave: Map<string, number>,
  porCampo: "codigo" | "nome",
): NoEntradasSaidas[] {
  return nos.map((no) => {
    const chave = porCampo === "codigo" ? no.codigo : no.nome;
    if (!chave) return no;
    const meta = metasPorChave.get(chave);
    if (meta === undefined) return no;
    return { ...no, valores: { ...no.valores, Meta: meta } };
  });
}

/** Departamento/Seção/.../Comprador sem NENHUM movimento no mês (Compra e Venda
 * zerados os dois) — linha morta pro recorte escolhido (ex.: Loja que não compra
 * nem vende naquele Departamento), só polui a tabela sem informar nada (pedido
 * de 2026-10-01). Only os dois juntos: uma linha com Venda e Compra zerada é
 * "sem movimento" de verdade, mas só uma delas zerada ainda é informação real
 * (ex.: comprou mas ainda não vendeu). */
function semMovimento(no: NoEntradasSaidas): boolean {
  return (no.valores.Compras ?? 0) === 0 && (no.valores.Valor ?? 0) === 0;
}

function removerSemMovimento(nos: NoEntradasSaidas[]): NoEntradasSaidas[] {
  return nos.filter((no) => !semMovimento(no));
}

/** Aplica a MESMA meta a todos os nós — usado quando o drill-down já passou do
 * nível Departamento (Seção/Categoria/Grupo/Sub Grupo/Produto): a meta é
 * cadastrada só por Departamento, então por enquanto (decisão de 2026-09-30)
 * o valor do Departamento vale pra toda a estrutura abaixo dele. */
function aplicarMetaFixa(nos: NoEntradasSaidas[], meta: number | undefined): NoEntradasSaidas[] {
  if (meta === undefined) return nos;
  return nos.map((no) => ({ ...no, valores: { ...no.valores, Meta: meta } }));
}

/** Código do Departamento sendo visto AGORA num painel já drilled (1º passo do
 * breadcrumb sempre escolhe o Departamento, nos dois painéis) — acha 1 linha
 * bruta dentro dele e lê o `dpto`, já que os nós profundos (Seção, Categoria,
 * ...) não guardam `codigo` (só o nível "departamento" guarda). */
function codigoDoDepartamentoEmFoco(linhas: LinhaReduzida[], primeiroPassoDoBreadcrumb: NoSelecionadoES | undefined): string | null {
  if (!primeiroPassoDoBreadcrumb) return null;
  const dentro = filtrarPorNoEstrutura(linhas, primeiroPassoDoBreadcrumb.nivel, primeiroPassoDoBreadcrumb.chave);
  return dentro[0]?.dpto ?? null;
}

/**
 * Injeta a Meta nos dois painéis de uma vez — Departamento sempre por
 * `codigo` na raiz; Comprador por `nome` só na raiz daquele painel (lista de
 * Compradores); depois que alguém entra num Comprador, o painel vira uma
 * cadeia de Departamento→... igual à do outro painel, e a Meta volta a ser
 * por `codigo`. Abaixo do Departamento (em qualquer um dos dois painéis), a
 * meta do Departamento é replicada pra toda a estrutura (`aplicarMetaFixa`).
 * Ponto único usado tanto pela rota de API quanto pelo SSR inicial da
 * página, pra nunca divergir os dois cálculos.
 */
export function injetarMetasNoResultado(
  resultado: ResultadoEntradasSaidas,
  consulta: ConsultaEntradasSaidas,
  linhas: LinhaReduzida[],
  pesos: PesoDepartamentoFormato[],
  metasCadastradas: Record<string, number>,
  formatoView: string,
  indiceComprador: IndiceDepartamentos,
): ResultadoEntradasSaidas {
  const metasDpto = metasPorDepartamento(pesos, metasCadastradas, formatoView);
  const metasComprador = metasPorComprador(pesos, metasCadastradas, formatoView, indiceComprador);

  const linhasDepartamento =
    consulta.caminhoDepartamento.length === 0
      ? injetarMetas(resultado.linhasDepartamento, metasDpto, "codigo")
      : aplicarMetaFixa(
          resultado.linhasDepartamento,
          metasDpto.get(codigoDoDepartamentoEmFoco(linhas, consulta.caminhoDepartamento[0]) ?? ""),
        );

  let linhasComprador: NoEntradasSaidas[];
  if (resultado.nivelComprador === "comprador") {
    linhasComprador = injetarMetas(resultado.linhasComprador, metasComprador, "nome");
  } else if (consulta.caminhoDentroComprador.length === 0) {
    linhasComprador = injetarMetas(resultado.linhasComprador, metasDpto, "codigo");
  } else {
    const linhasDoComprador = consulta.compradorSelecionado
      ? filtrarPorComprador(linhas, consulta.compradorSelecionado, indiceComprador)
      : [];
    linhasComprador = aplicarMetaFixa(
      resultado.linhasComprador,
      metasDpto.get(codigoDoDepartamentoEmFoco(linhasDoComprador, consulta.caminhoDentroComprador[0]) ?? ""),
    );
  }

  const metaTotal = metaTotalPonderada(pesos, metasCadastradas, formatoView);

  return {
    ...resultado,
    kpi: metaTotal !== undefined ? { ...resultado.kpi, Meta: metaTotal } : resultado.kpi,
    linhasDepartamento: removerSemMovimento(linhasDepartamento),
    linhasComprador: removerSemMovimento(linhasComprador),
  };
}
