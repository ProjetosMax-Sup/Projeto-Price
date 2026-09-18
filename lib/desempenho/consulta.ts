import {
  agregarPorEstrutura,
  agregarPorLoja,
  agregarPorProduto,
  pertenceAoNo,
  somarMetricas,
  NIVEIS_ESTRUTURA,
  type EstruturaAgregada,
  type LojaAgregada,
  type Metricas,
  type NivelEstrutura,
  type NivelHierarquia,
  type NoSelecionado,
} from "@/lib/desempenho/aggregate";
import { nomeCompradorDoRegistro } from "@/lib/desempenho/compradores";
import type { Loja, RegistroDesempenho } from "@/lib/types";

export type { NoSelecionado } from "@/lib/desempenho/aggregate";

export interface Filtros {
  lojas: string[]; // vazio = todas
  formato: "Todos" | "Varejo" | "Atacado";
  comprador: string; // "Todos" ou nome do comprador padronizado
}

/**
 * Estado de filtros/seleção enviado do cliente para a API — só isso trafega
 * pela rede; os registros brutos (centenas de milhares de linhas) nunca saem
 * do servidor. `caminhoDrill` é o breadcrumb do drill-down (Departamento →
 * Seção → Categoria → Grupo → Sub Grupo → Produto); o nível exibido é sempre
 * o próximo depois do último nó do caminho.
 */
export interface ConsultaDesempenho {
  filtros: Filtros;
  caminhoDrill: NoSelecionado[];
  lojasSelecionadas: string[];
  nivelTopAltasQuedas: NivelHierarquia;
}

export interface ResultadoDesempenho {
  kpiAtual: Metricas;
  kpiComparacao: Metricas | null;
  estruturaNivel: NivelEstrutura;
  linhasEstrutura: EstruturaAgregada[];
  linhasLojas: LojaAgregada[];
  linhasTop: EstruturaAgregada[];
}

export const CONSULTA_PADRAO: ConsultaDesempenho = {
  filtros: { lojas: [], formato: "Todos", comprador: "Todos" },
  caminhoDrill: [],
  lojasSelecionadas: [],
  nivelTopAltasQuedas: "secao",
};

function aplicarFiltrosBase(registros: RegistroDesempenho[], filtros: Filtros): RegistroDesempenho[] {
  return registros.filter(
    (r) =>
      (filtros.lojas.length === 0 || (r.loja && filtros.lojas.includes(r.loja.codUnid))) &&
      (filtros.formato === "Todos" || r.loja?.formato === filtros.formato) &&
      (filtros.comprador === "Todos" || nomeCompradorDoRegistro(r) === filtros.comprador),
  );
}

/**
 * Ponto único de filtragem + agregação do módulo — roda no servidor (API route
 * e primeira renderização da página) para nunca precisar mandar os registros
 * brutos para o navegador.
 */
export function computarDesempenho(
  registrosAtual: RegistroDesempenho[],
  registrosComparacao: RegistroDesempenho[],
  lojas: Loja[],
  consulta: ConsultaDesempenho,
): ResultadoDesempenho {
  const { filtros, caminhoDrill, lojasSelecionadas, nivelTopAltasQuedas } = consulta;
  const noAtivo = caminhoDrill.at(-1) ?? null;
  const estruturaNivel = NIVEIS_ESTRUTURA[caminhoDrill.length] ?? "produto";

  const baseAtual = aplicarFiltrosBase(registrosAtual, filtros);
  const baseComparacao = aplicarFiltrosBase(registrosComparacao, filtros);

  const filtroSelecao = (r: RegistroDesempenho) =>
    (lojasSelecionadas.length === 0 || (r.loja && lojasSelecionadas.includes(r.loja.codUnid))) &&
    (!noAtivo || pertenceAoNo(r, noAtivo));

  // Recorte completo (filtros + seleção de lojas/estrutura) — alimenta KPIs e Top Altas/Quedas.
  const recorteAtual = baseAtual.filter(filtroSelecao);
  const recorteComparacao = baseComparacao.filter(filtroSelecao);

  // Estrutura: escopada pelas lojas selecionadas e pelo caminho de drill-down atual.
  const filtroLojas = (r: RegistroDesempenho) =>
    lojasSelecionadas.length === 0 || (r.loja && lojasSelecionadas.includes(r.loja.codUnid));
  let estruturaAtualBase = baseAtual.filter(filtroLojas);
  let estruturaComparacaoBase = baseComparacao.filter(filtroLojas);
  if (noAtivo) {
    estruturaAtualBase = estruturaAtualBase.filter((r) => pertenceAoNo(r, noAtivo));
    estruturaComparacaoBase = estruturaComparacaoBase.filter((r) => pertenceAoNo(r, noAtivo));
  }
  const linhasEstrutura =
    estruturaNivel === "produto"
      ? agregarPorProduto(estruturaAtualBase, estruturaComparacaoBase)
      : agregarPorEstrutura(estruturaAtualBase, estruturaComparacaoBase, estruturaNivel);

  // Lojas: escopada pelo nó de estrutura selecionado (não pela própria seleção de loja).
  const filtroEstrutura = (r: RegistroDesempenho) => !noAtivo || pertenceAoNo(r, noAtivo);
  const lojasAtualBase = baseAtual.filter(filtroEstrutura);
  const lojasComparacaoBase = baseComparacao.filter(filtroEstrutura);
  const linhasLojas = agregarPorLoja(lojasAtualBase, lojasComparacaoBase, lojas);

  // Top Altas/Quedas: segue o recorte completo (filtros + seleção de lojas/estrutura).
  const linhasTop = agregarPorEstrutura(recorteAtual, recorteComparacao, nivelTopAltasQuedas);

  const kpiAtual = somarMetricas(recorteAtual);
  const kpiComparacao = recorteComparacao.length > 0 ? somarMetricas(recorteComparacao) : null;

  return { kpiAtual, kpiComparacao, estruturaNivel, linhasEstrutura, linhasLojas, linhasTop };
}
