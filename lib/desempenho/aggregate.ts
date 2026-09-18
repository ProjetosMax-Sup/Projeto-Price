import type { Loja, RegistroDesempenho } from "@/lib/types";
import { calcDesvio } from "./format";

export const NIVEIS_ESTRUTURA = ["departamento", "secao", "categoria", "grupo", "subGrupo"] as const;
export type NivelEstrutura = (typeof NIVEIS_ESTRUTURA)[number];

const LABEL_NIVEL: Record<NivelEstrutura, string> = {
  departamento: "Departamento",
  secao: "Seção",
  categoria: "Categoria",
  grupo: "Grupo",
  subGrupo: "Sub Grupo",
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

/** Caminho (chave de agrupamento) até o nível pedido, ex: "Mercearia > Enlatados". */
function caminhoAteNivel(hierarquiaGrupos: string, nivel: NivelEstrutura): string | null {
  const niveis = parseHierarquia(hierarquiaGrupos);
  const idx = NIVEIS_ESTRUTURA.indexOf(nivel);
  if (niveis.length <= idx) return null;
  return niveis.slice(0, idx + 1).join(" > ");
}

export interface Metricas {
  venda: number;
  lucro: number;
  percLucro: number;
}

export interface ComDesvio<T> {
  atual: T;
  comparacao: T | null;
  desvioVenda: number | null;
  desvioLucro: number | null;
}

function metricasVazias(): Metricas {
  return { venda: 0, lucro: 0, percLucro: 0 };
}

function somarRegistro(acc: Metricas, r: RegistroDesempenho): Metricas {
  return {
    venda: acc.venda + r.movimento.valorTotal,
    lucro: acc.lucro + r.movimento.lucrosTotal,
    percLucro: 0, // recalculado no final
  };
}

function fecharMetricas(m: Metricas): Metricas {
  return { ...m, percLucro: m.venda !== 0 ? (m.lucro / m.venda) * 100 : 0 };
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
  nivel: NivelEstrutura,
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

export function somarMetricas(registros: RegistroDesempenho[]): Metricas {
  return fecharMetricas(registros.reduce(somarRegistro, metricasVazias()));
}
