"use client";

import { Semaforo } from "@/components/ui/Semaforo";
import { labelNivel, type EstruturaAgregada, type NivelHierarquia } from "@/lib/desempenho/aggregate";

const NIVEIS_DISPONIVEIS: NivelHierarquia[] = ["secao", "categoria", "grupo"];
const QTD_LINHAS = 5;

/** "Departamento - Nome" — departamento é sempre o primeiro segmento da chave. */
function rotuloItem(item: EstruturaAgregada): string {
  const partes = item.chave.split(" > ");
  if (partes.length <= 1) return item.nome;
  return `${partes[0]} - ${item.nome}`;
}

function Linha({ item }: { item: EstruturaAgregada }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
      <span className="truncate text-zinc-700">{rotuloItem(item)}</span>
      <Semaforo valor={item.desvioVenda} tamanho="sm" />
    </div>
  );
}

export function TopAltasQuedas({
  nivel,
  onNivelChange,
  linhas,
}: {
  nivel: NivelHierarquia;
  onNivelChange: (nivel: NivelHierarquia) => void;
  linhas: EstruturaAgregada[];
}) {
  // Um item só entra num grupo se o desvio realmente aponta pra aquele lado —
  // nunca repete: quem caiu não aparece em Altas, quem subiu não aparece em Quedas.
  const emAlta = linhas.filter((l) => l.desvioVenda !== null && l.desvioVenda > 0);
  const emQueda = linhas.filter((l) => l.desvioVenda !== null && l.desvioVenda < 0);
  const altas = [...emAlta].sort((a, b) => (b.desvioVenda ?? 0) - (a.desvioVenda ?? 0)).slice(0, QTD_LINHAS);
  const quedas = [...emQueda].sort((a, b) => (a.desvioVenda ?? 0) - (b.desvioVenda ?? 0)).slice(0, QTD_LINHAS);

  return (
    <div className="flex flex-col rounded-lg border border-zinc-200 bg-white">
      <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
        <h2 className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
          Top por %Desvio de Venda · {labelNivel(nivel)} (visão geral)
        </h2>
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
          <div className="px-4 pt-3 pb-1 text-xs font-medium text-verde">Top {QTD_LINHAS} Altas</div>
          <div className="divide-y divide-zinc-50">
            {altas.map((item) => (
              <Linha key={item.chave} item={item} />
            ))}
            {altas.length === 0 && <div className="px-4 py-4 text-sm text-zinc-400">Sem dados comparáveis.</div>}
          </div>
        </div>
        <div>
          <div className="px-4 pt-3 pb-1 text-xs font-medium text-vermelho">Top {QTD_LINHAS} Quedas</div>
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
