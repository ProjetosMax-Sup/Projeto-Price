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

  function renomear(ref: string, rotulo: string) {
    const rotulos = { ...config.rotulos };
    // Campo vazio = volta a usar o nome do Dicionário, em vez de gravar "".
    if (rotulo.trim()) rotulos[ref] = rotulo;
    else delete rotulos[ref];
    onChange({ ...config, rotulos });
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-zinc-500">
        Marcar/desmarcar só oculta/mostra no relatório — a coluna nunca deixa de existir nem de ser computada, e pode
        alimentar uma fórmula mesmo desmarcada. Nunca exige confirmação. SKU, Código Unidade e Data ficam de fora
        (chaves automáticas de junção/período).
        <br />
        <span className="text-zinc-400">
          O <strong>nome neste relatório</strong> vale só aqui: a mesma coluna pode ser &quot;R$ Valor Total Atual&quot;
          no Desempenho Comercial e &quot;Vendas&quot; no Entradas e Saídas. Em branco, usa o nome do Dicionário (que é
          como o ERP chama a coluna).
        </span>
      </p>
      <div className="max-h-[65vh] overflow-auto rounded-lg border border-zinc-200">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 bg-azul text-[13px] font-medium tracking-wide text-white/80 uppercase">
            <tr>
              <th className="w-10 px-3 py-2" />
              <th className="px-3 py-2 text-left font-medium">Coluna no arquivo</th>
              <th className="px-3 py-2 text-left font-medium">Nome neste relatório</th>
              <th className="px-3 py-2 text-left font-medium">Movimento</th>
              <th className="px-3 py-2 text-left font-medium">Usada em</th>
            </tr>
          </thead>
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
                  <td className="px-3 py-1.5">
                    <input
                      value={config.rotulos?.[c.ref] ?? ""}
                      onChange={(e) => renomear(c.ref, e.target.value)}
                      placeholder={c.traducao}
                      className="w-56 rounded border border-zinc-200 px-2 py-1 text-sm placeholder:text-zinc-300 focus:border-azul focus:outline-none"
                    />
                  </td>
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
