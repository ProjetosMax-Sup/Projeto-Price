import type { Loja, RegistroDesempenho } from "@/lib/types";
import { calcDesvio } from "./format";

export const NIVEIS_ESTRUTURA = ["departamento", "secao", "categoria", "grupo", "subGrupo", "produto"] as const;
export type NivelEstrutura = (typeof NIVEIS_ESTRUTURA)[number];

/** Níveis que vêm da "Hierarquia de Grupos" (Produto não — é agrupado por SKU). */
export const NIVEIS_HIERARQUIA = NIVEIS_ESTRUTURA.filter((n) => n !== "produto") as Exclude<
  NivelEstrutura,
  "produto"
>[];

const LABEL_NIVEL: Record<NivelEstrutura, string> = {
  departamento: "Departamento",
  secao: "Seção",
  categoria: "Categoria",
  grupo: "Grupo",
  subGrupo: "Sub Grupo",
  produto: "Produto",
};

export function labelNivel(nivel: NivelEstrutura): string {
  return LABEL_NIVEL[nivel];
}

/** "Departamento, Seção, Categoria, Grupo, Sub Grupo" — nem sempre tem os 5 níveis. */
export function parseHierarquia(hierarquiaGrupos: string): string[] {
  return hierarquiaGrupos
    .split(",")
    .map((nivel) => nivel.trim())
    .filter(Boolean);
}

export type NivelHierarquia = (typeof NIVEIS_HIERARQUIA)[number];

/** Caminho (chave de agrupamento) até o nível pedido, ex: "Mercearia > Enlatados". */
function caminhoAteNivel(hierarquiaGrupos: string, nivel: NivelHierarquia): string | null {
  const niveis = parseHierarquia(hierarquiaGrupos);
  const idx = NIVEIS_ESTRUTURA.indexOf(nivel);
  if (niveis.length <= idx) return null;
  return niveis.slice(0, idx + 1).join(" > ");
}

export interface NoSelecionado {
  nivel: NivelEstrutura;
  chave: string;
  nome: string;
}

/**
 * Se um registro pertence ao nó selecionado — usado tanto pra descer no
 * drill-down (filtrar os filhos do nó ativo) quanto pra aplicar o recorte nos
 * KPIs/Lojas/Top Altas-Quedas. Produto não faz parte da Hierarquia de Grupos
 * (é agrupado por SKU), então tem checagem própria.
 */
export function pertenceAoNo(registro: RegistroDesempenho, no: NoSelecionado): boolean {
  if (no.nivel === "produto") return registro.movimento.codigo === no.chave;
  if (!registro.produto) return false;
  const niveis = parseHierarquia(registro.produto.hierarquiaGrupos);
  const profundidade = NIVEIS_ESTRUTURA.indexOf(no.nivel) + 1;
  return niveis.slice(0, profundidade).join(" > ") === no.chave;
}

export interface Metricas {
  venda: number;
  vendaRegular: number;
  vendaOferta: number;
  lucro: number;
  lucroRegular: number;
  lucroOferta: number;
  qtdeVendas: number;
  percLucro: number;
  ticketMedio: number;
}

function metricasVazias(): Metricas {
  return {
    venda: 0,
    vendaRegular: 0,
    vendaOferta: 0,
    lucro: 0,
    lucroRegular: 0,
    lucroOferta: 0,
    qtdeVendas: 0,
    percLucro: 0,
    ticketMedio: 0,
  };
}

function somarRegistro(acc: Metricas, r: RegistroDesempenho): Metricas {
  return {
    ...acc,
    venda: acc.venda + r.movimento.valorTotal,
    vendaRegular: acc.vendaRegular + r.movimento.vendasRegular,
    vendaOferta: acc.vendaOferta + r.movimento.vendasOferta,
    lucro: acc.lucro + r.movimento.lucrosTotal,
    lucroRegular: acc.lucroRegular + r.movimento.lucrosRegular,
    lucroOferta: acc.lucroOferta + r.movimento.lucrosOferta,
    qtdeVendas: acc.qtdeVendas + r.movimento.qtdeVendasTotal,
  };
}

function fecharMetricas(m: Metricas): Metricas {
  return {
    ...m,
    percLucro: m.venda !== 0 ? (m.lucro / m.venda) * 100 : 0,
    ticketMedio: m.qtdeVendas !== 0 ? m.venda / m.qtdeVendas : 0,
  };
}

export interface LojaAgregada {
  loja: Loja;
  atual: Metricas;
  comparacao: Metricas | null;
  desvioVenda: number | null;
  desvioLucro: number | null;
}

export function agregarPorLoja(
  registrosAtual: RegistroDesempenho[],
  registrosComparacao: RegistroDesempenho[],
  lojas: Loja[],
): LojaAgregada[] {
  const porLojaAtual = new Map<string, Metricas>();
  const porLojaComp = new Map<string, Metricas>();

  for (const r of registrosAtual) {
    if (!r.loja) continue;
    porLojaAtual.set(r.loja.codUnid, somarRegistro(porLojaAtual.get(r.loja.codUnid) ?? metricasVazias(), r));
  }
  for (const r of registrosComparacao) {
    if (!r.loja) continue;
    porLojaComp.set(r.loja.codUnid, somarRegistro(porLojaComp.get(r.loja.codUnid) ?? metricasVazias(), r));
  }

  return lojas
    .filter((loja) => porLojaAtual.has(loja.codUnid))
    .map((loja) => {
      const atual = fecharMetricas(porLojaAtual.get(loja.codUnid) ?? metricasVazias());
      const compRaw = porLojaComp.get(loja.codUnid);
      const comparacao = compRaw ? fecharMetricas(compRaw) : null;
      return {
        loja,
        atual,
        comparacao,
        desvioVenda: comparacao ? calcDesvio(atual.venda, comparacao.venda) : null,
        desvioLucro: comparacao ? calcDesvio(atual.lucro, comparacao.lucro) : null,
      };
    });
}

