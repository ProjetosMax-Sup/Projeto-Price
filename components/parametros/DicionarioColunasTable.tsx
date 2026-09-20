"use client";

import { useState } from "react";
import type { ColunaNativa } from "@/lib/parametros/types";

export function DicionarioColunasTable({
  colunas,
  onChange,
}: {
  colunas: ColunaNativa[];
  onChange: (colunas: ColunaNativa[]) => void;
}) {
  const [salvando, setSalvando] = useState(false);
  const [salvoEm, setSalvoEm] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  function atualizar(ref: string, patch: Partial<ColunaNativa>) {
    onChange(colunas.map((c) => (c.ref === ref ? { ...c, ...patch } : c)));
    setSalvoEm(null);
  }

  async function salvar() {
    setSalvando(true);
    setErro(null);
    try {
      const resposta = await fetch("/api/parametros/dicionario", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(colunas),
      });
      const corpo = await resposta.json();
      if (!resposta.ok) {
        setErro(corpo.erro ?? "Falha ao salvar.");
        return;
      }
      setSalvoEm(new Date().toLocaleTimeString("pt-BR"));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-zinc-500">
        Catálogo documental das {colunas.length} colunas do arquivo mensal — importado automaticamente do cabeçalho
        real. Só documenta; não decide o que aparece em relatório (isso é configurado em &quot;Colunas&quot;, por módulo).
      </p>
      <div className="max-h-[70vh] overflow-auto rounded-lg border border-zinc-200">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="sticky top-0 bg-azul text-white">
              <th className="w-12 px-3 py-2 text-left font-medium">Pos.</th>
              <th className="w-64 px-3 py-2 text-left font-medium">Nome no arquivo</th>
              <th className="w-44 px-3 py-2 text-left font-medium">Movimento</th>
              <th className="w-56 px-3 py-2 text-left font-medium">Tradução</th>
              <th className="w-32 px-3 py-2 text-left font-medium">Tipo</th>
            </tr>
          </thead>
          <tbody>
            {colunas.map((c, i) => (
              <tr key={c.ref} className={i % 2 === 1 ? "bg-zinc-50" : undefined}>
                <td className="px-3 py-1.5 text-zinc-400">{c.posicao}</td>
                <td className="px-3 py-1.5 text-zinc-700">
                  {c.nomeArquivo}
                  {c.chaveAutomatica && (
                    <span className="ml-2 rounded bg-zinc-200 px-1.5 py-0.5 text-[11px] font-medium text-zinc-600">
                      chave automática
                    </span>
                  )}
                </td>
                <td className="px-3 py-1.5">
                  <input
                    value={c.movimento}
                    onChange={(e) => atualizar(c.ref, { movimento: e.target.value })}
                    placeholder="ex.: Vendas, Compras..."
                    className="w-full rounded border border-zinc-300 px-2 py-1"
                  />
                </td>
                <td className="px-3 py-1.5">
                  <input
                    value={c.traducao}
                    onChange={(e) => atualizar(c.ref, { traducao: e.target.value })}
                    className="w-full rounded border border-zinc-300 px-2 py-1"
                  />
                </td>
                <td className="px-3 py-1.5">
                  <select
                    value={c.tipoDado}
                    onChange={(e) => atualizar(c.ref, { tipoDado: e.target.value as ColunaNativa["tipoDado"] })}
                    className="w-full rounded border border-zinc-300 px-2 py-1"
                  >
                    <option value="Texto">Texto</option>
                    <option value="Número">Número</option>
                    <option value="Data">Data</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={salvar}
          disabled={salvando}
          className="rounded-md bg-azul px-4 py-1.5 text-sm font-medium text-white hover:bg-azul/90 disabled:opacity-50"
        >
          {salvando ? "Salvando..." : "Salvar alterações"}
        </button>
        {salvoEm && <span className="text-sm text-verde">Salvo às {salvoEm}.</span>}
        {erro && <span className="text-sm text-vermelho">{erro}</span>}
      </div>
    </div>
  );
}
