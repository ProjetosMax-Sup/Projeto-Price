"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { IntervaloData } from "@/lib/desempenho/consulta";
import { anoMesDeIso, dataParaIso, diasNoMes, NOMES_MESES_COMPLETOS, periodoNoMes } from "@/lib/desempenho/datas";

const DIAS_SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];

interface AnoMes {
  ano: number;
  mes0: number; // 0-11
}

function proximoMes({ ano, mes0 }: AnoMes): AnoMes {
  return mes0 === 11 ? { ano: ano + 1, mes0: 0 } : { ano, mes0: mes0 + 1 };
}

function mesAnterior({ ano, mes0 }: AnoMes): AnoMes {
  return mes0 === 0 ? { ano: ano - 1, mes0: 11 } : { ano, mes0: mes0 - 1 };
}

function comparaAnoMes(a: AnoMes, b: AnoMes): number {
  return a.ano * 12 + a.mes0 - (b.ano * 12 + b.mes0);
}

/** Grade de um mês: `null` nas casas vazias antes do dia 1 (pra alinhar as colunas de dia da semana). */
function gradeDoMes({ ano, mes0 }: AnoMes): (string | null)[] {
  const primeiroDiaSemana = new Date(ano, mes0, 1).getDay();
  const total = diasNoMes(mes0 + 1, ano);
  const celulas: (string | null)[] = Array(primeiroDiaSemana).fill(null);
  for (let dia = 1; dia <= total; dia++) {
    celulas.push(dataParaIso(new Date(ano, mes0, dia)));
  }
  return celulas;
}

