import {
  agregarPorEstrutura,
  agregarPorLoja,
  parseHierarquia,
  somarMetricas,
  type EstruturaAgregada,
  type LojaAgregada,
  type Metricas,
  type NivelEstrutura,
} from "@/lib/desempenho/aggregate";
import type { Loja, RegistroDesempenho } from "@/lib/types";

export interface Filtros {
  lojas: string[]; // vazio = todas
  formato: "Todos" | "Varejo" | "Atacado";
  comprador: string; // "Todos" ou código do comprador
}

export interface NoSelecionado {
  nivel: NivelEstrutura;
  chave: string;
  nome: string;
}

/**
 * Estado de filtros/seleção enviado do cliente para a API — só isso trafega
 * pela rede; os registros brutos (centenas de milhares de linhas) nunca saem
 * do servidor.
 */
export interface ConsultaDesempenho {
  filtros: Filtros;
  estruturaNivel: NivelEstrutura;
  departamentoAtivo: NoSelecionado | null;
  estruturaSelecionada: NoSelecionado | null;
  lojasSelecionadas: string[];
  nivelTopAltasQuedas: NivelEstrutura;
}

export interface ResultadoDesempenho {
  kpiAtual: Metricas;
  kpiComparacao: Metricas | null;
  linhasEstrutura: EstruturaAgregada[];
  linhasLojas: LojaAgregada[];
  linhasTop: EstruturaAgregada[];
}

export const CONSULTA_PADRAO: ConsultaDesempenho = {
  filtros: { lojas: [], formato: "Todos", comprador: "Todos" },
  estruturaNivel: "departamento",
  departamentoAtivo: null,
  estruturaSelecionada: null,
  lojasSelecionadas: [],
  nivelTopAltasQuedas: "secao",
};

function pertenceAoNo(hierarquiaGrupos: string, no: NoSelecionado): boolean {
  const niveis = parseHierarquia(hierarquiaGrupos);
  const profundidade = no.nivel === "departamento" ? 1 : 2;
  return niveis.slice(0, profundidade).join(" > ") === no.chave;
}

function aplicarFiltrosBase(registros: RegistroDesempenho[], filtros: Filtros): RegistroDesempenho[] {
  return registros.filter(
    (r) =>
      (filtros.lojas.length === 0 || (r.loja && filtros.lojas.includes(r.loja.codUnid))) &&
      (filtros.formato === "Todos" || r.loja?.formato === filtros.formato) &&
      (filtros.comprador === "Todos" || r.produto?.comprador === filtros.comprador),
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
  const { filtros, estruturaNivel, departamentoAtivo, estruturaSelecionada, lojasSelecionadas, nivelTopAltasQuedas } =
    consulta;

  const baseAtual = aplicarFiltrosBase(registrosAtual, filtros);
  const baseComparacao = aplicarFiltrosBase(registrosComparacao, filtros);

  const filtroSelecao = (r: RegistroDesempenho) =>
    (lojasSelecionadas.length === 0 || (r.loja && lojasSelecionadas.includes(r.loja.codUnid))) &&
    (!estruturaSelecionada || (r.produto && pertenceAoNo(r.produto.hierarquiaGrupos, estruturaSelecionada)));

  // Recorte completo (filtros + seleção de lojas/estrutura) — alimenta KPIs e Top Altas/Quedas.
  const recorteAtual = baseAtual.filter(filtroSelecao);
  const recorteComparacao = baseComparacao.filter(filtroSelecao);

  // Estrutura: escopada pelas lojas selecionadas (não pela própria seleção de estrutura).
  const filtroLojas = (r: RegistroDesempenho) =>
    lojasSelecionadas.length === 0 || (r.loja && lojasSelecionadas.includes(r.loja.codUnid));
  let estruturaAtualBase = baseAtual.filter(filtroLojas);
  let estruturaComparacaoBase = baseComparacao.filter(filtroLojas);
  if (estruturaNivel === "secao" && departamentoAtivo) {
    estruturaAtualBase = estruturaAtualBase.filter(
      (r) => r.produto && pertenceAoNo(r.produto.hierarquiaGrupos, departamentoAtivo),
    );
    estruturaComparacaoBase = estruturaComparacaoBase.filter(
      (r) => r.produto && pertenceAoNo(r.produto.hierarquiaGrupos, departamentoAtivo),
    );
  }
  const linhasEstrutura = agregarPorEstrutura(estruturaAtualBase, estruturaComparacaoBase, estruturaNivel);

  // Lojas: escopada pela estrutura selecionada (não pela própria seleção de loja).
  const filtroEstrutura = (r: RegistroDesempenho) =>
    !estruturaSelecionada || (r.produto && pertenceAoNo(r.produto.hierarquiaGrupos, estruturaSelecionada));
  const lojasAtualBase = baseAtual.filter(filtroEstrutura);
  const lojasComparacaoBase = baseComparacao.filter(filtroEstrutura);
  const linhasLojas = agregarPorLoja(lojasAtualBase, lojasComparacaoBase, lojas);

  // Top Altas/Quedas: segue o recorte completo (filtros + seleção de lojas/estrutura).
  const linhasTop = agregarPorEstrutura(recorteAtual, recorteComparacao, nivelTopAltasQuedas);

  const kpiAtual = somarMetricas(recorteAtual);
  const kpiComparacao = recorteComparacao.length > 0 ? somarMetricas(recorteComparacao) : null;

  return { kpiAtual, kpiComparacao, linhasEstrutura, linhasLojas, linhasTop };
}
