"use client";

import { useState } from "react";
import { RankingBar } from "@/components/charts/RankingBar";
import { Semaforo } from "@/components/ui/Semaforo";
import { agregarMetricas, labelNivel, type EstruturaAgregada, type NivelEstrutura, type NoSelecionado } from "@/lib/desempenho/aggregate";
import { calcDesvio, formatMoeda, formatPercent } from "@/lib/desempenho/format";

type Coluna = "nome" | "vAtual" | "vComp" | "dVenda" | "lAtual" | "lComp" | "dLucro" | "part";

function ordenarPadrao(linhas: EstruturaAgregada[], nivel: NivelEstrutura): EstruturaAgregada[] {
  // Produto ordena por nome (alfabético) por padrão — código de produto (SKU)
  // não é uma sequência significativa, diferente do código de Departamento/Seção/etc.
  if (nivel === "produto") {
    return [...linhas].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }
  return [...linhas].sort((a, b) => {
    if (a.codigo && b.codigo) return a.codigo.localeCompare(b.codigo);
    return a.nome.localeCompare(b.nome, "pt-BR");
  });
}

function valorColuna(linha: EstruturaAgregada, coluna: Coluna): string | number {
  switch (coluna) {
    case "nome":
      return linha.nome;
    case "vAtual":
    case "part":
      return linha.atual.venda;
    case "vComp":
      return linha.comparacao?.venda ?? -Infinity;
    case "dVenda":
      return linha.desvioVenda ?? -Infinity;
    case "lAtual":
      return linha.atual.lucro;
    case "lComp":
      return linha.comparacao?.lucro ?? -Infinity;
    case "dLucro":
      return linha.desvioLucro ?? -Infinity;
  }
}

