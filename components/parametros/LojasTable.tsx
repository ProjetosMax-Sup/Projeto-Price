"use client";

import { useState } from "react";
import type { LojaCadastro } from "@/lib/parametros/types";

export function LojasTable({
  lojas,
  onChange,
}: {
  lojas: LojaCadastro[];
  onChange: (lojas: LojaCadastro[]) => void;
}) {
  const [salvando, setSalvando] = useState(false);
  const [erros, setErros] = useState<string[]>([]);
  const [salvoEm, setSalvoEm] = useState<string | null>(null);

  const formatosSugeridos = Array.from(new Set(lojas.map((l) => l.formato).filter(Boolean)));

  function atualizar(index: number, campo: keyof LojaCadastro, valor: string) {
    onChange(lojas.map((loja, i) => (i === index ? { ...loja, [campo]: valor } : loja)));
    setSalvoEm(null);
  }

  function adicionar() {
    onChange([...lojas, { codigo: "", nomeCustomizado: "", formato: "" }]);
    setSalvoEm(null);
  }

  function remover(index: number) {
    const loja = lojas[index];
    if (!confirm(`Remover a loja "${loja.nomeCustomizado || loja.codigo || "sem nome"}"?`)) return;
    onChange(lojas.filter((_, i) => i !== index));
    setSalvoEm(null);
  }

  async function salvar() {
    setSalvando(true);
    setErros([]);
    try {
      const resposta = await fetch("/api/parametros/lojas", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(lojas),
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

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-lg border border-zinc-200">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-azul text-white">
              <th className="w-32 px-3 py-2 text-left font-medium">Código</th>
              <th className="px-3 py-2 text-left font-medium">Nome Customizado</th>
              <th className="w-48 px-3 py-2 text-left font-medium">Formato</th>
              <th className="w-12 px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {lojas.map((loja, index) => (
              <tr key={index} className={index % 2 === 1 ? "bg-zinc-50" : undefined}>
                <td className="px-3 py-1.5">
                  <input
                    value={loja.codigo}
                    onChange={(e) => atualizar(index, "codigo", e.target.value)}
                    className="w-full rounded border border-zinc-300 px-2 py-1"
                  />
                </td>
                <td className="px-3 py-1.5">
                  <input
                    value={loja.nomeCustomizado}
                    onChange={(e) => atualizar(index, "nomeCustomizado", e.target.value)}
                    className="w-full rounded border border-zinc-300 px-2 py-1"
                  />
                </td>
                <td className="px-3 py-1.5">
                  <input
                    value={loja.formato}
                    onChange={(e) => atualizar(index, "formato", e.target.value)}
                    list="formatos-sugeridos"
                    className="w-full rounded border border-zinc-300 px-2 py-1"
                  />
                </td>
                <td className="px-3 py-1.5 text-center">
                  <button
                    onClick={() => remover(index)}
                    aria-label="Remover loja"
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
      <datalist id="formatos-sugeridos">
        {formatosSugeridos.map((formato) => (
          <option key={formato} value={formato} />
        ))}
      </datalist>

      <div className="flex items-center gap-3">
        <button
          onClick={adicionar}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
        >
          + Adicionar loja
        </button>
        <button
          onClick={salvar}
          disabled={salvando}
          className="rounded-md bg-azul px-4 py-1.5 text-sm font-medium text-white hover:bg-azul/90 disabled:opacity-50"
        >
          {salvando ? "Salvando..." : "Salvar alterações"}
        </button>
        {salvoEm && <span className="text-sm text-verde">Salvo às {salvoEm}.</span>}
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
