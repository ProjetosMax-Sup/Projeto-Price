"use client";

import { useEffect, useRef, useState } from "react";

export function MultiSelect({
  rotulo,
  opcoes,
  selecionados,
  onChange,
  rotuloTodos = "Todos",
}: {
  rotulo: string;
  opcoes: { value: string; label: string }[];
  selecionados: string[];
  onChange: (valores: string[]) => void;
  rotuloTodos?: string;
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

  function alternar(value: string) {
    onChange(selecionados.includes(value) ? selecionados.filter((v) => v !== value) : [...selecionados, value]);
  }

  const resumo =
    selecionados.length === 0
      ? rotuloTodos
      : selecionados.length === 1
        ? (opcoes.find((o) => o.value === selecionados[0])?.label ?? "1 selecionada")
        : `${selecionados.length} selecionadas`;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        className="flex items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-700 hover:border-zinc-400"
      >
        <span className="text-zinc-500">{rotulo}:</span>
        <span className="font-medium text-zinc-800">{resumo}</span>
        <span className="text-zinc-400">▾</span>
      </button>
      {aberto && (
        <div className="absolute left-0 top-full z-30 mt-1 max-h-64 w-56 overflow-auto rounded-md border border-zinc-200 bg-white py-1 shadow-lg">
          <button
            type="button"
            onClick={() => onChange([])}
            className="block w-full px-3 py-1.5 text-left text-xs font-medium text-azul hover:bg-zinc-50"
          >
            Limpar seleção
          </button>
          {opcoes.map((o) => (
            <label
              key={o.value}
              className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
            >
              <input
                type="checkbox"
                checked={selecionados.includes(o.value)}
                onChange={() => alternar(o.value)}
                className="accent-azul"
              />
              {o.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
