"use client";

import { useMemo, useState } from "react";
import { DepartamentosTable } from "@/components/parametros/DepartamentosTable";
import { DicionarioColunasTable } from "@/components/parametros/DicionarioColunasTable";
import { LojasTable } from "@/components/parametros/LojasTable";
import { RelatorioColunasPanel } from "@/components/parametros/relatorio/RelatorioColunasPanel";
import type { ColunaNativa, DepartamentoCadastro, LojaCadastro } from "@/lib/parametros/types";

const ABAS = [
  { valor: "lojas", label: "Lojas" },
  { valor: "departamentos", label: "Departamentos" },
  { valor: "dicionario", label: "Dicionário de Colunas" },
  { valor: "colunas", label: "Colunas (por relatório)" },
] as const;

export function ParametrosDashboard({
  lojasIniciais,
  departamentosIniciais,
  dicionarioInicial,
}: {
  lojasIniciais: LojaCadastro[];
  departamentosIniciais: DepartamentoCadastro[];
  dicionarioInicial: ColunaNativa[];
}) {
  const [aba, setAba] = useState<(typeof ABAS)[number]["valor"]>("lojas");
  const [lojas, setLojas] = useState<LojaCadastro[]>(lojasIniciais);
  const [departamentos, setDepartamentos] = useState<DepartamentoCadastro[]>(departamentosIniciais);
  const [dicionario, setDicionario] = useState<ColunaNativa[]>(dicionarioInicial);

  // Formatos vêm de Lojas em tempo real (mesmo antes de salvar) — Departamentos precisa saber
  // quais formatos existem pra pedir um comprador por formato (docs/parametros.md, seção 2.3).
  const formatos = useMemo(() => {
    const nomes = new Set<string>();
    for (const loja of lojas) {
      const formato = loja.formato.trim();
      if (formato) nomes.add(formato);
    }
    return Array.from(nomes).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [lojas]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-zinc-900">Parâmetros</h1>
        <p className="text-sm text-zinc-500">Cadastro de Lojas e Departamentos, e configuração de colunas por relatório.</p>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-zinc-200">
        {ABAS.map((item) => (
          <button
            key={item.valor}
            onClick={() => setAba(item.valor)}
            className={[
              "rounded-t-md px-4 py-2 text-sm font-medium transition-colors",
              aba === item.valor ? "bg-azul text-white" : "text-zinc-600 hover:bg-zinc-100",
            ].join(" ")}
          >
            {item.label}
          </button>
        ))}
      </div>

      {aba === "lojas" && <LojasTable lojas={lojas} onChange={setLojas} />}
      {aba === "departamentos" && (
        <DepartamentosTable departamentos={departamentos} onChange={setDepartamentos} formatos={formatos} />
      )}
      {aba === "dicionario" && <DicionarioColunasTable colunas={dicionario} onChange={setDicionario} />}
      {aba === "colunas" && <RelatorioColunasPanel dicionario={dicionario} />}
    </div>
  );
}
