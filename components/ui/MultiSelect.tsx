"use client";

import { useEffect, useRef, useState } from "react";

export function MultiSelect({
  rotulo,
  opcoes,
  selecionados,
  onChange,
  rotuloTodos = "Todos",
  opcoesComDados,
}: {
  rotulo: string;
  opcoes: { value: string; label: string }[];
  selecionados: string[];
  onChange: (valores: string[]) => void;
  rotuloTodos?: string;
  /** Valores com pelo menos 1 registro no recorte atual (ver `docs/regras-de-negocio.md`) — quem
   * não estiver aqui aparece com fonte apagada e não dá pra marcar (mas se já estava marcado,
   * continua podendo desmarcar). `undefined` = sem essa informação ainda, nada desabilitado. */
  opcoesComDados?: string[];
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

  const semDados = (value: string) => opcoesComDados !== undefined && !opcoesComDados.includes(value);

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
          <div className="flex items-center gap-3 border-b border-zinc-100 px-3 py-1.5">
            {opcoes.length > 2 && (
              <button
                type="button"
                onClick={() => onChange(opcoes.filter((o) => !semDados(o.value)).map((o) => o.value))}
                className="text-xs font-medium text-azul hover:underline"
              >
                Selecionar tudo
              </button>
            )}
            <button type="button" onClick={() => onChange([])} className="text-xs font-medium text-azul hover:underline">
              Limpar seleção
            </button>
          </div>
          {opcoes.map((o) => {
            const selecionado = selecionados.includes(o.value);
            const desabilitado = semDados(o.value) && !selecionado;
            return (
              <label
                key={o.value}
                title={desabilitado ? "Sem movimentação no recorte atual (período + demais filtros)" : undefined}
                className={[
                  "flex items-center gap-2 px-3 py-1.5 text-sm",
                  desabilitado ? "cursor-not-allowed text-zinc-300" : "cursor-pointer text-zinc-700 hover:bg-zinc-50",
                ].join(" ")}
              >
                <input
                  type="checkbox"
                  checked={selecionado}
                  disabled={desabilitado}
                  onChange={() => alternar(o.value)}
                  className="accent-azul disabled:opacity-40"
                />
                {o.label}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
