"use client";

import type { MouseEvent } from "react";
import { Semaforo } from "@/components/ui/Semaforo";
import type { LojaAgregada } from "@/lib/desempenho/aggregate";
import { formatMoeda, formatPercent } from "@/lib/desempenho/format";

export function LojasPanel({
  linhas,
  selecionadas,
  onClickLinha,
}: {
  linhas: LojaAgregada[];
  selecionadas: string[];
  onClickLinha: (loja: LojaAgregada, evento: MouseEvent) => void;
}) {
  const ordenadas = [...linhas].sort((a, b) => a.loja.codUnid.localeCompare(b.loja.codUnid));
  const totalVenda = linhas.reduce((soma, l) => soma + l.atual.venda, 0);

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
              <th className="px-4 py-2 font-medium">Loja</th>
              <th className="px-3 py-2 text-right font-medium">V. Atual</th>
              <th className="px-3 py-2 text-right font-medium">%D</th>
              <th className="px-4 py-2 text-right font-medium">Part.</th>
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
        </table>
      </div>
    </div>
  );
}
