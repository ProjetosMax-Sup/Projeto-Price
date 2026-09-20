"use client";

import { CalendarioIntervalo } from "@/components/desempenho/CalendarioIntervalo";
import { MultiSelect } from "@/components/ui/MultiSelect";
import type { ConsultaDesempenho, Filtros, IntervaloData, OpcoesComDados } from "@/lib/desempenho/consulta";
import type { Loja } from "@/lib/types";

export function FilterBar({
  lojas,
  compradores,
  departamentos,
  filtros,
  onChange,
  opcoesComDados,
  labelPeriodoDisponivel,
  periodoAtual,
  onChangePeriodoAtual,
  periodoAtualPadrao,
  periodoComparacao,
  onChangePeriodoComparacao,
  periodoComparacaoPadrao,
  datasDisponiveis,
}: {
  lojas: Loja[];
  compradores: string[];
  departamentos: { value: string; label: string }[];
  filtros: Filtros;
  onChange: (filtros: Filtros) => void;
  /** Valores de cada filtro com venda > 0 no recorte atual — opção fora dessa lista fica com
   * fonte apagada e não dá pra marcar (ver `docs/regras-de-negocio.md`). */
  opcoesComDados: OpcoesComDados;
  /** Rótulo do range completo disponível (todos os meses), calculado no servidor — só usado
   * como último recurso quando não há dado nenhum (sem período padrão pra cair de volta). Os
   * dois seletores (Atual/Comparação) compartilham o mesmo conjunto de datas disponíveis. */
  labelPeriodoDisponivel: string | null;
  periodoAtual: ConsultaDesempenho["periodoAtual"];
  onChangePeriodoAtual: (v: IntervaloData | null) => void;
  /** Mês mais recente com dado — pra onde "Limpar seleção" volta. */
  periodoAtualPadrao: IntervaloData | null;
  periodoComparacao: ConsultaDesempenho["periodoComparacao"];
  onChangePeriodoComparacao: (v: IntervaloData | null) => void;
  periodoComparacaoPadrao: IntervaloData | null;
  datasDisponiveis: string[];
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
        opcoesComDados={opcoesComDados.lojas}
      />

      <MultiSelect
        rotulo="Formato"
        opcoes={[
          { value: "Varejo", label: "Varejo" },
          { value: "Atacado", label: "Atacado" },
        ]}
        selecionados={filtros.formato}
        onChange={(formato) => onChange({ ...filtros, formato })}
        opcoesComDados={opcoesComDados.formato}
      />

      <MultiSelect
        rotulo="Comprador"
        opcoes={compradores.map((c) => ({ value: c, label: c }))}
        selecionados={filtros.comprador}
        onChange={(comprador) => onChange({ ...filtros, comprador })}
        opcoesComDados={opcoesComDados.comprador}
      />

      <MultiSelect
        rotulo="Departamento"
        opcoes={departamentos}
        selecionados={filtros.departamentos}
        onChange={(departamentosSelecionados) => onChange({ ...filtros, departamentos: departamentosSelecionados })}
        opcoesComDados={opcoesComDados.departamentos}
      />

      <div className="flex items-center gap-1">
        <div className="flex overflow-hidden rounded-md border border-zinc-300 text-sm font-medium">
          <button
            type="button"
            onClick={() => onChange({ ...filtros, mesmasLojas: false })}
            className={`px-3 py-1.5 ${!filtros.mesmasLojas ? "bg-azul text-white" : "bg-white text-zinc-600 hover:bg-zinc-50"}`}
          >
            Total Lojas
          </button>
          <button
            type="button"
            onClick={() => onChange({ ...filtros, mesmasLojas: true })}
            className={`px-3 py-1.5 ${filtros.mesmasLojas ? "bg-azul text-white" : "bg-white text-zinc-600 hover:bg-zinc-50"}`}
          >
            Mesmas Lojas
          </button>
        </div>
        <span
          className="cursor-help text-zinc-400"
          title="Mesmas Lojas: exclui dos totais e subtotais as lojas que nunca venderam antes do início de nenhum dos dois períodos (loja realmente nova) — linha vermelha na tabela de Lojas. Loja que já vendia antes e só ficou um tempo sem vender (feriado/reforma) continua contando normalmente — linha amarela, só um aviso. As linhas continuam aparecendo na tabela de Lojas mesmo quando excluídas do total."
        >
          ⓘ
        </span>
      </div>

      <div className="ml-auto flex flex-wrap items-start gap-2">
        <CalendarioIntervalo
          rotulo="Atual"
          valor={periodoAtual}
          onChange={onChangePeriodoAtual}
          valorPadrao={periodoAtualPadrao}
          datasDisponiveis={datasDisponiveis}
          labelAuto={labelPeriodoDisponivel}
        />
        <CalendarioIntervalo
          rotulo="Comparação"
          valor={periodoComparacao}
          onChange={onChangePeriodoComparacao}
          valorPadrao={periodoComparacaoPadrao}
          datasDisponiveis={datasDisponiveis}
          labelAuto={labelPeriodoDisponivel}
          valorReferencia={periodoAtual}
        />
      </div>
    </div>
  );
}
