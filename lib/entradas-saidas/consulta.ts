import {
  agregarComprador,
  agregarDepartamento,
  agregarPorLoja,
  filtrarPorComprador,
  filtrarPorLojas,
  filtrarPorNoEstrutura,
  somarLinhas,
  type LinhaReduzida,
  type NoEntradasSaidas,
  type NoLoja,
} from "./aggregate";
import { NIVEIS_ESTRUTURA, type NivelEstrutura, type NivelHierarquia } from "@/lib/desempenho/aggregate";
import type { IndiceDepartamentos } from "@/lib/desempenho/comprador-cadastro";
import type { ValoresNativos } from "@/lib/parametros/avaliador";
import type { DepartamentoCadastro } from "@/lib/parametros/types";

/** Códigos dos departamentos marcados "excluir do total principal" (ex.: "Apropriações")
 * — usar sempre o código, nunca o nome, pra não depender de como o departamento está
 * escrito no cadastro hoje. */
export function departamentosExcluidosDoTotal(departamentosCadastro: DepartamentoCadastro[]): Set<string> {
  return new Set(departamentosCadastro.filter((d) => d.excluirDoTotalPrincipal).map((d) => d.codigo));
}

/**
 * Ponto único de agregação do Entradas e Saídas — mesmo espírito de
 * `lib/desempenho/consulta.ts`, com duas diferenças de propósito (decisão de
 * 2026-09-30): período único, sempre um mês inteiro (a seleção do arquivo já
 * FAZ o filtro de período — ver `getEntradasSaidasReduzido` em
 * `file-provider.ts` — então esta função não filtra nada por data); e **dois
 * drill-downs independentes** em vez de um só (Departamento e
 * Comprador→Departamento→..., sem tabela de Loja).
 */

/** Um nó do breadcrumb — mesmo shape de `NoSelecionado` do Desempenho Comercial,
 * mas só níveis da Hierarquia de Grupos (nunca "comprador": esse é tratado à
 * parte por `compradorSelecionado`, ver abaixo). */
export interface NoSelecionadoES {
  nivel: NivelHierarquia;
  chave: string;
  nome: string;
}

export interface ConsultaEntradasSaidas {
  caminhoDepartamento: NoSelecionadoES[];
  /** Nome do comprador escolhido no painel Comprador — `null` = ainda no nível
   * "Comprador" (raiz daquele painel, antes de descer pra Departamento). */
  compradorSelecionado: string | null;
  /** Caminho dentro do comprador escolhido (Departamento → ... → Produto) —
   * ignorado enquanto `compradorSelecionado` for `null`. */
  caminhoDentroComprador: NoSelecionadoES[];
  /** Códigos de Loja escolhidos no filtro (decisão de 2026-09-30) — vazio = todas.
   * Recorte prévio, aplicado antes de tudo. */
  lojas: string[];
  /** Qual dos dois painéis alimenta a tabela informativa de Lojas (decisão de
   * 2026-09-30) — segue o último clique: clicou numa linha de Departamento,
   * vira "departamento"; clicou numa de Comprador (inclusive escolher o
   * comprador), vira "comprador". Painel não-navegável, só reflete o recorte. */
  focoLojas: "departamento" | "comprador";
  /** Código do Produto clicado no último nível do drill-down (folha, sem como
   * descer mais) — decisão de 2026-10-01: clicar num Produto não navega a
   * tabela Departamento/Comprador (não tem pra onde descer), mas o painel
   * Lojas ainda deve estreitar pra SÓ as lojas que têm aquele produto, em vez
   * de continuar mostrando o agregado do pai (Sub Grupo/Categoria). `null` =
   * sem produto em foco, painel Lojas reflete o nível normal do breadcrumb. */
  produtoFoco: string | null;
}

export const CONSULTA_ENTRADAS_SAIDAS_PADRAO: ConsultaEntradasSaidas = {
  caminhoDepartamento: [],
  compradorSelecionado: null,
  caminhoDentroComprador: [],
  lojas: [],
  focoLojas: "departamento",
  produtoFoco: null,
};

