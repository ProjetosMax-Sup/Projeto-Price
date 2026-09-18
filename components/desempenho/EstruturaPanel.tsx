"use client";

import { RankingBar } from "@/components/charts/RankingBar";
import { Semaforo } from "@/components/ui/Semaforo";
import { labelNivel, type EstruturaAgregada, type NivelEstrutura, type NoSelecionado } from "@/lib/desempenho/aggregate";
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
  modoRanking,
  onToggleModo,
  onClickLinha,
  onVoltarPara,
}: {
  nivel: NivelEstrutura;
  linhas: EstruturaAgregada[];
  caminho: NoSelecionado[];
  modoRanking: boolean;
  onToggleModo: () => void;
  onClickLinha: (linha: EstruturaAgregada) => void;
  onVoltarPara: (indice: number) => void;
}) {
  const ehFolha = nivel === "produto";
  const ordenadas = modoRanking ? ordenarRanking(linhas) : ordenarTabela(linhas);
  const valorMax = Math.max(1, ...linhas.map((l) => l.atual.venda));
  const totalVenda = linhas.reduce((soma, l) => soma + l.atual.venda, 0);

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
              ativo={false}
              onClick={ehFolha ? undefined : () => onClickLinha(linha)}
            />
          ))}
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-zinc-50 text-left text-[11px] font-medium tracking-wide text-zinc-500 uppercase">
              <tr>
                <th className="px-4 py-2 font-medium">{labelNivel(nivel)}</th>
                <th className="px-3 py-2 text-right font-medium">V. Atual</th>
                <th className="px-3 py-2 text-right font-medium">V. Comp.</th>
                <th className="px-3 py-2 text-right font-medium">%D</th>
                <th className="px-3 py-2 text-right font-medium">L. Atual</th>
                <th className="px-3 py-2 text-right font-medium">L. Comp.</th>
                <th className="px-3 py-2 text-right font-medium">%D</th>
                <th className="px-4 py-2 text-right font-medium">Part.</th>
              </tr>
            </thead>
            <tbody>
              {ordenadas.map((linha) => (
                <tr
                  key={linha.chave}
                  onClick={() => !ehFolha && onClickLinha(linha)}
                  className={`border-t border-zinc-100 hover:bg-zinc-50 ${ehFolha ? "" : "cursor-pointer"}`}
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
          </table>
        </div>
      )}
    </div>
  );
}
