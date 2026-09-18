"use client";

import { RankingBar } from "@/components/charts/RankingBar";
import { Semaforo } from "@/components/ui/Semaforo";
import type { EstruturaAgregada, NivelEstrutura } from "@/lib/desempenho/aggregate";
import { formatMoeda, formatPercent } from "@/lib/desempenho/format";

function ordenarTabela(linhas: EstruturaAgregada[]): EstruturaAgregada[] {
  return [...linhas].sort((a, b) => {
    if (a.codigo && b.codigo) return a.codigo.localeCompare(b.codigo);
    return a.nome.localeCompare(b.nome, "pt-BR");
  });
}

function ordenarRanking(linhas: EstruturaAgregada[]): EstruturaAgregada[] {
  return [...linhas].sort((a, b) => b.atual.venda - a.atual.venda);
}

export function EstruturaPanel({
  nivel,
  linhas,
  departamentoAtivo,
  selecionado,
  modoRanking,
  onToggleModo,
  onClickLinha,
  onVoltar,
}: {
  nivel: NivelEstrutura;
  linhas: EstruturaAgregada[];
  departamentoAtivo: { nome: string } | null;
  selecionado: { chave: string } | null;
  modoRanking: boolean;
  onToggleModo: () => void;
  onClickLinha: (linha: EstruturaAgregada) => void;
  onVoltar: () => void;
}) {
  const ordenadas = modoRanking ? ordenarRanking(linhas) : ordenarTabela(linhas);
  const valorMax = Math.max(1, ...linhas.map((l) => l.atual.venda));

  return (
    <div className="flex flex-1 flex-col rounded-lg border border-zinc-200 bg-white">
      <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
        <div className="text-sm">
          <h2 className="font-display font-semibold text-zinc-900">Estrutura Mercadológica</h2>
          {nivel === "secao" && departamentoAtivo && (
            <div className="mt-0.5 text-xs text-zinc-500">
              <button type="button" onClick={onVoltar} className="text-azul hover:underline">
                Departamentos
              </button>
              {" > "}
              <span className="text-zinc-700">{departamentoAtivo.nome}</span>
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
              ativo={selecionado?.chave === linha.chave}
              onClick={() => onClickLinha(linha)}
            />
          ))}
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-zinc-50 text-left text-xs font-medium text-zinc-500">
              <tr>
                <th className="px-4 py-2 font-medium">{nivel === "departamento" ? "Departamento" : "Seção"}</th>
                <th className="px-4 py-2 text-right font-medium">Venda</th>
                <th className="px-4 py-2 text-right font-medium">%Desvio Venda</th>
                <th className="px-4 py-2 text-right font-medium">Lucro</th>
                <th className="px-4 py-2 text-right font-medium">%Lucro</th>
                <th className="px-4 py-2 text-right font-medium">%Desvio Lucro</th>
              </tr>
            </thead>
            <tbody>
              {ordenadas.map((linha) => (
                <tr
                  key={linha.chave}
                  onClick={() => onClickLinha(linha)}
                  className={[
                    "cursor-pointer border-t border-zinc-100 hover:bg-zinc-50",
                    selecionado?.chave === linha.chave ? "bg-azul/5" : "",
                  ].join(" ")}
                >
                  <td className="px-4 py-2 text-zinc-800">
                    {linha.codigo && <span className="text-zinc-400">{linha.codigo} - </span>}
                    {linha.nome}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-zinc-700">
                    {formatMoeda(linha.atual.venda)}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Semaforo valor={linha.desvioVenda} tamanho="sm" />
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-zinc-700">
                    {formatMoeda(linha.atual.lucro)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-zinc-700">
                    {formatPercent(linha.atual.percLucro)}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Semaforo valor={linha.desvioLucro} tamanho="sm" />
                  </td>
                </tr>
              ))}
              {ordenadas.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-zinc-400">
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
