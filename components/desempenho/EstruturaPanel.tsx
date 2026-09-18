"use client";

import { useState } from "react";
import { RankingBar } from "@/components/charts/RankingBar";
import { CelulaMetrica } from "@/components/desempenho/CelulaMetrica";
import { ThOrdenavel } from "@/components/desempenho/ThOrdenavel";
import { agregarMetricas, labelNivel, type EstruturaAgregada, type NivelEstrutura, type NoSelecionado } from "@/lib/desempenho/aggregate";
import { COLUNAS_METRICAS, valorColunaMetrica, type ColunaMetrica } from "@/lib/desempenho/colunas-tabela";
import { formatPercent } from "@/lib/desempenho/format";

type Coluna = "nome" | ColunaMetrica;

const LARGURA_NOME = 200;
const LARGURA_PART = 64;

// Tons sólidos (não translúcidos) — a 1ª coluna fica fixa (sticky) ao rolar a
// tabela pro lado, e uma cor translúcida deixaria as outras colunas
// "vazando" por baixo dela conforme passam por trás.
const SUBTOTAL_BG = "bg-[#E4ECF6]";
const SELECIONADA_BG = "bg-[#FBE6E6]";

/** Chave de ordenação da 1ª coluna: código pra todo mundo, exceto Produto (SKU não é sequência
 * significativa) — aí ordena pela descrição. */
function chaveNome(linha: EstruturaAgregada, nivel: NivelEstrutura): string {
  if (nivel === "produto") return linha.nome;
  return linha.codigo ?? linha.nome;
}

function ordenarPadrao(linhas: EstruturaAgregada[], nivel: NivelEstrutura): EstruturaAgregada[] {
  return [...linhas].sort((a, b) => chaveNome(a, nivel).localeCompare(chaveNome(b, nivel), "pt-BR"));
}

function ordenarPor(linhas: EstruturaAgregada[], nivel: NivelEstrutura, coluna: Coluna, dir: 1 | -1): EstruturaAgregada[] {
  return [...linhas].sort((a, b) => {
    if (coluna === "nome") {
      return dir * chaveNome(a, nivel).localeCompare(chaveNome(b, nivel), "pt-BR");
    }
    const va = valorColunaMetrica(a.atual, a.comparacao, coluna) ?? -Infinity;
    const vb = valorColunaMetrica(b.atual, b.comparacao, coluna) ?? -Infinity;
    return dir * (va - vb);
  });
}

function ordenarRanking(linhas: EstruturaAgregada[]): EstruturaAgregada[] {
  return [...linhas].sort((a, b) => b.atual.venda - a.atual.venda);
}

const TITULO_NIVEL: Record<NivelEstrutura, string> = {
  departamento: "Departamentos",
  secao: "Seções",
  categoria: "Categorias",
  grupo: "Grupos",
  subGrupo: "Sub Grupos",
  produto: "Produtos",
};

