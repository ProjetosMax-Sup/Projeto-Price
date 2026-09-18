"use client";

import { useState, type MouseEvent } from "react";
import { CelulaMetrica } from "@/components/desempenho/CelulaMetrica";
import { ThOrdenavel } from "@/components/desempenho/ThOrdenavel";
import { agregarMetricas, type LojaAgregada } from "@/lib/desempenho/aggregate";
import { COLUNAS_METRICAS, valorColunaMetrica, type ColunaMetrica } from "@/lib/desempenho/colunas-tabela";
import { formatPercent } from "@/lib/desempenho/format";

type Coluna = "nome" | ColunaMetrica;

function ordenar(linhas: LojaAgregada[], ordenacao: { coluna: Coluna; dir: 1 | -1 } | null): LojaAgregada[] {
  if (!ordenacao) return [...linhas].sort((a, b) => a.loja.codUnid.localeCompare(b.loja.codUnid));
  const { coluna, dir } = ordenacao;
  return [...linhas].sort((a, b) => {
    if (coluna === "nome") {
      return dir * a.loja.nomeLoja.localeCompare(b.loja.nomeLoja, "pt-BR");
    }
    const va = valorColunaMetrica(a.atual, a.comparacao, coluna) ?? -Infinity;
    const vb = valorColunaMetrica(b.atual, b.comparacao, coluna) ?? -Infinity;
    return dir * (va - vb);
  });
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

  return (
    <div className="flex flex-1 flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
      <div className="bg-azul px-4 py-3">
        <h2 className="font-display font-semibold text-white">Lojas · performance geral</h2>
        <p className="mt-0.5 text-xs text-white/70">
          Clique para selecionar uma loja · Shift+clique para selecionar várias
        </p>
      </div>
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-azul text-left text-[11px] font-medium tracking-wide text-white/80 uppercase">
            <tr>
              <ThOrdenavel<Coluna> coluna="nome" ordenacao={ordenacao} onClick={aoClicarColuna} className="px-4 py-2 font-medium">
                Loja
              </ThOrdenavel>
              {COLUNAS_METRICAS.map((c) => (
                <ThOrdenavel<Coluna>
                  key={c.chave}
                  coluna={c.chave}
                  ordenacao={ordenacao}
                  onClick={aoClicarColuna}
                  className="px-3 py-2 text-right font-medium"
                >
                  {c.rotulo}
                </ThOrdenavel>
              ))}
              <th className="px-4 py-2 text-right font-medium">Part.</th>
            </tr>
          </thead>
          <tbody>
            {ordenadas.length > 0 && (
              <tr className="border-b-2 border-azul/20 bg-azul/10">
                <td className="px-4 py-2 font-semibold text-azul">Total</td>
                {COLUNAS_METRICAS.map((c) => (
                  <CelulaMetrica key={c.chave} atual={subtotalAtual} comparacao={subtotalComparacao} coluna={c.chave} enfase />
                ))}
                <td className="px-4 py-2 text-right font-semibold tabular-nums text-azul">100%</td>
              </tr>
            )}
            {ordenadas.map((linha, i) => (
              <tr
                key={linha.loja.codUnid}
                onClick={(evento) => onClickLinha(linha, evento)}
                className={[
                  "cursor-pointer border-t border-zinc-100 hover:bg-azul/5 select-none",
                  selecionadas.includes(linha.loja.codUnid) ? "bg-vermelho/10" : i % 2 === 1 ? "bg-zinc-50/70" : "",
                ].join(" ")}
              >
                <td className="whitespace-nowrap px-4 py-2 font-medium text-zinc-800">
                  <span className="font-normal text-zinc-400">{linha.loja.codUnid} - </span>
                  {linha.loja.nomeLoja}
                  <span
                    className={[
                      "ml-1.5 rounded px-1.5 py-0.5 text-[10px] font-medium",
                      linha.loja.formato === "Atacado" ? "bg-vermelho/10 text-vermelho" : "bg-azul/10 text-azul",
                    ].join(" ")}
                  >
                    {linha.loja.formato}
                  </span>
                </td>
                {COLUNAS_METRICAS.map((c) => (
                  <CelulaMetrica key={c.chave} atual={linha.atual} comparacao={linha.comparacao} coluna={c.chave} />
                ))}
                <td className="px-4 py-2 text-right tabular-nums text-zinc-500">
                  {formatPercent(totalVenda !== 0 ? (linha.atual.venda / totalVenda) * 100 : 0, 1)}
                </td>
              </tr>
            ))}
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
    </div>
  );
}
