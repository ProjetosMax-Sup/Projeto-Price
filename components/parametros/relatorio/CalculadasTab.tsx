"use client";

import { useRef, useState } from "react";
import {
  calculadaQuebrada,
  erroDaCalculada,
  novoIdCalculada,
  quemDependeDe,
  refsDisponiveisParaTermo,
  rotuloDaColuna,
} from "@/lib/parametros/colunas-relatorio";
import type { ColunaCalculada, ColunaNativa, ConfigRelatorio, FormatoColuna, TermoFormula } from "@/lib/parametros/types";

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
    case "diferenca":
      return `${nome(c.colunaA)} − ${nome(c.colunaB)}${c.heatmap ? ` · mapa de calor${c.heatmapInvertido ? " (invertido)" : ""}` : ""}`;
    case "formula":
      return c.expressao;
  }
}

const ROTULO_FORMATO: Record<FormatoColuna, string> = {
  moeda: "Contábil (R$)",
  numero: "Volume (sem símbolo)",
  percentual: "%",
  pontosPercentuais: "Pontos Percentuais",
};

/** Seletor de formato de saída + casas decimais — comum a todos os tipos de calculada. */
function SeletorFormato({
  formato,
  casasDecimais,
  formatosDisponiveis,
  onChange,
}: {
  formato: FormatoColuna | undefined;
  casasDecimais: number | undefined;
  formatosDisponiveis: FormatoColuna[];
  onChange: (formato: FormatoColuna | undefined, casasDecimais: number | undefined) => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-zinc-500">Formato de saída</span>
        <select
          value={formato ?? ""}
          onChange={(e) => onChange((e.target.value || undefined) as FormatoColuna | undefined, casasDecimais)}
          className="w-48 rounded border border-zinc-300 px-2 py-1 text-sm"
        >
          <option value="">Padrão do tipo</option>
          {formatosDisponiveis.map((f) => (
            <option key={f} value={f}>
              {ROTULO_FORMATO[f]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-zinc-500">Casas decimais</span>
        <input
          type="number"
          min={0}
          max={4}
          value={casasDecimais ?? ""}
          onChange={(e) => onChange(formato, e.target.value === "" ? undefined : Number(e.target.value))}
          placeholder="Padrão"
          className="w-24 rounded border border-zinc-300 px-2 py-1 text-sm"
        />
      </label>
    </div>
  );
}

const FORMATOS_PADRAO: FormatoColuna[] = ["moeda", "numero", "percentual", "pontosPercentuais"];

/** Mapa de calor (vermelho → verde pelo valor) — comum a "formula" e ao legado "diferenca". */
function ControlesHeatmap({
  heatmap,
  heatmapInvertido,
  onChange,
}: {
  heatmap: boolean | undefined;
  heatmapInvertido: boolean | undefined;
  onChange: (heatmap: boolean, heatmapInvertido: boolean) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="flex items-center gap-1.5 text-sm text-zinc-600">
        <input
          type="checkbox"
          checked={heatmap ?? false}
          onChange={(e) => onChange(e.target.checked, e.target.checked ? (heatmapInvertido ?? false) : false)}
          className="accent-azul"
        />
        Mapa de calor (vermelho → verde pelo valor)
      </label>
      {heatmap && (
        <label className="flex items-center gap-1.5 text-sm text-zinc-600">
          <input
            type="checkbox"
            checked={heatmapInvertido ?? false}
            onChange={(e) => onChange(true, e.target.checked)}
            className="accent-azul"
          />
          Inverter (verde → vermelho pelo valor)
        </label>
      )}
      {heatmap && (
        <p className="w-full text-xs text-zinc-400">
          {heatmapInvertido
            ? "Invertido: valor negativo fica verde, positivo fica vermelho (use quando ficar abaixo é o bom, ex.: Custo − Meta)."
            : "Padrão: valor positivo fica verde, negativo fica vermelho."}
        </p>
      )}
    </div>
  );
}

/** Glossário clicável + legenda de operadores, lado a lado com o campo de fórmula. */
function EditorFormula({
  expressao,
  opcoes,
  dicionario,
  config,
  onChange,
}: {
  expressao: string;
  opcoes: string[];
  dicionario: ColunaNativa[];
  config: ConfigRelatorio;
  onChange: (expressao: string) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function inserirNoCursor(texto: string) {
    const el = textareaRef.current;
    if (!el) {
      onChange(expressao + texto);
      return;
    }
    const inicio = el.selectionStart ?? expressao.length;
    const fim = el.selectionEnd ?? expressao.length;
    const novoValor = expressao.slice(0, inicio) + texto + expressao.slice(fim);
    onChange(novoValor);
    requestAnimationFrame(() => {
      el.focus();
      const posicao = inicio + texto.length;
      el.setSelectionRange(posicao, posicao);
    });
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <div className="flex-1">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-500">Fórmula</span>
          <textarea
            ref={textareaRef}
            value={expressao}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Ex.: [Compras] - [Meta] / 100 * [Valor]"
            rows={3}
            className="w-full rounded border border-zinc-300 px-2 py-1.5 font-mono text-sm"
          />
        </label>
        <div className="mt-1.5 flex flex-wrap gap-2 text-xs text-zinc-400">
          <span className="font-medium text-zinc-500">Operadores:</span>
          <span className="rounded bg-zinc-100 px-1.5 py-0.5">+ soma</span>
          <span className="rounded bg-zinc-100 px-1.5 py-0.5">− subtração</span>
          <span className="rounded bg-zinc-100 px-1.5 py-0.5">* multiplicação</span>
          <span className="rounded bg-zinc-100 px-1.5 py-0.5">/ divisão</span>
          <span className="rounded bg-zinc-100 px-1.5 py-0.5">( ) agrupamento</span>
          <span>— use [Nome da Coluna] pra referenciar uma coluna. Divisão por zero dá 0, nunca erro.</span>
        </div>
      </div>
      <div className="w-full shrink-0 sm:w-56">
        <p className="mb-1 text-xs font-medium text-zinc-500">Clique pra inserir na fórmula</p>
        <div className="max-h-40 overflow-y-auto rounded border border-zinc-200 bg-white">
          {opcoes.map((ref) => {
            // O que entra na fórmula é o NOME da calculada ou o ref bruto da nativa —
            // nunca a tradução/rótulo customizado, que pode mudar e quebraria a fórmula
            // (mesmo motivo de PapeisRelatorio: refs são estáveis, nomes de tela não).
            const calculada = config.calculadas.find((c) => c.id === ref);
            const token = calculada ? calculada.nome : ref;
            const label = labelParaRef(ref, dicionario, config);
            return (
              <button
                key={ref}
                type="button"
                onClick={() => inserirNoCursor(`[${token}]`)}
                className="block w-full px-2 py-1 text-left text-xs text-zinc-600 hover:bg-zinc-100"
                title={token !== label ? `Insere [${token}]` : undefined}
              >
                {label}
                {token !== label && <span className="text-zinc-400"> ({token})</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
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

  // Mesma função que a rota de API usa — roda a cada edição, não só no clique de Salvar,
  // pra nunca deixar salvar uma fórmula com erro (nome vazio, referência desconhecida,
  // fórmula se referenciando etc.).
  const erroAtual = editando ? erroDaCalculada(editando, config) : null;

  function novaColuna(tipo: ColunaCalculada["tipo"]) {
    setErroEditor(null);
    const base = { id: novoIdCalculada(), nome: "", oculta: false };
    setEditando(
      tipo === "formula"
        ? { ...base, tipo: "formula", expressao: "" }
        : tipo === "soma"
          ? { ...base, tipo: "soma", termos: [] }
          : tipo === "razao"
            ? { ...base, tipo: "razao", numerador: [], denominador: [] }
            : tipo === "valorDoPeriodo"
            ? { ...base, tipo: "valorDoPeriodo", coluna: opcoes[0] ?? "", periodo: "comparacao" }
            : tipo === "desvio"
              ? { ...base, tipo: "desvio", coluna: opcoes[0] ?? "" }
              : tipo === "difPP"
                ? { ...base, tipo: "difPP", coluna: opcoes[0] ?? "" }
                : {
                    ...base,
                    tipo: "diferenca",
                    colunaA: opcoes[0] ?? "",
                    colunaB: opcoes[0] ?? "",
                    heatmap: false,
                    heatmapInvertido: false,
                  },
    );
  }

  function salvarEdicao() {
    if (!editando) return;
    // Mesma função que a rota de API usa — tela e servidor nunca divergem.
    if (erroAtual) return setErroEditor(erroAtual);

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
        Fórmulas específicas deste relatório, no estilo Excel: escreva com <code>[Nome da Coluna]</code> e os
        operadores <code>+ − * /</code>. Uma referência pode ser uma coluna nativa marcada em
        &quot;Nativas&quot; ou outra coluna calculada já criada aqui — nunca dá pra referenciar algo que não existe,
        porque o Salvar fica bloqueado enquanto houver erro.
        <br />
        <span className="text-zinc-400">
          Manual completo em <code className="text-zinc-500">docs/manual-de-formulas.md</code>.
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
              ["formula", "+ Fórmula"],
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

          {editando.tipo === "formula" && (
            <>
              <EditorFormula
                expressao={editando.expressao}
                opcoes={opcoes}
                dicionario={dicionario}
                config={config}
                onChange={(expressao) => setEditando({ ...editando, expressao })}
              />
              <ControlesHeatmap
                heatmap={editando.heatmap}
                heatmapInvertido={editando.heatmapInvertido}
                onChange={(heatmap, heatmapInvertido) => setEditando({ ...editando, heatmap, heatmapInvertido })}
              />
            </>
          )}

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

          {editando.tipo === "diferenca" && (
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-zinc-500">Coluna A</span>
                <select
                  value={editando.colunaA}
                  onChange={(e) => setEditando({ ...editando, colunaA: e.target.value })}
                  className="w-64 rounded border border-zinc-300 px-2 py-1 text-sm"
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
              <span className="pb-1.5 text-sm text-zinc-400">−</span>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-zinc-500">Coluna B</span>
                <select
                  value={editando.colunaB}
                  onChange={(e) => setEditando({ ...editando, colunaB: e.target.value })}
                  className="w-64 rounded border border-zinc-300 px-2 py-1 text-sm"
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
              <p className="w-full text-xs text-zinc-400">
                Diferença dentro do mesmo período (não Atual × Comparação) — ex.: Meta − Realizado.
              </p>
              <ControlesHeatmap
                heatmap={editando.heatmap}
                heatmapInvertido={editando.heatmapInvertido}
                onChange={(heatmap, heatmapInvertido) => setEditando({ ...editando, heatmap, heatmapInvertido })}
              />
            </div>
          )}

          <SeletorFormato
            formato={editando.formato}
            casasDecimais={editando.casasDecimais}
            formatosDisponiveis={FORMATOS_PADRAO}
            onChange={(formato, casasDecimais) => setEditando({ ...editando, formato, casasDecimais })}
          />

          <div className="flex items-center gap-3">
            <button
              onClick={salvarEdicao}
              disabled={!!erroAtual}
              className="rounded-md bg-azul px-4 py-1.5 text-sm font-medium text-white hover:bg-azul/90 disabled:cursor-not-allowed disabled:opacity-40"
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
            {(erroAtual || erroEditor) && <span className="text-sm text-vermelho">{erroAtual ?? erroEditor}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
