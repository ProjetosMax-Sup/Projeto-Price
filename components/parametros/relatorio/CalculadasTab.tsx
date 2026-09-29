"use client";

import { useState } from "react";
import {
  calculadaQuebrada,
  erroDaCalculada,
  novoIdCalculada,
  quemDependeDe,
  refsDisponiveisParaTermo,
  rotuloDaColuna,
} from "@/lib/parametros/colunas-relatorio";
import type { ColunaCalculada, ColunaNativa, ConfigRelatorio, TermoFormula } from "@/lib/parametros/types";

const labelParaRef = (ref: string, dicionario: ColunaNativa[], config: ConfigRelatorio) =>
  rotuloDaColuna(ref, config, dicionario);

function resumoFormula(c: ColunaCalculada, dicionario: ColunaNativa[], config: ConfigRelatorio): string {
  const termo = (t: TermoFormula) => `${t.sinal} ${labelParaRef(t.colunaRef, dicionario, config)}`;
  const nome = (ref: string) => labelParaRef(ref, dicionario, config);
  switch (c.tipo) {
    case "soma":
      return c.termos.map(termo).join(" ");
    case "razao":
      return `(${c.numerador.map(termo).join(" ")}) / (${c.denominador.map(termo).join(" ")})`;
    case "valorDoPeriodo":
      return `${nome(c.coluna)} — período ${c.periodo === "comparacao" ? "de Comparação" : "Atual"}`;
    case "desvio":
      return `variação % de ${nome(c.coluna)} vs. Comparação`;
    case "difPP":
      return `${nome(c.coluna)}: Atual − Comparação (em p.p.)`;
  }
}

function ListaTermos({
  termos,
  opcoes,
  dicionario,
  config,
  onChange,
}: {
  termos: TermoFormula[];
  opcoes: string[];
  dicionario: ColunaNativa[];
  config: ConfigRelatorio;
  onChange: (termos: TermoFormula[]) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {termos.map((t, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <select
            value={t.sinal}
            onChange={(e) => onChange(termos.map((x, j) => (j === i ? { ...x, sinal: e.target.value as "+" | "-" } : x)))}
            className="w-14 rounded border border-zinc-300 px-1 py-1 text-sm"
          >
            <option value="+">+</option>
            <option value="-">−</option>
          </select>
          <select
            value={t.colunaRef}
            onChange={(e) => onChange(termos.map((x, j) => (j === i ? { ...x, colunaRef: e.target.value } : x)))}
            className="flex-1 rounded border border-zinc-300 px-2 py-1 text-sm"
          >
            <option value="" disabled>
              Selecione uma coluna...
            </option>
            {opcoes.map((ref) => (
              <option key={ref} value={ref}>
                {labelParaRef(ref, dicionario, config)}
              </option>
            ))}
          </select>
          <button
            onClick={() => onChange(termos.filter((_, j) => j !== i))}
            className="text-zinc-400 hover:text-vermelho"
            aria-label="Remover termo"
          >
            ✕
          </button>
        </div>
      ))}
      <button
        onClick={() => onChange([...termos, { sinal: "+", colunaRef: opcoes[0] ?? "" }])}
        disabled={opcoes.length === 0}
        className="self-start text-xs font-medium text-azul hover:underline disabled:opacity-50"
      >
        + Termo
      </button>
    </div>
  );
}

