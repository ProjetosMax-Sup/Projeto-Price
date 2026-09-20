"use client";

import { quemDependeDe } from "@/lib/parametros/colunas-relatorio";
import type { ColunaNativa, ConfigRelatorio } from "@/lib/parametros/types";

export function NativasTab({
  dicionario,
  config,
  onChange,
}: {
  dicionario: ColunaNativa[];
  config: ConfigRelatorio;
  onChange: (config: ConfigRelatorio) => void;
}) {
  const selecionaveis = dicionario.filter((c) => !c.chaveAutomatica);

  function alternar(ref: string, marcado: boolean) {
    onChange({
      ...config,
      nativasVisiveis: marcado ? [...config.nativasVisiveis, ref] : config.nativasVisiveis.filter((r) => r !== ref),
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-zinc-500">
        Marcar/desmarcar só oculta/mostra no relatório — a coluna nunca deixa de existir nem de ser computada. Nunca
        exige confirmação. SKU, Código Unidade e Data ficam de fora (chaves automáticas de junção/período).
      </p>
      <div className="max-h-[65vh] overflow-auto rounded-lg border border-zinc-200">
        <table className="w-full border-collapse text-sm">
          <tbody>
            {selecionaveis.map((c, i) => {
              const usadaEm = quemDependeDe(c.ref, config);
              return (
                <tr key={c.ref} className={i % 2 === 1 ? "bg-zinc-50" : undefined}>
                  <td className="w-10 px-3 py-1.5">
                    <input
                      type="checkbox"
                      checked={config.nativasVisiveis.includes(c.ref)}
                      onChange={(e) => alternar(c.ref, e.target.checked)}
                      className="accent-azul"
                    />
                  </td>
                  <td className="px-3 py-1.5 text-zinc-700">{c.traducao}</td>
                  <td className="px-3 py-1.5 text-xs text-zinc-400">{c.movimento || "—"}</td>
                  <td className="px-3 py-1.5">
                    {usadaEm.length > 0 && (
                      <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] text-zinc-500">
                        usada em: {usadaEm.join(", ")}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
