import {
  agregarComprador,
  agregarDepartamento,
  filtrarPorComprador,
  filtrarPorNoEstrutura,
  somarLinhas,
  type LinhaReduzida,
  type NoEntradasSaidas,
} from "./aggregate";
import { NIVEIS_ESTRUTURA, type NivelEstrutura, type NivelHierarquia } from "@/lib/desempenho/aggregate";
import type { IndiceDepartamentos } from "@/lib/desempenho/comprador-cadastro";
import type { ValoresNativos } from "@/lib/parametros/avaliador";

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
}

export const CONSULTA_ENTRADAS_SAIDAS_PADRAO: ConsultaEntradasSaidas = {
  caminhoDepartamento: [],
  compradorSelecionado: null,
  caminhoDentroComprador: [],
};

export interface ResultadoEntradasSaidas {
  kpi: ValoresNativos;
  nivelDepartamento: NivelEstrutura;
  linhasDepartamento: NoEntradasSaidas[];
  /** "comprador" enquanto nenhum comprador foi escolhido; depois disso, o
   * nível da Hierarquia dentro daquele comprador. */
  nivelComprador: "comprador" | NivelEstrutura;
  linhasComprador: NoEntradasSaidas[];
}

/**
 * `linhas` já vem reduzida e já vem só do mês escolhido (ver
 * `getEntradasSaidasReduzido(nomesArquivo)`) — esta função só filtra pelo
 * drill-down e agrega, nunca por data.
 */
export function computarEntradasSaidas(
  linhas: LinhaReduzida[],
  consulta: ConsultaEntradasSaidas,
  indiceComprador: IndiceDepartamentos,
): ResultadoEntradasSaidas {
  // --- painel Departamento (raiz: Departamento) ---
  const nivelDepartamento = NIVEIS_ESTRUTURA[consulta.caminhoDepartamento.length] ?? "produto";
  let baseDepartamento = linhas;
  for (const no of consulta.caminhoDepartamento) baseDepartamento = filtrarPorNoEstrutura(baseDepartamento, no.nivel, no.chave);
  const linhasDepartamento = agregarDepartamento(baseDepartamento, nivelDepartamento);

  // --- painel Comprador (raiz: Comprador, depois entra em Departamento→...) ---
  let linhasComprador: NoEntradasSaidas[];
  let nivelComprador: "comprador" | NivelEstrutura;
  if (!consulta.compradorSelecionado) {
    nivelComprador = "comprador";
    linhasComprador = agregarComprador(linhas, indiceComprador);
  } else {
    let baseComprador = filtrarPorComprador(linhas, consulta.compradorSelecionado, indiceComprador);
    for (const no of consulta.caminhoDentroComprador) baseComprador = filtrarPorNoEstrutura(baseComprador, no.nivel, no.chave);
    nivelComprador = NIVEIS_ESTRUTURA[consulta.caminhoDentroComprador.length] ?? "produto";
    linhasComprador = agregarDepartamento(baseComprador, nivelComprador);
  }

  return { kpi: somarLinhas(linhas), nivelDepartamento, linhasDepartamento, nivelComprador, linhasComprador };
}
