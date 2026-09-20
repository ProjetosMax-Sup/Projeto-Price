"use client";

import { useState } from "react";
import type { DepartamentoCadastro } from "@/lib/parametros/types";

function compradorFaltando(dpto: DepartamentoCadastro, formatos: string[]): boolean {
  if (dpto.mesmoCompradorTodosFormatos) return !dpto.comprador.trim();
  return formatos.some((formato) => !dpto.compradorPorFormato[formato]?.trim());
}

export function DepartamentosTable({
  departamentos,
  onChange,
  formatos,
}: {
  departamentos: DepartamentoCadastro[];
  onChange: (departamentos: DepartamentoCadastro[]) => void;
  formatos: string[];
}) {
  const [salvando, setSalvando] = useState(false);
  const [erros, setErros] = useState<string[]>([]);
  const [salvoEm, setSalvoEm] = useState<string | null>(null);

  function atualizar(index: number, patch: Partial<DepartamentoCadastro>) {
    onChange(departamentos.map((dpto, i) => (i === index ? { ...dpto, ...patch } : dpto)));
    setSalvoEm(null);
  }

  function alternarMesmoComprador(index: number, marcado: boolean) {
    const dpto = departamentos[index];
    if (marcado) {
      // Volta pra comprador único: usa como ponto de partida o valor já preenchido em algum formato.
      const primeiroPreenchido = formatos.map((f) => dpto.compradorPorFormato[f]).find((v) => v?.trim());
      atualizar(index, { mesmoCompradorTodosFormatos: true, comprador: dpto.comprador || primeiroPreenchido || "" });
    } else {
      // Abre um campo por formato: usa o comprador único já preenchido como ponto de partida em todos.
      const compradorPorFormato = { ...dpto.compradorPorFormato };
      for (const formato of formatos) {
        if (!compradorPorFormato[formato]) compradorPorFormato[formato] = dpto.comprador;
      }
      atualizar(index, { mesmoCompradorTodosFormatos: false, compradorPorFormato });
    }
  }

  function adicionar() {
    onChange([
      ...departamentos,
      { codigo: "", nome: "", mesmoCompradorTodosFormatos: true, comprador: "", compradorPorFormato: {} },
    ]);
    setSalvoEm(null);
  }

  function remover(index: number) {
    const dpto = departamentos[index];
    if (!confirm(`Remover o departamento "${dpto.nome || dpto.codigo || "sem nome"}"?`)) return;
    onChange(departamentos.filter((_, i) => i !== index));
    setSalvoEm(null);
  }

  async function salvar() {
    setSalvando(true);
    setErros([]);
    try {
      const resposta = await fetch("/api/parametros/departamentos", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ departamentos, formatos }),
      });
      const corpo = await resposta.json();
      if (!resposta.ok) {
        setErros(corpo.erros ?? ["Falha ao salvar."]);
        return;
      }
      setSalvoEm(new Date().toLocaleTimeString("pt-BR"));
    } finally {
      setSalvando(false);
    }
  }

  const temPendencia = departamentos.some((dpto) => compradorFaltando(dpto, formatos));

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-lg border border-zinc-200">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-azul text-white">
              <th className="w-28 px-3 py-2 text-left font-medium">Código</th>
              <th className="px-3 py-2 text-left font-medium">Nome</th>
              <th className="w-56 px-3 py-2 text-left font-medium">Mesmo comprador (todos os formatos)</th>
              <th className="px-3 py-2 text-left font-medium">Comprador</th>
              <th className="w-12 px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {departamentos.map((dpto, index) => (
              <tr key={index} className={index % 2 === 1 ? "bg-zinc-50" : undefined}>
                <td className="px-3 py-1.5 align-top">
                  <input
                    value={dpto.codigo}
                    onChange={(e) => atualizar(index, { codigo: e.target.value })}
                    className="w-full rounded border border-zinc-300 px-2 py-1"
                  />
                </td>
                <td className="px-3 py-1.5 align-top">
                  <input
                    value={dpto.nome}
                    onChange={(e) => atualizar(index, { nome: e.target.value })}
                    className="w-full rounded border border-zinc-300 px-2 py-1"
                  />
                </td>
                <td className="px-3 py-1.5 align-top">
                  <input
                    type="checkbox"
                    checked={dpto.mesmoCompradorTodosFormatos}
                    onChange={(e) => alternarMesmoComprador(index, e.target.checked)}
                    className="h-4 w-4"
                  />
                </td>
                <td className="px-3 py-1.5 align-top">
                  {dpto.mesmoCompradorTodosFormatos ? (
                    <input
                      value={dpto.comprador}
                      onChange={(e) => atualizar(index, { comprador: e.target.value })}
                      className={[
                        "w-full rounded border px-2 py-1",
                        !dpto.comprador.trim() ? "border-vermelho bg-vermelho/5" : "border-zinc-300",
                      ].join(" ")}
                      placeholder="Comprador"
                    />
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {formatos.length === 0 && (
                        <span className="text-xs text-zinc-400">Cadastre um formato em Lojas primeiro.</span>
                      )}
                      {formatos.map((formato) => {
                        const valor = dpto.compradorPorFormato[formato] ?? "";
                        return (
                          <label key={formato} className="flex items-center gap-1.5 text-xs text-zinc-500">
                            {formato}
                            <input
                              value={valor}
                              onChange={(e) =>
                                atualizar(index, {
                                  compradorPorFormato: { ...dpto.compradorPorFormato, [formato]: e.target.value },
                                })
                              }
                              className={[
                                "w-28 rounded border px-2 py-1 text-sm text-zinc-900",
                                !valor.trim() ? "border-vermelho bg-vermelho/5" : "border-zinc-300",
                              ].join(" ")}
                            />
                          </label>
                        );
                      })}
                    </div>
                  )}
                </td>
                <td className="px-3 py-1.5 text-center align-top">
                  <button
                    onClick={() => remover(index)}
                    aria-label="Remover departamento"
                    className="text-zinc-400 hover:text-vermelho"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={adicionar}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
        >
          + Adicionar departamento
        </button>
        <button
          onClick={salvar}
          disabled={salvando || temPendencia}
          title={temPendencia ? "Preencha o(s) comprador(es) obrigatório(s) antes de salvar." : undefined}
          className="rounded-md bg-azul px-4 py-1.5 text-sm font-medium text-white hover:bg-azul/90 disabled:opacity-50"
        >
          {salvando ? "Salvando..." : "Salvar alterações"}
        </button>
        {salvoEm && <span className="text-sm text-verde">Salvo às {salvoEm}.</span>}
        {temPendencia && (
          <span className="rounded bg-vermelho/10 px-2 py-1 text-xs font-medium text-vermelho">
            Sem comprador preenchido em algum departamento
          </span>
        )}
      </div>

      {erros.length > 0 && (
        <ul className="rounded-md bg-vermelho/10 px-3 py-2 text-sm text-vermelho">
          {erros.map((erro) => (
            <li key={erro}>{erro}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