export function EstruturaPanel({
  nivel,
  linhas,
  caminho,
  produtoSelecionado,
  modoRanking,
  onToggleModo,
  onClickLinha,
  onVoltarPara,
}: {
  nivel: NivelEstrutura;
  linhas: EstruturaAgregada[];
  caminho: NoSelecionado[];
  produtoSelecionado: string | null;
  modoRanking: boolean;
  onToggleModo: () => void;
  onClickLinha: (linha: EstruturaAgregada) => void;
  onVoltarPara: (indice: number) => void;
}) {
  const [ordenacao, setOrdenacao] = useState<{ coluna: Coluna; dir: 1 | -1 } | null>(null);

  // Muda de nível (drill-down) — volta pra ordenação padrão daquele nível.
  const [nivelAnterior, setNivelAnterior] = useState(nivel);
  if (nivel !== nivelAnterior) {
    setNivelAnterior(nivel);
    setOrdenacao(null);
  }

  function aoClicarColuna(coluna: Coluna) {
    setOrdenacao((atual) =>
      atual?.coluna === coluna ? { coluna, dir: atual.dir === 1 ? -1 : 1 } : { coluna, dir: 1 },
    );
  }

  const ordenadas = modoRanking
    ? ordenarRanking(linhas)
    : ordenacao
      ? ordenarPor(linhas, nivel, ordenacao.coluna, ordenacao.dir)
      : ordenarPadrao(linhas, nivel);
  const valorMax = Math.max(1, ...linhas.map((l) => l.atual.venda));
  const totalVenda = linhas.reduce((soma, l) => soma + l.atual.venda, 0);

  const subtotalAtual = agregarMetricas(linhas.map((l) => l.atual));
  const linhasComComparacao = linhas.filter((l): l is EstruturaAgregada & { comparacao: NonNullable<EstruturaAgregada["comparacao"]> } => l.comparacao !== null);
  const subtotalComparacao = linhasComComparacao.length > 0 ? agregarMetricas(linhasComComparacao.map((l) => l.comparacao)) : null;

  return (
    <div className="flex flex-1 flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
      <div className="flex items-center justify-between bg-azul px-4 py-3">
        <div className="text-sm">
          <h2 className="font-display font-semibold text-white">{TITULO_NIVEL[nivel]}</h2>
          {caminho.length > 0 && (
            <div className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-white/70">
              <button type="button" onClick={() => onVoltarPara(-1)} className="text-white hover:underline">
                {TITULO_NIVEL.departamento}
              </button>
              {caminho.map((no, i) => (
                <span key={no.chave} className="flex items-center gap-1">
                  <span>{">"}</span>
                  {i === caminho.length - 1 ? (
                    <span className="text-white/90">{no.nome}</span>
                  ) : (
                    <button type="button" onClick={() => onVoltarPara(i)} className="text-white hover:underline">
                      {no.nome}
                    </button>
                  )}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex overflow-hidden rounded-md border border-white/30 text-xs font-medium">
          <button
            type="button"
            onClick={() => modoRanking && onToggleModo()}
            className={`px-3 py-1.5 ${!modoRanking ? "bg-white text-azul" : "text-white/80 hover:bg-white/10"}`}
          >
            Tabela
          </button>
          <button
            type="button"
            onClick={() => !modoRanking && onToggleModo()}
            className={`px-3 py-1.5 ${modoRanking ? "bg-white text-azul" : "text-white/80 hover:bg-white/10"}`}
          >
            Ranking
          </button>
        </div>
      </div>

      {modoRanking ? (
        <div className="flex-1 space-y-1 overflow-auto p-3">
          {ordenadas.map((linha) => (
            <RankingBar
              key={linha.chave}
              rotulo={linha.nome}
              codigo={linha.codigo}
              valor={linha.atual.venda}
              valorMax={valorMax}
              desvio={linha.desvioVenda}
              ativo={nivel === "produto" && linha.chave === produtoSelecionado}
              onClick={() => onClickLinha(linha)}
            />
          ))}
        </div>
      ) : (
        <div className="max-h-[65vh] flex-1 overflow-auto">
          <table className="table-fixed text-sm">
            <thead className="bg-azul text-[13px] font-medium tracking-wide text-white/80 uppercase">
              <tr>
                <ThOrdenavel<Coluna>
                  coluna="nome"
                  ordenacao={ordenacao}
                  onClick={aoClicarColuna}
                  largura={LARGURA_NOME}
                  className="sticky top-0 left-0 z-30 bg-azul px-4 py-2 font-medium"
                >
                  {labelNivel(nivel)}
                </ThOrdenavel>
                {COLUNAS_METRICAS.map((c) => (
                  <ThOrdenavel<Coluna>
                    key={c.chave}
                    coluna={c.chave}
                    ordenacao={ordenacao}
                    onClick={aoClicarColuna}
                    largura={c.largura}
                    className="sticky top-0 z-20 bg-azul px-2 py-2 font-medium"
                  >
                    {c.rotulo}
                  </ThOrdenavel>
                ))}
                <th
                  className="sticky top-0 z-20 bg-azul px-3 py-2 text-center font-medium"
                  style={{ width: LARGURA_PART }}
                >
                  Part.
                </th>
              </tr>
            </thead>
            <tbody>
              {ordenadas.length > 0 && (
                <tr className={`border-b-2 border-azul/20 ${SUBTOTAL_BG}`}>
                  <td className={`sticky left-0 z-10 px-4 py-2 font-semibold text-azul ${SUBTOTAL_BG}`}>Total</td>
                  {COLUNAS_METRICAS.map((c) => (
                    <CelulaMetrica key={c.chave} atual={subtotalAtual} comparacao={subtotalComparacao} coluna={c.chave} enfase />
                  ))}
                  <td className="px-3 py-2 text-right font-semibold tabular-nums text-azul">100%</td>
                </tr>
              )}
              {ordenadas.map((linha, i) => {
                const selecionada = nivel === "produto" && linha.chave === produtoSelecionado;
                const corFundo = selecionada ? SELECIONADA_BG : i % 2 === 1 ? "bg-zinc-50" : "bg-white";
                return (
                  <tr
                    key={linha.chave}
                    onClick={() => onClickLinha(linha)}
                    className={`cursor-pointer border-t border-zinc-100 hover:bg-azul/5 ${corFundo}`}
                  >
                    <td className={`sticky left-0 z-10 truncate px-4 py-2 font-medium text-zinc-800 ${corFundo}`}>
                      {linha.codigo && <span className="font-normal text-zinc-400">{linha.codigo} - </span>}
                      {linha.nome}
                    </td>
                    {COLUNAS_METRICAS.map((c) => (
                      <CelulaMetrica key={c.chave} atual={linha.atual} comparacao={linha.comparacao} coluna={c.chave} />
                    ))}
                    <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap text-zinc-500">
                      {formatPercent(totalVenda !== 0 ? (linha.atual.venda / totalVenda) * 100 : 0, 1)}
                    </td>
                  </tr>
                );
              })}
              {ordenadas.length === 0 && (
                <tr>
                  <td colSpan={COLUNAS_METRICAS.length + 2} className="px-4 py-8 text-center text-zinc-400">
                    Nenhum dado para o recorte selecionado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
