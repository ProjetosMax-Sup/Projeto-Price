"use client";

import { Semaforo } from "@/components/ui/Semaforo";
import { labelNivel, type EstruturaAgregada, type NivelEstrutura } from "@/lib/desempenho/aggregate";
import { formatMoeda } from "@/lib/desempenho/format";

const NIVEIS_DISPONIVEIS: NivelEstrutura[] = ["secao", "categoria", "grupo"];
const QTD_LINHAS = 5;

function Linha({ item }: { item: EstruturaAgregada }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
      <span className="truncate text-zinc-700">{item.nome}</span>
      <div className="flex shrink-0 items-center gap-2">
        <span className="tabular-nums text-zinc-500">{formatMoeda(item.atual.venda)}</span>
        <Semaforo valor={item.desvioVenda} tamanho="sm" />
      </div>
    </div>
  );
}

export function TopAltasQuedas({
  nivel,
  onNivelChange,
  linhas,
}: {
  nivel: NivelEstrutura;
  onNivelChange: (nivel: NivelEstrutura) => void;
  linhas: EstruturaAgregada[];
}) {
  const comComparacao = linhas.filter((l) => l.desvioVenda !== null);
  const altas = [...comComparacao].sort((a, b) => (b.desvioVenda ?? 0) - (a.desvioVenda ?? 0)).slice(0, QTD_LINHAS);
  const quedas = [...comComparacao].sort((a, b) => (a.desvioVenda ?? 0) - (b.desvioVenda ?? 0)).slice(0, QTD_LINHAS);

  return (
    <div className="flex flex-col rounded-lg border border-zinc-200 bg-white">
      <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
        <div>
          <h2 className="font-display font-semibold text-zinc-900">Top Altas e Quedas</h2>
        </div>
        <div className="flex overflow-hidden rounded-md border border-zinc-200 text-xs font-medium">
          {NIVEIS_DISPONIVEIS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onNivelChange(n)}
              className={`px-2.5 py-1.5 ${n === nivel ? "bg-azul text-white" : "bg-white text-zinc-600 hover:bg-zinc-50"}`}
            >
              {labelNivel(n)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 divide-y divide-zinc-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
        <div>
          <div className="px-4 pt-3 pb-1 text-xs font-medium text-verde">Maiores altas</div>
          <div className="divide-y divide-zinc-50">
            {altas.map((item) => (
              <Linha key={item.chave} item={item} />
            ))}
            {altas.length === 0 && <div className="px-4 py-4 text-sm text-zinc-400">Sem dados comparáveis.</div>}
          </div>
        </div>
        <div>
          <div className="px-4 pt-3 pb-1 text-xs font-medium text-vermelho">Maiores quedas</div>
          <div className="divide-y divide-zinc-50">
            {quedas.map((item) => (
              <Linha key={item.chave} item={item} />
            ))}
            {quedas.length === 0 && <div className="px-4 py-4 text-sm text-zinc-400">Sem dados comparáveis.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