export function CalculadasTab({
  dicionario,
  config,
  onChange,
}: {
  dicionario: ColunaNativa[];
  config: ConfigRelatorio;
  onChange: (config: ConfigRelatorio) => void;
}) {
  const [editando, setEditando] = useState<ColunaCalculada | null>(null);
  const [erroEditor, setErroEditor] = useState<string | null>(null);

  // Numa soma, o dropdown nem chega a oferecer razão (percentual) como termo — o erro
  // não acontece porque a opção não existe, em vez de acontecer e ser barrado depois.
  const opcoes = refsDisponiveisParaTermo(config, dicionario, editando?.id, editando?.tipo ?? "razao");

  function novaColuna(tipo: ColunaCalculada["tipo"]) {
    setErroEditor(null);
    const base = { id: novoIdCalculada(), nome: "", oculta: false };
    setEditando(
      tipo === "soma"
        ? { ...base, tipo: "soma", termos: [] }
        : tipo === "razao"
          ? { ...base, tipo: "razao", numerador: [], denominador: [] }
          : tipo === "valorDoPeriodo"
            ? { ...base, tipo: "valorDoPeriodo", coluna: opcoes[0] ?? "", periodo: "comparacao" }
            : tipo === "desvio"
              ? { ...base, tipo: "desvio", coluna: opcoes[0] ?? "" }
              : { ...base, tipo: "difPP", coluna: opcoes[0] ?? "" },
    );
  }

  function salvarEdicao() {
    if (!editando) return;
    // Mesma função que a rota de API usa — tela e servidor nunca divergem.
    const erro = erroDaCalculada(editando, config);
    if (erro) return setErroEditor(erro);

    const existe = config.calculadas.some((c) => c.id === editando.id);
    onChange({
      ...config,
      calculadas: existe
        ? config.calculadas.map((c) => (c.id === editando.id ? editando : c))
        : [...config.calculadas, editando],
    });
    setEditando(null);
    setErroEditor(null);
  }

  function excluir(c: ColunaCalculada) {
    const dependentes = quemDependeDe(c.id, config);
    if (dependentes.length > 0) {
      const confirmar = confirm(
        `"${c.nome}" é usada em: ${dependentes.join(", ")}. Excluir mesmo assim? As colunas dependentes continuam existindo, mas ficam com um aviso de fórmula quebrada até serem corrigidas.`,
      );
      if (!confirmar) return;
    }
    onChange({ ...config, calculadas: config.calculadas.filter((x) => x.id !== c.id) });
  }

  function alternarOculta(c: ColunaCalculada) {
    onChange({ ...config, calculadas: config.calculadas.map((x) => (x.id === c.id ? { ...x, oculta: !x.oculta } : x)) });
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-zinc-500">
        Fórmulas específicas deste relatório — sempre por seleção estruturada (sinal + coluna), nunca texto livre. Um
        termo pode ser uma coluna nativa marcada em &quot;Nativas&quot; ou outra coluna calculada já criada aqui.
        <br />
        <span className="text-zinc-400">
          Percentuais (razão) não aparecem como opção dentro de uma soma: somar percentuais dá resultado errado no
          subtotal e no total. Manual completo em <code className="text-zinc-500">docs/manual-de-formulas.md</code>.
        </span>
      </p>

      <div className="overflow-x-auto rounded-lg border border-zinc-200">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-azul text-white">
              <th className="w-10 px-3 py-2" />
              <th className="w-48 px-3 py-2 text-left font-medium">Nome</th>
              <th className="px-3 py-2 text-left font-medium">Fórmula</th>
              <th className="px-3 py-2 text-left font-medium">Usada em</th>
              <th className="w-40 px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {config.calculadas.map((c, i) => {
              const quebrada = calculadaQuebrada(c, config);
              const usadaEm = quemDependeDe(c.id, config);
              return (
                <tr key={c.id} className={i % 2 === 1 ? "bg-zinc-50" : undefined}>
                  <td className="px-3 py-1.5">
                    <input type="checkbox" checked={!c.oculta} onChange={() => alternarOculta(c)} className="accent-azul" />
                  </td>
                  <td className="px-3 py-1.5 text-zinc-700">{c.nome}</td>
                  <td className="px-3 py-1.5 text-xs text-zinc-500">
                    {resumoFormula(c, dicionario, config)}
                    {quebrada && (
                      <span className="ml-2 rounded bg-vermelho/10 px-1.5 py-0.5 text-[11px] font-medium text-vermelho">
                        depende de coluna excluída
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-1.5">
                    {usadaEm.length > 0 && (
                      <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] text-zinc-500">
                        {usadaEm.join(", ")}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <button
                      onClick={() => {
                        setErroEditor(null);
                        setEditando(c);
                      }}
                      className="mr-3 text-xs font-medium text-azul hover:underline"
                    >
                      Editar
                    </button>
                    <button onClick={() => excluir(c)} className="text-xs font-medium text-vermelho hover:underline">
                      Excluir
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!editando && (
        <div className="flex flex-wrap gap-3">
          {(
            [
              ["soma", "+ Soma/Subtração"],
              ["razao", "+ Razão (%)"],
              ["valorDoPeriodo", "+ Valor de outro período"],
              ["desvio", "+ % Desvio"],
              ["difPP", "+ Diferença em p.p."],
            ] as const
          ).map(([tipo, rotulo]) => (
            <button
              key={tipo}
              onClick={() => novaColuna(tipo)}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
            >
              {rotulo}
            </button>
          ))}
        </div>
      )}

      {editando && (
        <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
          <input
            value={editando.nome}
            onChange={(e) => setEditando({ ...editando, nome: e.target.value })}
            placeholder="Nome da coluna (ex.: % Desvio (Valor))"
            className="w-80 rounded border border-zinc-300 px-2 py-1.5 text-sm"
          />

          {editando.tipo === "soma" && (
            <ListaTermos
              termos={editando.termos}
              opcoes={opcoes}
              dicionario={dicionario}
              config={config}
              onChange={(termos) => setEditando({ ...editando, termos })}
            />
          )}

          {editando.tipo === "razao" && (
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="flex-1">
                <p className="mb-1 text-xs font-medium text-zinc-500">Numerador</p>
                <ListaTermos
                  termos={editando.numerador}
                  opcoes={opcoes}
                  dicionario={dicionario}
                  config={config}
                  onChange={(numerador) => setEditando({ ...editando, numerador })}
                />
              </div>
              <div className="flex-1">
                <p className="mb-1 text-xs font-medium text-zinc-500">Denominador</p>
                <ListaTermos
                  termos={editando.denominador}
                  opcoes={opcoes}
                  dicionario={dicionario}
                  config={config}
                  onChange={(denominador) => setEditando({ ...editando, denominador })}
                />
              </div>
            </div>
          )}

          {(editando.tipo === "valorDoPeriodo" || editando.tipo === "desvio" || editando.tipo === "difPP") && (
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-zinc-500">Coluna de origem</span>
                <select
                  value={editando.coluna}
                  onChange={(e) => setEditando({ ...editando, coluna: e.target.value })}
                  className="w-72 rounded border border-zinc-300 px-2 py-1 text-sm"
                >
                  <option value="" disabled>
                    Selecione uma coluna...
                  </option>
                  {opcoes.map((ref) => (
                    <option key={ref} value={ref}>
                      {labelParaRef(ref, dicionario, config)}
                    </option>
                  ))}
                </select>
              </label>

              {editando.tipo === "valorDoPeriodo" && (
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-zinc-500">Período</span>
                  <select
                    value={editando.periodo}
                    onChange={(e) => setEditando({ ...editando, periodo: e.target.value as "atual" | "comparacao" })}
                    className="w-44 rounded border border-zinc-300 px-2 py-1 text-sm"
                  >
                    <option value="comparacao">Comparação</option>
                    <option value="atual">Atual</option>
                  </select>
                </label>
              )}

              <p className="text-xs text-zinc-400">
                {editando.tipo === "valorDoPeriodo"
                  ? "Mostra o valor dessa mesma coluna no período escolhido."
                  : editando.tipo === "desvio"
                    ? "Variação percentual entre o período Atual e o de Comparação."
                    : "Diferença em pontos percentuais — use com colunas que já são %."}
              </p>
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={salvarEdicao}
              className="rounded-md bg-azul px-4 py-1.5 text-sm font-medium text-white hover:bg-azul/90"
            >
              Salvar coluna
            </button>
            <button
              onClick={() => {
                setEditando(null);
                setErroEditor(null);
              }}
              className="text-sm text-zinc-500 hover:text-zinc-700"
            >
              Cancelar
            </button>
            {erroEditor && <span className="text-sm text-vermelho">{erroEditor}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
