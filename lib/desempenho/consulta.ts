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
import { nomeCompradorDoRegistroCadastro, type IndiceDepartamentos } from "@/lib/desempenho/comprador-cadastro";
import {
  diasComVendaPorLoja,
  intervalosFechamento,
  isoParaDataLocal,
  lojaAbertaDesdeInicio,
  parseDataBr,
  primeiraVendaPorLoja,
} from "@/lib/desempenho/datas";
import type { Loja, RegistroDesempenho } from "@/lib/types";

export type { NoSelecionado } from "@/lib/desempenho/aggregate";

export interface Filtros {
  lojas: string[]; // vazio = todas
  formato: string[]; // vazio = todos ("Varejo" | "Atacado")
  comprador: string[]; // vazio = todos (nomes de comprador padronizados)
  departamentos: string[]; // vazio = todos (códigos de Dpto, ex: "008")
  /** "Mesmas Lojas": exclui dos totais/subtotais lojas que não estavam abertas desde o início
   * dos dois períodos (Atual e Comparação) — ver "Mesmas Lojas" em docs/regras-de-negocio.md.
   * As linhas dessas lojas continuam aparecendo na tabela de Lojas (ver LojaAgregada.mesmaLoja),
   * só não entram na soma. false = comportamento padrão, todas as lojas contam ("Total Lojas"). */
  mesmasLojas: boolean;
}

/** Intervalo de datas (ISO "AAAA-MM-DD", inclusive nas duas pontas) escolhido pelo usuário pra um período. */
export interface IntervaloData {
  inicio: string;
  fim: string;
}

/**
 * Estado de filtros/seleção enviado do cliente para a API — só isso trafega
 * pela rede; os registros brutos (centenas de milhares de linhas) nunca saem
 * do servidor. `caminhoDrill` é o breadcrumb do drill-down (Departamento →
 * Seção → Categoria → Grupo → Sub Grupo → Produto); o nível exibido é sempre
 * o próximo depois do último nó do caminho. `produtoSelecionado` é um SKU
 * escolhido dentro da lista de Produtos (folha do drill-down) — filtra
 * KPIs/Lojas por aquele produto específico sem navegar pra fora da lista de
 * produtos irmãos (diferente de descer um nível no caminho).
 */
export interface ConsultaDesempenho {
  filtros: Filtros;
  caminhoDrill: NoSelecionado[];
  produtoSelecionado: string | null;
  lojasSelecionadas: string[];
  nivelTopAltasQuedas: NivelHierarquia;
  /** null = período inteiro do arquivo (comportamento padrão/automático). */
  periodoAtual: IntervaloData | null;
  periodoComparacao: IntervaloData | null;
}

/** Valores de cada filtro principal que têm venda > 0 no recorte atual (período + os OUTROS 3
 * filtros, sem contar o próprio) — usado só pra desabilitar (fonte apagada) opções sem dado nos
 * multi-seleção; a opção continua aparecendo, só não dá pra marcar (a menos que já esteja
 * marcada — aí continua podendo desmarcar). Ver `docs/regras-de-negocio.md`. */
export interface OpcoesComDados {
  lojas: string[];
  formato: string[];
  comprador: string[];
  departamentos: string[];
}

export interface ResultadoDesempenho {
  kpiAtual: Metricas;
  kpiComparacao: Metricas | null;
  estruturaNivel: NivelEstrutura;
  linhasEstrutura: EstruturaAgregada[];
  linhasLojas: LojaAgregada[];
  linhasTop: EstruturaAgregada[];
  opcoesComDados: OpcoesComDados;
}

export const CONSULTA_PADRAO: ConsultaDesempenho = {
  filtros: { lojas: [], formato: [], comprador: [], departamentos: [], mesmasLojas: false },
  caminhoDrill: [],
  produtoSelecionado: null,
  lojasSelecionadas: [],
  nivelTopAltasQuedas: "secao",
  periodoAtual: null,
  periodoComparacao: null,
};

function aplicarFiltroIntervalo(registros: RegistroDesempenho[], intervalo: IntervaloData | null): RegistroDesempenho[] {
  if (!intervalo) return registros;
  const inicio = isoParaDataLocal(intervalo.inicio);
  const fim = isoParaDataLocal(intervalo.fim);
  if (!inicio || !fim) return registros;
  return registros.filter((r) => {
    const data = parseDataBr(r.movimento.data);
    return data !== null && data >= inicio && data <= fim;
  });
}

