"use client";

import { useState } from "react";
import { ordemAtivasEfetiva } from "@/lib/parametros/colunas-relatorio";
import type { ColunaNativa, ConfigRelatorio } from "@/lib/parametros/types";

function labelParaRef(ref: string, dicionario: ColunaNativa[], config: ConfigRelatorio): string {
  const nativa = dicionario.find((c) => c.ref === ref);
  if (nativa) return nativa.traducao;
  return config.calculadas.find((c) => c.id === ref)?.nome ?? ref;
}

export function AtivasTab({
  dicionario,
  config,
  onChange,
}: {
  dicionario: ColunaNativa[];
  config: ConfigRelatorio;
  onChange: (config: ConfigRelatorio) => void;
}) {
  const ordem = ordemAtivasEfetiva(config);
  const [arrastando, setArrastando] = useState<string | null>(null);

  function reordenar(refOrigem: string, refDestino: string) {
    if (refOrigem === refDestino) return;
    const sem = ordem.filter((r) => r !== refOrigem);
    const indice = sem.indexOf(refDestino);
    sem.splice(indice, 0, refOrigem);
    onChange({ ...config, ordemAtivas: sem });
  }

  function ocultar(ref: string) {
    if (ref.startsWith("calc_")) {
      onChange({ ...config, calculadas: config.calculadas.map((c) => (c.id === ref ? { ...c, oculta: true } : c)) });
    } else {
      onChange({ ...config, nativasVisiveis: config.nativasVisiveis.filter((r) => r !== ref) });
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-zinc-500">
        Ordem final de exibição do relatório (e da exportação Excel/PDF) — arraste pra reordenar. Junta
        automaticamente tudo que está marcado como visível em Nativas e Calculadas.
      </p>
      {ordem.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-400">
          Nenhuma coluna visível ainda — marque colunas nas abas Nativas ou Calculadas.
        </p>
      ) : (
        <ul className="rounded-lg border border-zinc-200">
          {ordem.map((ref, i) => (
            <li
              key={ref}
              draggable
              onDragStart={() => setArrastando(ref)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (arrastando) reordenar(arrastando, ref);
                setArrastando(null);
              }}
              className={[
                "flex cursor-grab items-center justify-between gap-3 px-3 py-2 text-sm active:cursor-grabbing",
                i % 2 === 1 ? "bg-zinc-50" : undefined,
                arrastando === ref ? "opacity-40" : undefined,
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <span className="flex items-center gap-2 text-zinc-700">
                <span className="text-zinc-300">⠿</span>
                {labelParaRef(ref, dicionario, config)}
                {ref.startsWith("calc_") && (
                  <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] text-zinc-500">calculada</span>
                )}
              </span>
              <button onClick={() => ocultar(ref)} className="text-xs font-medium text-zinc-400 hover:text-vermelho">
                ocultar
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