function ordenarPor(linhas: EstruturaAgregada[], coluna: Coluna, dir: 1 | -1): EstruturaAgregada[] {
  return [...linhas].sort((a, b) => {
    const va = valorColuna(a, coluna);
    const vb = valorColuna(b, coluna);
    if (typeof va === "string" || typeof vb === "string") {
      return dir * String(va).localeCompare(String(vb), "pt-BR");
    }
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

function ThOrdenavel({
  coluna,
  ordenacao,
  onClick,
  className,
  children,
}: {
  coluna: Coluna;
  ordenacao: { coluna: Coluna; dir: 1 | -1 } | null;
  onClick: (coluna: Coluna) => void;
  className: string;
  children: React.ReactNode;
}) {
  const ativo = ordenacao?.coluna === coluna;
  return (
    <th className={className}>
      <button type="button" onClick={() => onClick(coluna)} className="inline-flex items-center gap-0.5 hover:text-zinc-800">
        {children}
        <span className="text-[9px] text-zinc-400">{ativo ? (ordenacao!.dir === 1 ? "▲" : "▼") : "⇅"}</span>
      </button>
    </th>
  );
}

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
      ? ordenarPor(linhas, ordenacao.coluna, ordenacao.dir)
      : ordenarPadrao(linhas, nivel);
  const valorMax = Math.max(1, ...linhas.map((l) => l.atual.venda));
  const totalVenda = linhas.reduce((soma, l) => soma + l.atual.venda, 0);

  const subtotalAtual = agregarMetricas(linhas.map((l) => l.atual));
  const linhasComComparacao = linhas.filter((l): l is EstruturaAgregada & { comparacao: NonNullable<EstruturaAgregada["comparacao"]> } => l.comparacao !== null);
  const subtotalComparacao = linhasComComparacao.length > 0 ? agregarMetricas(linhasComComparacao.map((l) => l.comparacao)) : null;
  const subtotalDesvioVenda = subtotalComparacao ? calcDesvio(subtotalAtual.venda, subtotalComparacao.venda) : null;
  const subtotalDesvioLucro = subtotalComparacao ? calcDesvio(subtotalAtual.lucro, subtotalComparacao.lucro) : null;

  return (
    <div className="flex flex-1 flex-col rounded-lg border border-zinc-200 bg-white">
      <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
        <div className="text-sm">
          <h2 className="font-display font-semibold text-zinc-900">{TITULO_NIVEL[nivel]}</h2>
          {caminho.length > 0 && (
            <div className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-zinc-500">
              <button type="button" onClick={() => onVoltarPara(-1)} className="text-azul hover:underline">
                {TITULO_NIVEL.departamento}
              </button>
              {caminho.map((no, i) => (
                <span key={no.chave} className="flex items-center gap-1">
                  <span>{">"}</span>
                  {i === caminho.length - 1 ? (
                    <span className="text-zinc-700">{no.nome}</span>
                  ) : (
                    <button type="button" onClick={() => onVoltarPara(i)} className="text-azul hover:underline">
                      {no.nome}
                    </button>
                  )}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex overflow-hidden rounded-md border border-zinc-200 text-xs font-medium">
          <button
            type="button"
            onClick={() => modoRanking && onToggleModo()}
            className={`px-3 py-1.5 ${!modoRanking ? "bg-azul text-white" : "bg-white text-zinc-600 hover:bg-zinc-50"}`}
          >
            Tabela
          </button>
          <button
            type="button"
            onClick={() => !modoRanking && onToggleModo()}
            className={`px-3 py-1.5 ${modoRanking ? "bg-azul text-white" : "bg-white text-zinc-600 hover:bg-zinc-50"}`}
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
        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-zinc-50 text-left text-[11px] font-medium tracking-wide text-zinc-500 uppercase">
              <tr>
                <ThOrdenavel coluna="nome" ordenacao={ordenacao} onClick={aoClicarColuna} className="px-4 py-2 font-medium">
                  {labelNivel(nivel)}
                </ThOrdenavel>
                <ThOrdenavel coluna="vAtual" ordenacao={ordenacao} onClick={aoClicarColuna} className="px-3 py-2 text-right font-medium">
                  V. Atual
                </ThOrdenavel>
                <ThOrdenavel coluna="vComp" ordenacao={ordenacao} onClick={aoClicarColuna} className="px-3 py-2 text-right font-medium">
                  V. Comp.
                </ThOrdenavel>
                <ThOrdenavel coluna="dVenda" ordenacao={ordenacao} onClick={aoClicarColuna} className="px-3 py-2 text-right font-medium">
                  %D
                </ThOrdenavel>
                <ThOrdenavel coluna="lAtual" ordenacao={ordenacao} onClick={aoClicarColuna} className="px-3 py-2 text-right font-medium">
                  L. Atual
                </ThOrdenavel>
                <ThOrdenavel coluna="lComp" ordenacao={ordenacao} onClick={aoClicarColuna} className="px-3 py-2 text-right font-medium">
                  L. Comp.
                </ThOrdenavel>
                <ThOrdenavel coluna="dLucro" ordenacao={ordenacao} onClick={aoClicarColuna} className="px-3 py-2 text-right font-medium">
                  %D
                </ThOrdenavel>
                <ThOrdenavel coluna="part" ordenacao={ordenacao} onClick={aoClicarColuna} className="px-4 py-2 text-right font-medium">
                  Part.
                </ThOrdenavel>
              </tr>
            </thead>
            <tbody>
              {ordenadas.map((linha) => (
                <tr
                  key={linha.chave}
                  onClick={() => onClickLinha(linha)}
                  className={[
                    "cursor-pointer border-t border-zinc-100 hover:bg-zinc-50",
                    nivel === "produto" && linha.chave === produtoSelecionado ? "bg-azul/5" : "",
                  ].join(" ")}
                >
                  <td className="whitespace-nowrap px-4 py-2 font-medium text-zinc-800">
                    {linha.codigo && <span className="font-normal text-zinc-400">{linha.codigo} - </span>}
                    {linha.nome}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-zinc-700">{formatMoeda(linha.atual.venda)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-zinc-400">
                    {linha.comparacao ? formatMoeda(linha.comparacao.venda) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Semaforo valor={linha.desvioVenda} tamanho="sm" />
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-zinc-700">{formatMoeda(linha.atual.lucro)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-zinc-400">
                    {linha.comparacao ? formatMoeda(linha.comparacao.lucro) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Semaforo valor={linha.desvioLucro} tamanho="sm" />
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-zinc-500">
                    {formatPercent(totalVenda !== 0 ? (linha.atual.venda / totalVenda) * 100 : 0, 1)}
                  </td>
                </tr>
              ))}
              {ordenadas.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-zinc-400">
                    Nenhum dado para o recorte selecionado.
                  </td>
                </tr>
              )}
            </tbody>
            {ordenadas.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-zinc-200 bg-zinc-50 font-semibold text-zinc-800">
                  <td className="px-4 py-2">Total</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatMoeda(subtotalAtual.venda)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-zinc-500">
                    {subtotalComparacao ? formatMoeda(subtotalComparacao.venda) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Semaforo valor={subtotalDesvioVenda} tamanho="sm" />
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatMoeda(subtotalAtual.lucro)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-zinc-500">
                    {subtotalComparacao ? formatMoeda(subtotalComparacao.lucro) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Semaforo valor={subtotalDesvioLucro} tamanho="sm" />
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">100%</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}
