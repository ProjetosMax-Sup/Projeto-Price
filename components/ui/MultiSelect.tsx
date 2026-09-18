"use client";

import { useEffect, useRef, useState } from "react";

export interface MultiSelectOption {
  value: string;
  label: string;
}

/** Seleção múltipla simples. Lista vazia em `selecionados` significa "todas". */
export function MultiSelect({
  rotulo,
  opcoes,
  selecionados,
  onChange,
}: {
  rotulo: string;
  opcoes: MultiSelectOption[];
  selecionados: string[];
  onChange: (valores: string[]) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function aoClicarFora(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener("mousedown", aoClicarFora);
    return () => document.removeEventListener("mousedown", aoClicarFora);
  }, []);

  const todasSelecionadas = selecionados.length === 0;
  const rotuloResumo = todasSelecionadas
    ? "Todas"
    : selecionados.length === 1
      ? opcoes.find((o) => o.value === selecionados[0])?.label
      : `${selecionados.length} selecionadas`;

  function alternar(valor: string) {
    if (selecionados.includes(valor)) {
      onChange(selecionados.filter((v) => v !== valor));
    } else {
      onChange([...selecionados, valor]);
    }
  }

  return (
    <div ref={ref} className="relative">
      <label className="mb-1 block text-xs font-medium text-zinc-500">{rotulo}</label>
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        className="flex w-full min-w-[160px] items-center justify-between rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-800 hover:border-zinc-400"
      >
        <span className="truncate">{rotuloResumo}</span>
        <span className="ml-2 text-zinc-400">▾</span>
      </button>
      {aberto && (
        <div className="absolute z-10 mt-1 max-h-64 w-56 overflow-auto rounded-md border border-zinc-200 bg-white py-1 shadow-lg">
          <button
            type="button"
            onClick={() => onChange([])}
            className="flex w-full items-center px-3 py-1.5 text-left text-sm text-azul hover:bg-zinc-50"
          >
            Selecionar todas
          </button>
          <div className="my-1 border-t border-zinc-100" />
          {opcoes.map((opcao) => (
            <label
              key={opcao.value}
              className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
            >
              <input
                type="checkbox"
                checked={selecionados.includes(opcao.value)}
                onChange={() => alternar(opcao.value)}
                className="accent-azul"
              />
              {opcao.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