export interface ResultadoEntradasSaidas {
  kpi: ValoresNativos;
  nivelDepartamento: NivelEstrutura;
  linhasDepartamento: NoEntradasSaidas[];
  /** "comprador" enquanto nenhum comprador foi escolhido; depois disso, o
   * nível da Hierarquia dentro daquele comprador. */
  nivelComprador: "comprador" | NivelEstrutura;
  linhasComprador: NoEntradasSaidas[];
  /** Tabela informativa de Lojas — reflete `consulta.focoLojas` (ver comentário lá). */
  linhasLoja: NoLoja[];
}

/**
 * `linhas` já vem reduzida e já vem só do mês escolhido (ver
 * `getEntradasSaidasReduzido(nomesArquivo)`) — esta função só filtra pelo
 * drill-down e agrega, nunca por data.
 */
export function computarEntradasSaidas(
  linhasSemFiltroDeLoja: LinhaReduzida[],
  consulta: ConsultaEntradasSaidas,
  indiceComprador: IndiceDepartamentos,
  /** Códigos de Departamento marcados "excluir do total principal" (ex.: "Apropriações",
   * cadastro em /parametros → Departamentos) — ficam de fora só do `kpi`, continuam
   * aparecendo normalmente nas tabelas de drill-down. */
  departamentosExcluidosDoTotal: ReadonlySet<string> = new Set(),
): ResultadoEntradasSaidas {
  const linhas = filtrarPorLojas(linhasSemFiltroDeLoja, consulta.lojas);

  // --- painel Departamento (raiz: Departamento) ---
  const nivelDepartamento = NIVEIS_ESTRUTURA[consulta.caminhoDepartamento.length] ?? "produto";
  let baseDepartamento = linhas;
  for (const no of consulta.caminhoDepartamento) baseDepartamento = filtrarPorNoEstrutura(baseDepartamento, no.nivel, no.chave);
  const linhasDepartamento = agregarDepartamento(baseDepartamento, nivelDepartamento);

  // --- painel Comprador (raiz: Comprador, depois entra em Departamento→...) ---
  let linhasComprador: NoEntradasSaidas[];
  let nivelComprador: "comprador" | NivelEstrutura;
  // Sem comprador escolhido, o "recorte" do painel Comprador ainda é tudo (`linhas`) —
  // é a mesma base que `agregarComprador` agrupa; guardada aqui pra alimentar o foco
  // de Lojas também (ver `linhasFoco` abaixo).
  let baseComprador = linhas;
  if (!consulta.compradorSelecionado) {
    nivelComprador = "comprador";
    linhasComprador = agregarComprador(linhas, indiceComprador);
  } else {
    baseComprador = filtrarPorComprador(linhas, consulta.compradorSelecionado, indiceComprador);
    for (const no of consulta.caminhoDentroComprador) baseComprador = filtrarPorNoEstrutura(baseComprador, no.nivel, no.chave);
    nivelComprador = NIVEIS_ESTRUTURA[consulta.caminhoDentroComprador.length] ?? "produto";
    linhasComprador = agregarDepartamento(baseComprador, nivelComprador);
  }

  // --- painel Lojas (informativo, não-navegável — reflete o foco atual) ---
  let linhasFoco = consulta.focoLojas === "departamento" ? baseDepartamento : baseComprador;
  if (consulta.produtoFoco) linhasFoco = linhasFoco.filter((l) => l.codigo === consulta.produtoFoco);
  const linhasLoja = agregarPorLoja(linhasFoco);

  const linhasParaKpi =
    departamentosExcluidosDoTotal.size === 0 ? linhas : linhas.filter((l) => !departamentosExcluidosDoTotal.has(l.dpto));

  return { kpi: somarLinhas(linhasParaKpi), nivelDepartamento, linhasDepartamento, nivelComprador, linhasComprador, linhasLoja };
}
