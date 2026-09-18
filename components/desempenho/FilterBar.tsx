"use client";

import { useState } from "react";
import { MultiSelect } from "@/components/ui/MultiSelect";
import type { Filtros } from "@/lib/desempenho/consulta";
import { formatPeriodo } from "@/lib/desempenho/format";
import type { Loja } from "@/lib/types";

function PeriodoAtualPill({ label }: { label: string }) {
  return (
    <span
      title="Calculado automaticamente a partir das datas em bdDesempenhoComercialAtual.txt"
      className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-700"
    >
      <span className="font-medium text-zinc-800">{label}</span>
      <span className="text-zinc-500"> Atual</span>
    </span>
  );
}

/** "DD/MM/AAAA" (input date) → Date local, sem deslocar de fuso. */
function parseInputDate(valor: string): Date | null {
  const m = valor.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const [, ano, mes, dia] = m;
  return new Date(Number(ano), Number(mes) - 1, Number(dia));
}

function PeriodoComparacaoPill({
  label,
  onSalvar,
}: {
  label: string | null;
  onSalvar: (novoLabel: string) => Promise<void>;
}) {
  const [editando, setEditando] = useState(false);
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [salvando, setSalvando] = useState(false);

  if (editando) {
    return (
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const dataDe = parseInputDate(de);
          const dataAte = parseInputDate(ate);
          if (!dataDe || !dataAte) return;
          setSalvando(true);
          await onSalvar(formatPeriodo(dataDe, dataAte));
          setSalvando(false);
          setEditando(false);
        }}
        className="flex items-center gap-1.5 rounded-md border border-azul bg-white px-2 py-1"
      >
        <span className="text-sm text-zinc-500">Comparação:</span>
        <input
          autoFocus
          type="date"
          value={de}
          onChange={(e) => setDe(e.target.value)}
          className="border-b border-zinc-300 bg-transparent text-sm font-medium text-zinc-800 focus:outline-none"
        />
        <span className="text-zinc-400">–</span>
        <input
          type="date"
          value={ate}
          onChange={(e) => setAte(e.target.value)}
          className="border-b border-zinc-300 bg-transparent text-sm font-medium text-zinc-800 focus:outline-none"
        />
        <button type="submit" disabled={salvando || !de || !ate} className="text-xs font-medium text-azul hover:underline">
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
      title="Este período não vem com data no arquivo — defina manualmente de quanto até quando ele vai"
      className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-700 hover:border-zinc-400"
    >
      <span className="font-medium text-zinc-800">{label ?? "definir…"}</span>
      <span className="text-zinc-500"> Comparação</span>
      <span className="ml-1 text-zinc-400">▾</span>
    </button>
  );
}

export function FilterBar({
  lojas,
  compradores,
  filtros,
  onChange,
  periodoAtual,
  periodoComparacao,
  onSalvarPeriodoComparacao,
}: {
  lojas: Loja[];
  compradores: string[];
  filtros: Filtros;
  onChange: (filtros: Filtros) => void;
  periodoAtual: string;
  periodoComparacao: string | null;
  onSalvarPeriodoComparacao: (label: string) => Promise<void>;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-3">
      <span className="mr-1 text-xs font-medium text-zinc-400">Filtros:</span>

      <MultiSelect
        rotulo="Loja"
        rotuloTodos="Todas"
        opcoes={lojas.map((l) => ({ value: l.codUnid, label: `${l.codUnid} - ${l.nomeLoja}` }))}
        selecionados={filtros.lojas}
        onChange={(lojasSelecionadas) => onChange({ ...filtros, lojas: lojasSelecionadas })}
      />

      <MultiSelect
        rotulo="Formato"
        opcoes={[
          { value: "Varejo", label: "Varejo" },
          { value: "Atacado", label: "Atacado" },
        ]}
        selecionados={filtros.formato}
        onChange={(formato) => onChange({ ...filtros, formato })}
      />

      <MultiSelect
        rotulo="Comprador"
        opcoes={compradores.map((c) => ({ value: c, label: c }))}
        selecionados={filtros.comprador}
        onChange={(comprador) => onChange({ ...filtros, comprador })}
      />

      <div className="ml-auto flex items-center gap-2">
        <PeriodoAtualPill label={periodoAtual} />
        <PeriodoComparacaoPill label={periodoComparacao} onSalvar={onSalvarPeriodoComparacao} />
      </div>
    </div>
  );
}
