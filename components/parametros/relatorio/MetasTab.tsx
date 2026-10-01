"use client";

import type { ConfigRelatorio, DepartamentoCadastro } from "@/lib/parametros/types";

/** Chave composta Departamento×Formato — mesmo formato usado em `ConfigRelatorio.metas`. */
function chaveMeta(dptoCodigo: string, formato: string): string {
  return `${dptoCodigo}|${formato}`;
}

/**
 * Cadastro de Metas (docs/parametros.md — decisão de 2026-09-30): grade
 * Departamento × Formato, um valor fixo por combinação (não varia por mês; fica
 * valendo até alguém editar de novo). Usada hoje pelo "Meta - Realizado" do
 * Compra e Venda, mas não é exclusiva dele — qualquer relatório que precise de
 * um alvo cadastrado à mão pode ler daqui pelo mesmo ref sintético `"Meta"`.
 */
export function MetasTab({
  departamentos,
  formatos,
  config,
  onChange,
}: {
  departamentos: DepartamentoCadastro[];
  formatos: string[];
  config: ConfigRelatorio;
  onChange: (config: ConfigRelatorio) => void;
}) {
  const metas = config.metas ?? {};

  function definirMeta(dptoCodigo: string, formato: string, valor: string) {
    const chave = chaveMeta(dptoCodigo, formato);
    const numero = valor.trim() === "" ? undefined : Number(valor.replace(",", "."));
    const proximo = { ...metas };
    if (numero === undefined || Number.isNaN(numero)) delete proximo[chave];
    else proximo[chave] = numero;
    onChange({ ...config, metas: proximo });
  }

  if (departamentos.length === 0 || formatos.length === 0) {
    return (
      <p className="text-sm text-zinc-400">
        Cadastre Lojas (pelo menos um Formato) e Departamentos antes de definir metas.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-zinc-500">
        Meta de % Compra/Venda por Departamento e Formato — valor fixo, fica valendo pra qualquer mês até ser editado
        aqui de novo. Em branco = sem meta cadastrada (a coluna &quot;Meta - Realizado&quot; fica vazia pra essa
        combinação).
      </p>

      <div className="overflow-x-auto rounded-lg border border-zinc-200">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-azul text-white">
              <th className="px-3 py-2 text-left font-medium">Departamento</th>
              {formatos.map((formato) => (
                <th key={formato} className="w-32 px-3 py-2 text-right font-medium">
                  {formato}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {departamentos.map((dpto, i) => (
              <tr key={dpto.codigo} className={i % 2 === 1 ? "bg-zinc-50" : undefined}>
                <td className="px-3 py-1.5 text-zinc-700">{dpto.nome}</td>
                {formatos.map((formato) => (
                  <td key={formato} className="px-3 py-1.5 text-right">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={metas[chaveMeta(dpto.codigo, formato)] ?? ""}
                      onChange={(e) => definirMeta(dpto.codigo, formato, e.target.value)}
                      placeholder="—"
                      className="w-20 rounded border border-zinc-300 px-2 py-1 text-right text-sm"
                    />
                    <span className="ml-1 text-xs text-zinc-400">%</span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