function Mes({
  anoMes,
  datasValidas,
  valor,
  rascunho,
  hoverIso,
  onHover,
  onClickDia,
}: {
  anoMes: AnoMes;
  datasValidas: Set<string>;
  valor: IntervaloData | null;
  rascunho: { inicio: string | null; fim: string | null };
  hoverIso: string | null;
  onHover: (iso: string | null) => void;
  onClickDia: (iso: string) => void;
}) {
  const celulas = useMemo(() => gradeDoMes(anoMes), [anoMes]);

  // Range efetivo pra pintar: o já commitado (valor), ou a prévia em construção (rascunho + hover).
  let inicioEfetivo = valor?.inicio ?? rascunho.inicio ?? null;
  let fimEfetivo = valor?.fim ?? rascunho.fim ?? (rascunho.inicio ? hoverIso : null);
  if (inicioEfetivo && fimEfetivo && fimEfetivo < inicioEfetivo) {
    [inicioEfetivo, fimEfetivo] = [fimEfetivo, inicioEfetivo];
  }

  return (
    <div className="w-64">
      <p className="mb-2 text-center text-sm font-semibold text-zinc-800">
        {NOMES_MESES_COMPLETOS[anoMes.mes0]} {anoMes.ano}
      </p>
      <div className="grid grid-cols-7 gap-y-1 text-center text-[11px] text-zinc-400">
        {DIAS_SEMANA.map((d, i) => (
          <div key={i}>{d}</div>
        ))}
        {celulas.map((iso, i) => {
          if (!iso) return <div key={`vazio-${i}`} />;
          const disponivel = datasValidas.has(iso);
          const ehInicio = iso === inicioEfetivo;
          const ehFim = iso === fimEfetivo;
          const ehEndpoint = ehInicio || ehFim;
          const noIntervalo = !!inicioEfetivo && !!fimEfetivo && iso > inicioEfetivo && iso < fimEfetivo;
          const dia = Number(iso.slice(8, 10));

          return (
            <div
              key={iso}
              className={[
                "relative h-8",
                noIntervalo || (ehInicio && fimEfetivo) ? "bg-azul/10" : "",
                ehInicio && fimEfetivo ? "rounded-l-full" : "",
                ehFim && inicioEfetivo ? "rounded-r-full bg-azul/10" : "",
              ].join(" ")}
            >
              <button
                type="button"
                disabled={!disponivel}
                onMouseEnter={() => onHover(iso)}
                onClick={() => onClickDia(iso)}
                className={[
                  "flex h-8 w-8 items-center justify-center rounded-full text-sm transition-colors",
                  !disponivel ? "cursor-not-allowed text-zinc-300" : "cursor-pointer hover:bg-azul/20",
                  ehEndpoint ? "bg-azul font-semibold text-white hover:bg-azul" : disponivel ? "text-zinc-700" : "",
                ].join(" ")}
              >
                {dia}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Dropdown com os 12 meses de um ano fixo — usado pelos atalhos "mesmo período, mês" (mesmo
 * ano do período de referência) e "...ano anterior" (ano do período de referência − 1). */
function SeletorMesRapido({ rotulo, ano, onEscolher }: { rotulo: string; ano: number; onEscolher: (mes0: number) => void }) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    function aoClicarFora(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener("mousedown", aoClicarFora);
    return () => document.removeEventListener("mousedown", aoClicarFora);
  }, [aberto]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs text-zinc-600 hover:bg-zinc-50"
      >
        {rotulo} ({ano}) ▾
      </button>
      {aberto && (
        <div className="absolute left-0 top-full z-40 mt-1 max-h-56 w-36 overflow-auto rounded-md border border-zinc-200 bg-white py-1 shadow-lg">
          {NOMES_MESES_COMPLETOS.map((nome, mes0) => (
            <button
              key={nome}
              type="button"
              onClick={() => {
                onEscolher(mes0);
                setAberto(false);
              }}
              className="block w-full px-3 py-1 text-left text-sm text-zinc-700 hover:bg-zinc-50"
            >
              {nome}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Seletor de período em calendário (dois meses lado a lado, clique início → clique fim, faixa
 * conectada entre os dois) — substitui a digitação Dia/Mês/Ano: como só dá pra clicar em dias
 * reais do calendário, não existe mais "data inválida" pra validar. Dias sem dado no arquivo
 * (`datasDisponiveis`) ficam desabilitados (cinza, sem clique).
 */
export function CalendarioIntervalo({
  rotulo,
  valor,
  onChange,
  valorPadrao,
  datasDisponiveis,
  labelAuto,
  valorReferencia,
}: {
  rotulo: string;
  valor: IntervaloData | null;
  onChange: (v: IntervaloData | null) => void;
  /** Mês mais recente com dado (ou o mês anterior a ele, pra Comparação) — pra onde "Limpar
   * seleção" volta. Nunca há mais um estado "sem período" enquanto houver dado no arquivo. */
  valorPadrao: IntervaloData | null;
  datasDisponiveis: string[];
  labelAuto: string | null;
  /** Período Atual já selecionado — habilita os seletores rápidos "mesmo período, mês/ano anterior". */
  valorReferencia?: IntervaloData | null;
}) {
  const [aberto, setAberto] = useState(false);
  const [rascunho, setRascunho] = useState<{ inicio: string | null; fim: string | null }>({ inicio: null, fim: null });
  const [hoverIso, setHoverIso] = useState<string | null>(null);
  const [mesEsquerdo, setMesEsquerdo] = useState<AnoMes>(() =>
    valor ? anoMesDeIso(valor.inicio) : datasDisponiveis.length > 0 ? anoMesDeIso(datasDisponiveis.at(-1)!) : { ano: new Date().getFullYear(), mes0: new Date().getMonth() },
  );
  const ref = useRef<HTMLDivElement>(null);

  const datasValidas = useMemo(() => new Set(datasDisponiveis), [datasDisponiveis]);
  const limiteMin = datasDisponiveis.length > 0 ? anoMesDeIso(datasDisponiveis[0]) : null;
  const limiteMax = datasDisponiveis.length > 0 ? anoMesDeIso(datasDisponiveis.at(-1)!) : null;
  const mesDireito = proximoMes(mesEsquerdo);

  useEffect(() => {
    function aoClicarFora(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setAberto(false);
        setRascunho({ inicio: null, fim: null });
      }
    }
    document.addEventListener("mousedown", aoClicarFora);
    return () => document.removeEventListener("mousedown", aoClicarFora);
  }, []);

  function aoAbrir() {
    setAberto((a) => !a);
    setRascunho({ inicio: null, fim: null });
    if (valor) setMesEsquerdo(anoMesDeIso(valor.inicio));
  }

  function aoClicarDia(iso: string) {
    if (!rascunho.inicio || rascunho.fim) {
      setRascunho({ inicio: iso, fim: null });
      return;
    }
    const intervalo: IntervaloData = iso >= rascunho.inicio ? { inicio: rascunho.inicio, fim: iso } : { inicio: iso, fim: rascunho.inicio };
    onChange(intervalo);
    setRascunho({ inicio: null, fim: null });
    setAberto(false);
  }

  function aoLimpar() {
    onChange(valorPadrao);
    setRascunho({ inicio: null, fim: null });
    setAberto(false);
  }

  function aplicarMesRapido(ano: number, mes0: number) {
    if (!valorReferencia) return;
    onChange(periodoNoMes(valorReferencia, ano, mes0));
    setAberto(false);
  }

  const anoReferencia = valorReferencia ? anoMesDeIso(valorReferencia.inicio).ano : null;
  const difereDoPadrao = !!valor && !!valorPadrao && (valor.inicio !== valorPadrao.inicio || valor.fim !== valorPadrao.fim);

  const podeVoltar = !limiteMin || comparaAnoMes(mesAnterior(mesEsquerdo), limiteMin) >= 0;
  const podeAvancar = !limiteMax || comparaAnoMes(proximoMes(mesDireito), limiteMax) <= 0;

  /** "DD/MM/AA" — sempre com ano, já que comparar o mesmo período em anos diferentes é um caso de uso central. */
  function formatoCurto(iso: string): string {
    return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(2, 4)}`;
  }
  const rotuloBotao = valor ? `${formatoCurto(valor.inicio)} a ${formatoCurto(valor.fim)}` : (labelAuto ?? "—");

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={aoAbrir}
        className="flex items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-700 hover:border-zinc-400"
      >
        <span className="text-zinc-500">{rotulo}:</span>
        <span className="font-medium text-zinc-800">{rotuloBotao}</span>
        <span className="text-zinc-400">▾</span>
      </button>

      {aberto && (
        <div className="absolute right-0 top-full z-30 mt-1 w-max rounded-md border border-zinc-200 bg-white p-4 shadow-lg" onMouseLeave={() => setHoverIso(null)}>
          {valorReferencia && anoReferencia !== null && (
            <div className="mb-3 flex gap-2 border-b border-zinc-100 pb-3">
              <SeletorMesRapido rotulo="Mesmo período, mês" ano={anoReferencia} onEscolher={(mes0) => aplicarMesRapido(anoReferencia, mes0)} />
              <SeletorMesRapido rotulo="Mesmo período, ano anterior" ano={anoReferencia - 1} onEscolher={(mes0) => aplicarMesRapido(anoReferencia - 1, mes0)} />
            </div>
          )}

          <div className="mb-2 flex items-center justify-between px-1">
            <button
              type="button"
              disabled={!podeVoltar}
              onClick={() => setMesEsquerdo(mesAnterior(mesEsquerdo))}
              className="rounded px-2 py-0.5 text-zinc-500 hover:bg-zinc-100 disabled:opacity-30"
            >
              ‹
            </button>
            <span className="text-xs text-zinc-400">{rascunho.inicio ? "Escolha a data final" : "Escolha a data inicial"}</span>
            <button
              type="button"
              disabled={!podeAvancar}
              onClick={() => setMesEsquerdo(proximoMes(mesEsquerdo))}
              className="rounded px-2 py-0.5 text-zinc-500 hover:bg-zinc-100 disabled:opacity-30"
            >
              ›
            </button>
          </div>

          <div className="flex gap-4">
            <Mes anoMes={mesEsquerdo} datasValidas={datasValidas} valor={valor} rascunho={rascunho} hoverIso={hoverIso} onHover={setHoverIso} onClickDia={aoClicarDia} />
            <Mes anoMes={mesDireito} datasValidas={datasValidas} valor={valor} rascunho={rascunho} hoverIso={hoverIso} onHover={setHoverIso} onClickDia={aoClicarDia} />
          </div>

          {difereDoPadrao && (
            <div className="mt-3 flex justify-end border-t border-zinc-100 pt-3">
              <button type="button" onClick={aoLimpar} className="text-xs font-medium text-azul hover:underline">
                Voltar ao período padrão
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
