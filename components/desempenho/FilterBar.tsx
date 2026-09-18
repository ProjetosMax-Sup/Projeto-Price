"use client";

import { MultiSelect } from "@/components/ui/MultiSelect";
import type { Filtros } from "@/lib/desempenho/consulta";
import type { Loja } from "@/lib/types";

export function FilterBar({
  lojas,
  compradores,
  filtros,
  onChange,
}: {
  lojas: Loja[];
  compradores: { codigo: string; nome: string }[];
  filtros: Filtros;
  onChange: (filtros: Filtros) => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-4 rounded-lg border border-zinc-200 bg-white px-5 py-4">
      <MultiSelect
        rotulo="Loja"
        opcoes={lojas.map((l) => ({ value: l.codUnid, label: `${l.codUnid} - ${l.nomeLoja}` }))}
        selecionados={filtros.lojas}
        onChange={(lojasSel) => onChange({ ...filtros, lojas: lojasSel })}
      />

      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-500">Formato</label>
        <select
          value={filtros.formato}
          onChange={(e) => onChange({ ...filtros, formato: e.target.value as Filtros["formato"] })}
          className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-800 hover:border-zinc-400"
        >
          <option value="Todos">Todos</option>
          <option value="Varejo">Varejo</option>
          <option value="Atacado">Atacado</option>
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-500">Comprador</label>
        <select
          value={filtros.comprador}
          onChange={(e) => onChange({ ...filtros, comprador: e.target.value })}
          className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-800 hover:border-zinc-400"
        >
          <option value="Todos">Todos</option>
          {compradores.map((c) => (
            <option key={c.codigo} value={c.codigo}>
              {c.nome}
            </option>
          ))}
        </select>
      </div>

      <div className="ml-auto flex gap-6 text-sm">
        <div>
          <div className="text-xs font-medium text-zinc-500">Período atual</div>
          <div className="text-zinc-800">Setembro/2026</div>
        </div>
        <div>
          <div className="text-xs font-medium text-zinc-500">Comparação</div>
          <div className="text-zinc-800">Setembro/2025</div>
        </div>
      </div>
    </div>
  );
}
