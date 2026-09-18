"use client";

import { useState } from "react";
import type { Filtros } from "@/lib/desempenho/consulta";

function SelectPill({
  rotulo,
  valor,
  onChange,
  opcoes,
}: {
  rotulo: string;
  valor: string;
  onChange: (v: string) => void;
  opcoes: { value: string; label: string }[];
}) {
  return (
    <label className="flex items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-700 hover:border-zinc-400">
      <span className="text-zinc-500">{rotulo}:</span>
      <select
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent font-medium text-zinc-800 focus:outline-none"
      >
        {opcoes.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function PeriodoAtualPill({ label }: { label: string }) {
  return (
    <span
      title="Calculado automaticamente a partir das datas em bdDesempenhoComercialAtual.txt"
      className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-700"
    >
      <span className="text-zinc-500">Atual: </span>
      <span className="font-medium text-zinc-800">{label}</span>
    </span>
  );
}

function PeriodoComparacaoPill({
  label,
  onSalvar,
}: {
  label: string | null;
  onSalvar: (novoLabel: string) => Promise<void>;
}) {
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(label ?? "");
  const [salvando, setSalvando] = useState(false);

  if (editando) {
    return (
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!valor.trim()) return;
          setSalvando(true);
          await onSalvar(valor.trim());
          setSalvando(false);
          setEditando(false);
        }}
        className="flex items-center gap-1.5 rounded-md border border-azul bg-white px-2 py-1"
      >
        <span className="text-sm text-zinc-500">Comparação:</span>
        <input
          autoFocus
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          placeholder="ex: Julho/2026"
          className="w-28 border-b border-zinc-300 bg-transparent text-sm font-medium text-zinc-800 focus:outline-none"
        />
        <button type="submit" disabled={salvando} className="text-xs font-medium text-azul hover:underline">
          {salvando ? "..." : "Salvar"}
        </button>
        <button type="button" onClick={() => setEditando(false)} className="text-xs text-zinc-400 hover:text-zinc-600">
          ✕
        </button>
      </form>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditando(true)}
      title="Este período não vem com data no arquivo — defina manualmente o que ele representa"
      className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-700 hover:border-zinc-400"
    >
      <span className="text-zinc-500">Comparação: </span>
      <span className="font-medium text-zinc-800">{label ?? "definir…"}</span>
      <span className="ml-1 text-zinc-400">▾</span>
    </button>
  );
}

export function FilterBar({
  compradores,
  filtros,
  onChange,
  periodoAtual,
  periodoComparacao,
  onSalvarPeriodoComparacao,
}: {
  compradores: { codigo: string; nome: string }[];
  filtros: Filtros;
  onChange: (filtros: Filtros) => void;
  periodoAtual: string;
  periodoComparacao: string | null;
  onSalvarPeriodoComparacao: (label: string) => Promise<void>;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-3">
      <span className="mr-1 text-xs font-medium text-zinc-400">Filtros:</span>

      <SelectPill
        rotulo="Formato"
        valor={filtros.formato}
        onChange={(v) => onChange({ ...filtros, formato: v as Filtros["formato"] })}
        opcoes={[
          { value: "Todos", label: "Todos" },
          { value: "Varejo", label: "Varejo" },
          { value: "Atacado", label: "Atacado" },
        ]}
      />

      <SelectPill
        rotulo="Comprador"
        valor={filtros.comprador}
        onChange={(v) => onChange({ ...filtros, comprador: v })}
        opcoes={[{ value: "Todos", label: "Todos" }, ...compradores.map((c) => ({ value: c.codigo, label: c.nome }))]}
      />

      <div className="ml-auto flex items-center gap-2">
        <PeriodoAtualPill label={periodoAtual} />
        <PeriodoComparacaoPill label={periodoComparacao} onSalvar={onSalvarPeriodoComparacao} />
      </div>
    </div>
  );
}
