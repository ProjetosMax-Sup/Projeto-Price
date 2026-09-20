"use client";

import { useMemo, useState } from "react";
import { DepartamentosTable } from "@/components/parametros/DepartamentosTable";
import { LojasTable } from "@/components/parametros/LojasTable";
import { UsuariosTable } from "@/components/parametros/UsuariosTable";
import type { DepartamentoCadastro, LojaCadastro, UsuarioCadastro } from "@/lib/parametros/types";

const ABAS = [
  { valor: "lojas", label: "Lojas" },
  { valor: "departamentos", label: "Departamentos" },
  { valor: "usuarios", label: "Usuários" },
] as const;

export function ParametrosDashboard({
  lojasIniciais,
  departamentosIniciais,
  usuariosIniciais,
  statusContasIniciais,
}: {
  lojasIniciais: LojaCadastro[];
  departamentosIniciais: DepartamentoCadastro[];
  usuariosIniciais: UsuarioCadastro[];
  statusContasIniciais: Record<string, boolean>;
}) {
  const [aba, setAba] = useState<(typeof ABAS)[number]["valor"]>("lojas");
  const [lojas, setLojas] = useState<LojaCadastro[]>(lojasIniciais);
  const [departamentos, setDepartamentos] = useState<DepartamentoCadastro[]>(departamentosIniciais);
  const [usuarios, setUsuarios] = useState<UsuarioCadastro[]>(usuariosIniciais);

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

  // Opções pros MultiSelect de Departamentos/Lojas em Usuários — mesma ideia, dependem do estado
  // ao vivo das outras duas abas (seção 2.4: acesso é direto por código, nunca por nome de comprador).
  const departamentosOpcoes = useMemo(
    () =>
      departamentos
        .filter((d) => d.codigo.trim())
        .map((d) => ({ value: d.codigo, label: `${d.codigo} - ${d.nome || "(sem nome)"}` })),
    [departamentos],
  );
  const lojasOpcoes = useMemo(
    () =>
      lojas
        .filter((l) => l.codigo.trim())
        .map((l) => ({ value: l.codigo, label: `${l.codigo} - ${l.nomeCustomizado || "(sem nome)"}` })),
    [lojas],
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-zinc-900">Parâmetros</h1>
        <p className="text-sm text-zinc-500">
          Cadastro de Lojas, Departamentos e Usuários — base compartilhada pelos módulos.
        </p>
      </div>

      <div className="flex gap-1 border-b border-zinc-200">
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
      {aba === "usuarios" && (
        <UsuariosTable
          usuarios={usuarios}
          onChange={setUsuarios}
          departamentosOpcoes={departamentosOpcoes}
          lojasOpcoes={lojasOpcoes}
          statusContasIniciais={statusContasIniciais}
        />
      )}
    </div>
  );
}
