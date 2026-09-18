"use client";

import { useState, type MouseEvent } from "react";
import { Semaforo } from "@/components/ui/Semaforo";
import { agregarMetricas, type LojaAgregada } from "@/lib/desempenho/aggregate";
import { calcDesvio, formatMoeda, formatPercent } from "@/lib/desempenho/format";

type Coluna = "nome" | "vAtual" | "dVenda" | "part";

function valorColuna(linha: LojaAgregada, coluna: Coluna): string | number {
  switch (coluna) {
    case "nome":
      return linha.loja.nomeLoja;
    case "vAtual":
    case "part":
      return linha.atual.venda;
    case "dVenda":
      return linha.desvioVenda ?? -Infinity;
  }
}

function ordenar(linhas: LojaAgregada[], ordenacao: { coluna: Coluna; dir: 1 | -1 } | null): LojaAgregada[] {
  if (!ordenacao) return [...linhas].sort((a, b) => a.loja.codUnid.localeCompare(b.loja.codUnid));
  const { coluna, dir } = ordenacao;
  return [...linhas].sort((a, b) => {
    const va = valorColuna(a, coluna);
    const vb = valorColuna(b, coluna);
    if (typeof va === "string" || typeof vb === "string") {
      return dir * String(va).localeCompare(String(vb), "pt-BR");
    }
    return dir * (va - vb);
  });
}

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

export function LojasPanel({
  linhas,
  selecionadas,
  onClickLinha,
}: {
  linhas: LojaAgregada[];
  selecionadas: string[];
  onClickLinha: (loja: LojaAgregada, evento: MouseEvent) => void;
}) {
  const [ordenacao, setOrdenacao] = useState<{ coluna: Coluna; dir: 1 | -1 } | null>(null);

  function aoClicarColuna(coluna: Coluna) {
    setOrdenacao((atual) =>
      atual?.coluna === coluna ? { coluna, dir: atual.dir === 1 ? -1 : 1 } : { coluna, dir: 1 },
    );
  }

  const ordenadas = ordenar(linhas, ordenacao);
  const totalVenda = linhas.reduce((soma, l) => soma + l.atual.venda, 0);

  const subtotalAtual = agregarMetricas(linhas.map((l) => l.atual));
  const linhasComComparacao = linhas.filter((l): l is LojaAgregada & { comparacao: NonNullable<LojaAgregada["comparacao"]> } => l.comparacao !== null);
  const subtotalComparacao = linhasComComparacao.length > 0 ? agregarMetricas(linhasComComparacao.map((l) => l.comparacao)) : null;
  const subtotalDesvioVenda = subtotalComparacao ? calcDesvio(subtotalAtual.venda, subtotalComparacao.venda) : null;

  return (
    <div className="flex flex-1 flex-col rounded-lg border border-zinc-200 bg-white">
      <div className="border-b border-zinc-100 px-4 py-3">
        <h2 className="font-display font-semibold text-zinc-900">Lojas · performance geral</h2>
        <p className="mt-0.5 text-xs text-zinc-400">
          Clique para selecionar uma loja · Shift+clique para selecionar várias
        </p>
      </div>
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-zinc-50 text-left text-[11px] font-medium tracking-wide text-zinc-500 uppercase">
            <tr>
              <ThOrdenavel coluna="nome" ordenacao={ordenacao} onClick={aoClicarColuna} className="px-4 py-2 font-medium">
                Loja
              </ThOrdenavel>
              <ThOrdenavel coluna="vAtual" ordenacao={ordenacao} onClick={aoClicarColuna} className="px-3 py-2 text-right font-medium">
                V. Atual
              </ThOrdenavel>
              <ThOrdenavel coluna="dVenda" ordenacao={ordenacao} onClick={aoClicarColuna} className="px-3 py-2 text-right font-medium">
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
                key={linha.loja.codUnid}
                onClick={(evento) => onClickLinha(linha, evento)}
                className={[
                  "cursor-pointer border-t border-zinc-100 hover:bg-zinc-50 select-none",
                  selecionadas.includes(linha.loja.codUnid) ? "bg-azul/5" : "",
                ].join(" ")}
              >
                <td className="whitespace-nowrap px-4 py-2 font-medium text-zinc-800">
                  <span className="font-normal text-zinc-400">{linha.loja.codUnid} - </span>
                  {linha.loja.nomeLoja}
                  <span className="ml-1.5 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500">
                    {linha.loja.formato}
                  </span>
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-zinc-700">{formatMoeda(linha.atual.venda)}</td>
                <td className="px-3 py-2 text-right">
                  <Semaforo valor={linha.desvioVenda} tamanho="sm" />
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-zinc-500">
                  {formatPercent(totalVenda !== 0 ? (linha.atual.venda / totalVenda) * 100 : 0, 1)}
                </td>
              </tr>
            ))}
            {ordenadas.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-zinc-400">
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
                <td className="px-3 py-2 text-right">
                  <Semaforo valor={subtotalDesvioVenda} tamanho="sm" />
                </td>
                <td className="px-4 py-2 text-right tabular-nums">100%</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