export interface EstruturaAgregada {
  chave: string;
  codigo: string | null;
  nome: string;
  nivel: NivelEstrutura;
  atual: Metricas;
  comparacao: Metricas | null;
  desvioVenda: number | null;
  desvioLucro: number | null;
}

export function agregarPorEstrutura(
  registrosAtual: RegistroDesempenho[],
  registrosComparacao: RegistroDesempenho[],
  nivel: NivelHierarquia,
): EstruturaAgregada[] {
  const acumular = (registros: RegistroDesempenho[]) => {
    const mapa = new Map<string, { nome: string; codigo: string | null; metricas: Metricas }>();
    for (const r of registros) {
      if (!r.produto) continue;
      const chave = caminhoAteNivel(r.produto.hierarquiaGrupos, nivel);
      if (!chave) continue;
      const nome = chave.split(" > ").at(-1) ?? chave;
      const codigo = nivel === "departamento" ? r.produto.dpto : null;
      const atual = mapa.get(chave);
      mapa.set(chave, {
        nome,
        codigo,
        metricas: somarRegistro(atual?.metricas ?? metricasVazias(), r),
      });
    }
    return mapa;
  };

  const mapaAtual = acumular(registrosAtual);
  const mapaComp = acumular(registrosComparacao);

  return Array.from(mapaAtual.entries()).map(([chave, dadosAtual]) => {
    const dadosComp = mapaComp.get(chave);
    const atual = fecharMetricas(dadosAtual.metricas);
    const comparacao = dadosComp ? fecharMetricas(dadosComp.metricas) : null;
    return {
      chave,
      codigo: dadosAtual.codigo,
      nome: dadosAtual.nome,
      nivel,
      atual,
      comparacao,
      desvioVenda: comparacao ? calcDesvio(atual.venda, comparacao.venda) : null,
      desvioLucro: comparacao ? calcDesvio(atual.lucro, comparacao.lucro) : null,
    };
  });
}

/**
 * Nível "Produto" — folha do drill-down, depois de Sub Grupo. Não vem da
 * Hierarquia de Grupos, é agrupado por SKU (movimento.codigo). Rótulo
 * padronizado "Código" - "Descrição" - "Complemento" (o mesmo formato de
 * "codigo - nome" que a tabela já usa pros outros níveis cobre isso, já que
 * `nome` aqui é montado como "Descrição - Complemento").
 */
export function agregarPorProduto(
  registrosAtual: RegistroDesempenho[],
  registrosComparacao: RegistroDesempenho[],
): EstruturaAgregada[] {
  const acumular = (registros: RegistroDesempenho[]) => {
    const mapa = new Map<string, { nome: string; metricas: Metricas }>();
    for (const r of registros) {
      const chave = r.movimento.codigo;
      if (!chave) continue;
      const nome = [r.movimento.descricao, r.movimento.complemento].filter(Boolean).join(" - ");
      const atual = mapa.get(chave);
      mapa.set(chave, {
        nome,
        metricas: somarRegistro(atual?.metricas ?? metricasVazias(), r),
      });
    }
    return mapa;
  };

  const mapaAtual = acumular(registrosAtual);
  const mapaComp = acumular(registrosComparacao);

  return Array.from(mapaAtual.entries()).map(([chave, dadosAtual]) => {
    const dadosComp = mapaComp.get(chave);
    const atual = fecharMetricas(dadosAtual.metricas);
    const comparacao = dadosComp ? fecharMetricas(dadosComp.metricas) : null;
    return {
      chave,
      codigo: chave,
      nome: dadosAtual.nome,
      nivel: "produto" as const,
      atual,
      comparacao,
      desvioVenda: comparacao ? calcDesvio(atual.venda, comparacao.venda) : null,
      desvioLucro: comparacao ? calcDesvio(atual.lucro, comparacao.lucro) : null,
    };
  });
}

export function somarMetricas(registros: RegistroDesempenho[]): Metricas {
  return fecharMetricas(registros.reduce(somarRegistro, metricasVazias()));
}

/** Soma um conjunto de Metricas já fechadas (ex: linhas de uma tabela) num subtotal. */
export function agregarMetricas(itens: Metricas[]): Metricas {
  const soma = itens.reduce(
    (acc, m) => ({
      venda: acc.venda + m.venda,
      vendaRegular: acc.vendaRegular + m.vendaRegular,
      vendaOferta: acc.vendaOferta + m.vendaOferta,
      lucro: acc.lucro + m.lucro,
      lucroRegular: acc.lucroRegular + m.lucroRegular,
      lucroOferta: acc.lucroOferta + m.lucroOferta,
      qtdeVendas: acc.qtdeVendas + m.qtdeVendas,
      percLucro: 0,
      ticketMedio: 0,
    }),
    metricasVazias(),
  );
  return fecharMetricas(soma);
}
