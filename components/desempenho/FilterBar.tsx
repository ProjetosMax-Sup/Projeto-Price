"use client";

import { MultiSelect } from "@/components/ui/MultiSelect";
import type { Filtros } from "@/lib/desempenho/consulta";
import type { Loja } from "@/lib/types";

/** Rótulo estático — Atual e Comparação usam o mesmo visual (não editável por aqui por enquanto). */
function PeriodoPill({ label, sufixo, titulo }: { label: string; sufixo: string; titulo?: string }) {
  return (
    <span title={titulo} className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-700">
      <span className="font-medium text-zinc-800">{label}</span>
      <span className="text-zinc-500"> {sufixo}</span>
    </span>
  );
}

export function FilterBar({
  lojas,
  compradores,
  filtros,
  onChange,
  periodoAtual,
  periodoComparacao,
}: {
  lojas: Loja[];
  compradores: string[];
  filtros: Filtros;
  onChange: (filtros: Filtros) => void;
  periodoAtual: string;
  periodoComparacao: string | null;
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
        <PeriodoPill
          label={periodoAtual}
          sufixo="Atual"
          titulo="Calculado automaticamente a partir das datas em bdDesempenhoComercialAtual.txt"
        />
        <PeriodoPill label={periodoComparacao ?? "—"} sufixo="Comparação" />
      </div>
    </div>
  );
}
