"use client";

import { PeriodoRangeInput } from "@/components/desempenho/PeriodoRangeInput";
import { MultiSelect } from "@/components/ui/MultiSelect";
import type { ConsultaDesempenho, Filtros, IntervaloData } from "@/lib/desempenho/consulta";
import type { Loja } from "@/lib/types";

export function FilterBar({
  lojas,
  compradores,
  filtros,
  onChange,
  periodoAtualLabel,
  periodoComparacaoLabel,
  periodoAtual,
  onChangePeriodoAtual,
  periodoComparacao,
  onChangePeriodoComparacao,
  datasDisponiveisAtual,
  datasDisponiveisComparacao,
}: {
  lojas: Loja[];
  compradores: string[];
  filtros: Filtros;
  onChange: (filtros: Filtros) => void;
  /** Rótulo do período automático (range completo do arquivo), calculado no servidor. */
  periodoAtualLabel: string;
  periodoComparacaoLabel: string | null;
  periodoAtual: ConsultaDesempenho["periodoAtual"];
  onChangePeriodoAtual: (v: IntervaloData | null) => void;
  periodoComparacao: ConsultaDesempenho["periodoComparacao"];
  onChangePeriodoComparacao: (v: IntervaloData | null) => void;
  datasDisponiveisAtual: string[];
  datasDisponiveisComparacao: string[];
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

      <div className="ml-auto flex flex-wrap items-start gap-2">
        <PeriodoRangeInput
          rotulo="Atual"
          valor={periodoAtual}
          onChange={onChangePeriodoAtual}
          datasDisponiveis={datasDisponiveisAtual}
          labelAuto={periodoAtualLabel}
        />
        <PeriodoRangeInput
          rotulo="Comparação"
          valor={periodoComparacao}
          onChange={onChangePeriodoComparacao}
          datasDisponiveis={datasDisponiveisComparacao}
          labelAuto={periodoComparacaoLabel}
        />
      </div>
    </div>
  );
}