function aplicarFiltrosBase(
  registros: RegistroDesempenho[],
  filtros: Filtros,
  indiceComprador: IndiceDepartamentos,
): RegistroDesempenho[] {
  return registros.filter((r) => {
    const comprador = filtros.comprador.length > 0 ? nomeCompradorDoRegistroCadastro(r, indiceComprador) : null;
    return (
      (filtros.lojas.length === 0 || (r.loja && filtros.lojas.includes(r.loja.codUnid))) &&
      (filtros.formato.length === 0 || (r.loja && filtros.formato.includes(r.loja.formato))) &&
      (filtros.comprador.length === 0 || (comprador && filtros.comprador.includes(comprador))) &&
      (filtros.departamentos.length === 0 || (r.produto && filtros.departamentos.includes(r.produto.dpto)))
    );
  });
}

/**
 * Acumula, num único passe pelos registros de um arquivo (Atual ou Comparação), os valores de
 * cada filtro principal que têm alguma MOVIMENTAÇÃO — não "venda" por si só, mas o(s) campo(s)
 * relevantes pro que ESTE módulo mede (aqui, Desempenho Comercial → venda). Um registro com
 * `valorTotal = 0` não tem dado nenhum a avaliar pra este dash, então não conta como
 * movimentação, mesmo que a linha exista no arquivo (ex: ajustes/baixas com valor zerado). Cada
 * módulo futuro (Entradas e Saídas, Compra e Venda, ...) vai definir seu próprio critério aqui —
 * não é fixo em "venda" pro sistema inteiro, só é o que importa pra este módulo específico. Pra
 * cada dimensão do filtro, considera os OUTROS 3 filtros ativos (não ela mesma), pra responder
 * "se eu marcar essa opção, ainda bate com o resto do que já tá filtrado?" (padrão de contagem
 * por faceta, tipo filtro de loja virtual).
 */
function acumularOpcoesComDados(
  registros: RegistroDesempenho[],
  filtros: Filtros,
  destino: { lojas: Set<string>; formato: Set<string>; comprador: Set<string>; departamentos: Set<string> },
  indiceComprador: IndiceDepartamentos,
): void {
  for (const r of registros) {
    if (r.movimento.valorTotal <= 0) continue;
    const nomeComprador = nomeCompradorDoRegistroCadastro(r, indiceComprador);

    const passaLojas = filtros.lojas.length === 0 || (r.loja !== null && filtros.lojas.includes(r.loja.codUnid));
    const passaFormato = filtros.formato.length === 0 || (r.loja !== null && filtros.formato.includes(r.loja.formato));
    const passaComprador = filtros.comprador.length === 0 || (nomeComprador !== null && filtros.comprador.includes(nomeComprador));
    const passaDepto = filtros.departamentos.length === 0 || (r.produto !== null && filtros.departamentos.includes(r.produto.dpto));

    if (passaFormato && passaComprador && passaDepto && r.loja) destino.lojas.add(r.loja.codUnid);
    if (passaLojas && passaComprador && passaDepto && r.loja) destino.formato.add(r.loja.formato);
    if (passaLojas && passaFormato && passaDepto && nomeComprador) destino.comprador.add(nomeComprador);
    if (passaLojas && passaFormato && passaComprador && r.produto) destino.departamentos.add(r.produto.dpto);
  }
}

/**
 * Ponto único de filtragem + agregação do módulo — roda no servidor (API route
 * e primeira renderização da página) para nunca precisar mandar os registros
 * brutos para o navegador. `registros` é o conjunto INTEIRO disponível (união de
 * todos os arquivos mensais, ver `DataProvider.getDesempenho`) — "Atual" e
 * "Comparação" nunca foram duas fontes diferentes de dado, sempre foram só dois
 * filtros de data (`periodoAtual`/`periodoComparacao`) sobre o mesmo pool.
 */
