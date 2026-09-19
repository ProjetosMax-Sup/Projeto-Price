"use client";

import { useState } from "react";
import { DataTriplaInput } from "@/components/desempenho/DataTriplaInput";
import type { IntervaloData } from "@/lib/desempenho/consulta";

/**
 * "De [Dia][Mês][Ano] até [Dia][Mês][Ano] {rotulo}" — substitui o rótulo estático antigo.
 * Só chama `onChange` pra cima quando início e fim são datas de calendário reais, existem no
 * arquivo correspondente (`datasDisponiveis`) e fim ≥ início; caso contrário mantém `valor`
 * como está (não dispara consulta) e mostra um aviso inline não bloqueante.
 */
export function PeriodoRangeInput({
  rotulo,
  valor,
  onChange,
  datasDisponiveis,
  labelAuto,
}: {
  rotulo: string;
  valor: IntervaloData | null;
  onChange: (v: IntervaloData | null) => void;
  datasDisponiveis: string[];
  labelAuto: string | null;
}) {
  const [inicioIso, setInicioIso] = useState<string | null>(null);
  const [fimIso, setFimIso] = useState<string | null>(null);

  const anosDisponiveis = Array.from(new Set(datasDisponiveis.map((d) => Number(d.slice(0, 4))))).sort((a, b) => a - b);
  const datasValidasSet = new Set(datasDisponiveis);

  function aoMudarInicio(iso: string | null) {
    setInicioIso(iso);
    atualizar(iso, fimIso);
  }

  function aoMudarFim(iso: string | null) {
    setFimIso(iso);
    atualizar(inicioIso, iso);
  }

  function atualizar(inicio: string | null, fim: string | null) {
    if (inicio && fim && datasValidasSet.has(inicio) && datasValidasSet.has(fim) && fim >= inicio) {
      onChange({ inicio, fim });
    } else {
      onChange(null);
    }
  }

  function aoLimpar() {
    setInicioIso(null);
    setFimIso(null);
    onChange(null);
  }

  const inicioInexistente = inicioIso !== null && !datasValidasSet.has(inicioIso);
  const fimInexistente = fimIso !== null && !datasValidasSet.has(fimIso);
  const fimAntesDoInicio = inicioIso !== null && fimIso !== null && !inicioInexistente && !fimInexistente && fimIso < inicioIso;

  return (
    <div className="flex flex-col gap-1 rounded-md border border-zinc-300 bg-white px-2 py-1.5">
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-zinc-500">
        <span>de</span>
        <DataTriplaInput valor={valor?.inicio ?? null} onChange={aoMudarInicio} anosDisponiveis={anosDisponiveis} />
        <span>até</span>
        <DataTriplaInput valor={valor?.fim ?? null} onChange={aoMudarFim} anosDisponiveis={anosDisponiveis} />
        <span className="font-medium text-zinc-800">{rotulo}</span>
        {valor && (
          <button
            type="button"
            onClick={aoLimpar}
            title="Voltar ao período automático"
            className="ml-0.5 rounded px-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
          >
            ×
          </button>
        )}
      </div>
      {!valor && labelAuto && <p className="text-[11px] text-zinc-400">Automático: {labelAuto}</p>}
      {inicioInexistente && <p className="text-[11px] text-vermelho">Sem dados em {inicioIso} ({rotulo})</p>}
      {fimInexistente && <p className="text-[11px] text-vermelho">Sem dados em {fimIso} ({rotulo})</p>}
      {fimAntesDoInicio && <p className="text-[11px] text-vermelho">Data final antes da inicial</p>}
    </div>
  );
}
