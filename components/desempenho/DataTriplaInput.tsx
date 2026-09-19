"use client";

import { useEffect, useRef, useState } from "react";
import { dataValida, diasNoMes, NOMES_MESES_COMPLETOS } from "@/lib/desempenho/datas";

function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

/** Aceita tanto o número (1-12) quanto o nome do mês (ou prefixo dele) digitado. */
function resolverMes(texto: string): number | null {
  const t = texto.trim();
  if (!t) return null;
  const n = Number(t);
  if (Number.isInteger(n) && n >= 1 && n <= 12) return n;
  const alvo = normalizar(t);
  const indice = NOMES_MESES_COMPLETOS.findIndex((nome) => normalizar(nome).startsWith(alvo));
  return indice === -1 ? null : indice + 1;
}

/** Um subcampo (Dia/Mês/Ano): input de texto livre + dropdown que abre ao focar/clicar. */
function Subcampo({
  rotulo,
  valor,
  onChange,
  opcoes,
  aberto,
  onAbrir,
  onFechar,
  largura,
}: {
  rotulo: string;
  valor: string;
  onChange: (v: string) => void;
  opcoes: { value: string; label: string }[];
  aberto: boolean;
  onAbrir: () => void;
  onFechar: () => void;
  largura: number;
}) {
  return (
    <div className="relative">
      <input
        type="text"
        value={valor}
        placeholder={rotulo}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onAbrir}
        className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-center text-sm text-zinc-700 focus:border-azul focus:outline-none"
        style={{ width: largura }}
      />
      {aberto && opcoes.length > 0 && (
        <div className="absolute left-0 top-full z-30 mt-1 max-h-56 w-max min-w-full overflow-auto rounded-md border border-zinc-200 bg-white py-1 shadow-lg">
          {opcoes.map((o) => (
            <button
              key={o.value}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(o.label);
                onFechar();
              }}
              className="block w-full whitespace-nowrap px-3 py-1 text-left text-sm text-zinc-700 hover:bg-zinc-50"
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Trio Dia/Mês/Ano — cada subcampo aceita digitação livre ou escolha num dropdown. Só emite um
 * ISO ("AAAA-MM-DD") pra cima quando os 3 estão preenchidos E formam uma data de calendário
 * real; caso contrário emite `null` (sem propagar estado parcial) e mostra um aviso inline
 * quando a tentativa está completa mas é inválida (ex: 30/Fev).
 */
export function DataTriplaInput({
  valor,
  onChange,
  anosDisponiveis,
}: {
  /** ISO "AAAA-MM-DD" quando a data externa foi limpa (null) — usado só pra resetar os campos. */
  valor: string | null;
  onChange: (iso: string | null) => void;
  anosDisponiveis: number[];
}) {
  const [diaStr, setDiaStr] = useState("");
  const [mesStr, setMesStr] = useState("");
  const [anoStr, setAnoStr] = useState("");
  const [campoAberto, setCampoAberto] = useState<"dia" | "mes" | "ano" | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Limpa os campos quando o valor externo é resetado (botão "×" do período) — ajuste de estado
  // durante o render (não em efeito) pra não disparar um ciclo extra de render.
  const [valorAnterior, setValorAnterior] = useState(valor);
  if (valor !== valorAnterior) {
    setValorAnterior(valor);
    if (valor === null) {
      setDiaStr("");
      setMesStr("");
      setAnoStr("");
    }
  }

  useEffect(() => {
    function aoClicarFora(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setCampoAberto(null);
    }
    document.addEventListener("mousedown", aoClicarFora);
    return () => document.removeEventListener("mousedown", aoClicarFora);
  }, []);

  const mesNum = resolverMes(mesStr);
  const anoNum = /^\d{4}$/.test(anoStr.trim()) ? Number(anoStr) : null;
  const maxDia = mesNum && anoNum ? diasNoMes(mesNum, anoNum) : 31;

  const diaNum = Number(diaStr.trim());
  const completo = diaStr.trim() !== "" && mesStr.trim() !== "" && anoStr.trim() !== "" && mesNum !== null && anoNum !== null && Number.isInteger(diaNum);
  const valida = completo && dataValida(diaNum, mesNum!, anoNum!);

  useEffect(() => {
    if (valida) {
      const iso = `${String(anoNum).padStart(4, "0")}-${String(mesNum).padStart(2, "0")}-${String(diaNum).padStart(2, "0")}`;
      onChange(iso);
    } else {
      onChange(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diaStr, mesStr, anoStr]);

  const opcoesDia = Array.from({ length: maxDia }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }));
  const opcoesMes = NOMES_MESES_COMPLETOS.map((nome, i) => ({ value: String(i + 1), label: nome }));
  const anos = anosDisponiveis.length > 0 ? anosDisponiveis : [new Date().getFullYear()];
  const opcoesAno = anos.map((a) => ({ value: String(a), label: String(a) }));

  return (
    <div>
      <div ref={ref} className="flex items-center gap-1">
        <Subcampo
          rotulo="Dia"
          valor={diaStr}
          onChange={setDiaStr}
          opcoes={opcoesDia}
          aberto={campoAberto === "dia"}
          onAbrir={() => setCampoAberto("dia")}
          onFechar={() => setCampoAberto(null)}
          largura={44}
        />
        <Subcampo
          rotulo="Mês"
          valor={mesStr}
          onChange={setMesStr}
          opcoes={opcoesMes}
          aberto={campoAberto === "mes"}
          onAbrir={() => setCampoAberto("mes")}
          onFechar={() => setCampoAberto(null)}
          largura={92}
        />
        <Subcampo
          rotulo="Ano"
          valor={anoStr}
          onChange={setAnoStr}
          opcoes={opcoesAno}
          aberto={campoAberto === "ano"}
          onAbrir={() => setCampoAberto("ano")}
          onFechar={() => setCampoAberto(null)}
          largura={64}
        />
      </div>
      {completo && !valida && <p className="mt-0.5 text-[11px] text-vermelho">Data inválida</p>}
    </div>
  );
}