export function computarDesempenho(
  registros: RegistroDesempenho[],
  lojas: Loja[],
  consulta: ConsultaDesempenho,
  indiceComprador: IndiceDepartamentos,
): ResultadoDesempenho {
  const { filtros, caminhoDrill, produtoSelecionado, lojasSelecionadas, nivelTopAltasQuedas, periodoAtual, periodoComparacao } =
    consulta;
  const noAtivo = caminhoDrill.at(-1) ?? null;
  const estruturaNivel = NIVEIS_ESTRUTURA[caminhoDrill.length] ?? "produto";
  const filtroProduto = (r: RegistroDesempenho) => !produtoSelecionado || r.movimento.codigo === produtoSelecionado;

  const atualNoIntervalo = aplicarFiltroIntervalo(registros, periodoAtual);
  const comparacaoNoIntervalo = aplicarFiltroIntervalo(registros, periodoComparacao);

  const opcoesComDadosSets = { lojas: new Set<string>(), formato: new Set<string>(), comprador: new Set<string>(), departamentos: new Set<string>() };
  acumularOpcoesComDados(atualNoIntervalo, filtros, opcoesComDadosSets, indiceComprador);
  acumularOpcoesComDados(comparacaoNoIntervalo, filtros, opcoesComDadosSets, indiceComprador);
  const opcoesComDados: OpcoesComDados = {
    lojas: Array.from(opcoesComDadosSets.lojas),
    formato: Array.from(opcoesComDadosSets.formato),
    comprador: Array.from(opcoesComDadosSets.comprador),
    departamentos: Array.from(opcoesComDadosSets.departamentos),
  };

  const baseAtual = aplicarFiltrosBase(atualNoIntervalo, filtros, indiceComprador);
  const baseComparacao = aplicarFiltrosBase(comparacaoNoIntervalo, filtros, indiceComprador);

  // "Mesmas Lojas": só avaliável com os dois períodos definidos (senão não há "início" pra
  // comparar). A data de abertura é inferida da 1ª venda da loja considerando TODO o pool
  // disponível (todos os meses) — uma loja que já vendeu antes do início do período em questão,
  // em qualquer mês, é tratada como "já existia"; só entra como "loja nova" quem não tem NENHUMA
  // venda anterior em nenhum mês. As linhas da tabela de Lojas sempre mostram todas as lojas (ver
  // `linhasLojas` abaixo); só os totais (KPIs, Estrutura, Top Altas/Quedas) excluem as que não
  // passam quando o filtro está ligado.
  // Preferir a data de abertura real (cadastrada em /parametros > Lojas) quando existir — só cai
  // pra proxy de "1ª venda" pra lojas antigas que ainda não tiveram essa data preenchida.
  const primeiraVendaGlobalPorLoja = primeiraVendaPorLoja(registros);
  const referenciaAberturaPorLoja = (l: Loja) => l.dataAbertura ?? primeiraVendaGlobalPorLoja.get(l.codUnid);
  const lojasElegiveis =
    periodoAtual && periodoComparacao
      ? new Set(
          lojas
            .filter(
              (l) =>
                lojaAbertaDesdeInicio(referenciaAberturaPorLoja(l), periodoAtual.inicio) &&
                lojaAbertaDesdeInicio(referenciaAberturaPorLoja(l), periodoComparacao.inicio),
            )
            .map((l) => l.codUnid),
        )
      : null;

  // "Fechamento" (feriado/reforma) dentro do período — informativo (mostrado ao passar o mouse
  // na loja), não afeta `lojasElegiveis`. Um único mapa (dias com venda em TODO o pool) reaproveitado
  // pros dois períodos — `intervalosFechamento` já só olha os dias dentro do `periodo` passado.
  const diasComVendaPorLojaTodos = diasComVendaPorLoja(registros);
  const fechamentosAtualPorLoja = new Map<string, { inicio: string; fim: string }[]>();
  const fechamentosComparacaoPorLoja = new Map<string, { inicio: string; fim: string }[]>();
  if (periodoAtual) {
    for (const l of lojas) {
      const intervalos = intervalosFechamento(diasComVendaPorLojaTodos.get(l.codUnid), periodoAtual);
      if (intervalos.length > 0) fechamentosAtualPorLoja.set(l.codUnid, intervalos);
    }
  }
  if (periodoComparacao) {
    for (const l of lojas) {
      const intervalos = intervalosFechamento(diasComVendaPorLojaTodos.get(l.codUnid), periodoComparacao);
      if (intervalos.length > 0) fechamentosComparacaoPorLoja.set(l.codUnid, intervalos);
    }
  }

  const aplicarMesmasLojas = (registros: RegistroDesempenho[]) =>
    filtros.mesmasLojas && lojasElegiveis
      ? registros.filter((r) => r.loja && lojasElegiveis.has(r.loja.codUnid))
      : registros;
  const baseAtualTotais = aplicarMesmasLojas(baseAtual);
  const baseComparacaoTotais = aplicarMesmasLojas(baseComparacao);

  const filtroSelecao = (r: RegistroDesempenho) =>
    (lojasSelecionadas.length === 0 || (r.loja && lojasSelecionadas.includes(r.loja.codUnid))) &&
    (!noAtivo || pertenceAoNo(r, noAtivo)) &&
    filtroProduto(r);

  // Recorte completo (filtros + seleção de lojas/estrutura/produto) — alimenta KPIs e Top Altas/Quedas.
  const recorteAtual = baseAtualTotais.filter(filtroSelecao);
  const recorteComparacao = baseComparacaoTotais.filter(filtroSelecao);

  // Estrutura: escopada pelas lojas selecionadas e pelo caminho de drill-down atual — nunca
  // pelo produto selecionado, pra continuar mostrando os produtos irmãos na lista.
  const filtroLojas = (r: RegistroDesempenho) =>
    lojasSelecionadas.length === 0 || (r.loja && lojasSelecionadas.includes(r.loja.codUnid));
  let estruturaAtualBase = baseAtualTotais.filter(filtroLojas);
  let estruturaComparacaoBase = baseComparacaoTotais.filter(filtroLojas);
  if (noAtivo) {
    estruturaAtualBase = estruturaAtualBase.filter((r) => pertenceAoNo(r, noAtivo));
    estruturaComparacaoBase = estruturaComparacaoBase.filter((r) => pertenceAoNo(r, noAtivo));
  }
  const linhasEstrutura =
    estruturaNivel === "produto"
      ? agregarPorProduto(estruturaAtualBase, estruturaComparacaoBase)
      : agregarPorEstrutura(estruturaAtualBase, estruturaComparacaoBase, estruturaNivel);

  // Lojas: escopada pelo nó de estrutura e pelo produto selecionados (não pela própria seleção de
  // loja) — usa a base SEM o filtro de "Mesmas Lojas" de propósito, pra toda loja continuar
  // aparecendo como linha (só os totais/subtotais excluem; ver `mesmaLoja` em cada linha).
  const filtroEstrutura = (r: RegistroDesempenho) => (!noAtivo || pertenceAoNo(r, noAtivo)) && filtroProduto(r);
  const lojasAtualBase = baseAtual.filter(filtroEstrutura);
  const lojasComparacaoBase = baseComparacao.filter(filtroEstrutura);
  const linhasLojas = agregarPorLoja(lojasAtualBase, lojasComparacaoBase, lojas, lojasElegiveis, fechamentosAtualPorLoja, fechamentosComparacaoPorLoja);

  // Top Altas/Quedas: fica preso só no Departamento selecionado (1º nó do
  // caminho) + lojas selecionadas — não desce mais que isso junto com o
  // drill-down de Seção/Categoria/Grupo/Sub Grupo/Produto, pra continuar
  // mostrando uma visão ampla do departamento mesmo depois de descer mais.
  const departamentoAtivo = caminhoDrill[0] ?? null;
  const filtroTop = (r: RegistroDesempenho) =>
    (lojasSelecionadas.length === 0 || (r.loja && lojasSelecionadas.includes(r.loja.codUnid))) &&
    (!departamentoAtivo || pertenceAoNo(r, departamentoAtivo));
  const linhasTop = agregarPorEstrutura(baseAtualTotais.filter(filtroTop), baseComparacaoTotais.filter(filtroTop), nivelTopAltasQuedas);

  const kpiAtual = somarMetricas(recorteAtual);
  const kpiComparacao = recorteComparacao.length > 0 ? somarMetricas(recorteComparacao) : null;

  return { kpiAtual, kpiComparacao, estruturaNivel, linhasEstrutura, linhasLojas, linhasTop, opcoesComDados };
}
