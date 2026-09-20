"use client";

import { useState } from "react";
import {
  calculadaQuebrada,
  novoIdCalculada,
  quemDependeDe,
  refsDisponiveisParaTermo,
} from "@/lib/parametros/colunas-relatorio";
import type { ColunaCalculada, ColunaNativa, ConfigRelatorio, TermoFormula } from "@/lib/parametros/types";

function labelParaRef(ref: string, dicionario: ColunaNativa[], config: ConfigRelatorio): string {
  const nativa = dicionario.find((c) => c.ref === ref);
  if (nativa) return nativa.traducao;
  return config.calculadas.find((c) => c.id === ref)?.nome ?? ref;
}

function resumoFormula(c: ColunaCalculada, dicionario: ColunaNativa[], config: ConfigRelatorio): string {
  const termo = (t: TermoFormula) => `${t.sinal} ${labelParaRef(t.colunaRef, dicionario, config)}`;
  if (c.tipo === "soma") return c.termos.map(termo).join(" ");
  return `(${c.numerador.map(termo).join(" ")}) / (${c.denominador.map(termo).join(" ")})`;
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

  const opcoes = refsDisponiveisParaTermo(config, editando?.id);

  function novaColuna(tipo: "soma" | "razao") {
    setErroEditor(null);
    setEditando(
      tipo === "soma"
        ? { id: novoIdCalculada(), nome: "", tipo: "soma", termos: [], oculta: false }
        : { id: novoIdCalculada(), nome: "", tipo: "razao", numerador: [], denominador: [], oculta: false },
    );
  }

  function salvarEdicao() {
    if (!editando) return;
    if (!editando.nome.trim()) return setErroEditor("Nome da coluna obrigatório.");
    if (config.calculadas.some((c) => c.nome === editando.nome && c.id !== editando.id)) {
      return setErroEditor("Já existe uma coluna calculada com esse nome neste relatório.");
    }
    const semTermos =
      editando.tipo === "soma" ? editando.termos.length === 0 : editando.numerador.length === 0 || editando.denominador.length === 0;
    if (semTermos) return setErroEditor("Adicione ao menos 1 termo.");

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
        <div className="flex gap-3">
          <button
            onClick={() => novaColuna("soma")}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
          >
            + Soma/Subtração
          </button>
          <button
            onClick={() => novaColuna("razao")}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
          >
            + Razão (%)
          </button>
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

          {editando.tipo === "soma" ? (
            <ListaTermos
              termos={editando.termos}
              opcoes={opcoes}
              dicionario={dicionario}
              config={config}
              onChange={(termos) => setEditando({ ...editando, termos })}
            />
          ) : (
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
