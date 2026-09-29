"use client";

import { useMemo, useRef, useState, type MouseEvent } from "react";
import { RankingBar } from "@/components/charts/RankingBar";
import { CelulaMetrica } from "@/components/desempenho/CelulaMetrica";
import { ThOrdenavel } from "@/components/desempenho/ThOrdenavel";
import { agregarMetricas, type LojaAgregada } from "@/lib/desempenho/aggregate";
import {
  LARGURA_COLUNA_PART,
  larguraMinimaTabela,
  valorPrincipal,
  valoresDaLinha,
  type ColunaRenderizavel,
} from "@/lib/desempenho/colunas-configuradas";
import { formatPercent } from "@/lib/desempenho/format";
import type { ConfigRelatorio } from "@/lib/parametros/types";

/** "nome" é a 1ª coluna (fixa); o resto é o ref da coluna configurada. */
type Coluna = "nome" | string;

const SUBTOTAL_BG = "bg-[#E4ECF6]";
const SELECIONADA_BG = "bg-[#FBE6E6]";

/** "AAAA-MM-DD" → "DD/MM". */
function formatoCurto(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

/** Ex: "08/09 a 09/09" (ou só "08/09" quando é um único dia). */
function formatarIntervalo({ inicio, fim }: { inicio: string; fim: string }): string {
  return inicio === fim ? formatoCurto(inicio) : `${formatoCurto(inicio)} a ${formatoCurto(fim)}`;
}

/** Monta o texto do tooltip a partir dos intervalos sem venda de cada período. */
function textoFechamento(linha: LojaAgregada): string {
  const partes: string[] = [];
  if (linha.fechamentosAtual.length > 0) partes.push(`Atual: ${linha.fechamentosAtual.map(formatarIntervalo).join(", ")}`);
  if (linha.fechamentosComparacao.length > 0) partes.push(`Comparação: ${linha.fechamentosComparacao.map(formatarIntervalo).join(", ")}`);
  return `Sem movimentação — ${partes.join(" · ")}`;
}

/** Larguras compartilhadas entre a tabela de cabeçalho (sticky) e a de corpo (scroll horizontal) —
 * como são dois `<table>` separados (ver comentário mais abaixo), o `<colgroup>` garante que as
 * colunas de uma fiquem alinhadas em pixel com as da outra. Só as colunas de MÉTRICA (números
 * formatados, tamanho previsível) têm largura fixa — a 1ª coluna (nome) fica sem `width`, então
 * absorve o espaço sobrando até preencher o painel todo (sem faixa em branco à direita) e, se o
 * painel for estreito demais pras métricas caberem, o container ainda tem scroll horizontal (ver
 * `overflow-x-auto` abaixo) em vez de espremer as colunas de número. */
function Colgroup({ colunas }: { colunas: ColunaRenderizavel[] }) {
  return (
    <colgroup>
      <col />
      {colunas.map((c) => (
        <col key={c.ref} style={{ width: c.largura }} />
      ))}
      <col style={{ width: LARGURA_COLUNA_PART }} />
    </colgroup>
  );
}

export function LojasPanel({
  linhas,
  selecionadas,
  onClickLinha,
  stickyTop,
  mesmasLojasAtivo,
  modoRanking,
  onToggleModo,
  config,
  colunas,
}: {
  linhas: LojaAgregada[];
  selecionadas: string[];
  onClickLinha: (loja: LojaAgregada, evento: MouseEvent) => void;
  /** Offset (px) do cabeçalho sticky — soma da altura do nav + do bloco Filtros+KPIs. */
  stickyTop: number;
  /** Filtro "Mesmas Lojas" ligado — lojas com `mesmaLoja: false` saem do subtotal (continuam
   * aparecendo como linha) e ganham uma borda vermelha à esquerda pra avisar por quê. */
  mesmasLojasAtivo: boolean;
  modoRanking: boolean;
  onToggleModo: () => void;
  /** Configuração do relatório (Parâmetros) — decide quais colunas existem e como calculá-las. */
  config: ConfigRelatorio;
  colunas: ColunaRenderizavel[];
}) {
  const [ordenacao, setOrdenacao] = useState<{ coluna: Coluna; dir: 1 | -1 } | null>(null);
  const valoresPorLoja = useMemo(() => {
    const mapa = new Map<string, Record<string, number | null>>();
    for (const linha of linhas) mapa.set(linha.loja.codUnid, valoresDaLinha(config, linha.atual, linha.comparacao));
    return mapa;
  }, [linhas, config]);
  const valoresDe = (linha: LojaAgregada) => valoresPorLoja.get(linha.loja.codUnid) ?? {};
  const principalDe = (linha: LojaAgregada) => valorPrincipal(config, valoresDe(linha), colunas);

  /** Código da loja — mesma lógica de ordenação padrão e explícita (não pelo nome). */
  function ordenar(lista: LojaAgregada[], atual: { coluna: Coluna; dir: 1 | -1 } | null): LojaAgregada[] {
    if (!atual) return [...lista].sort((a, b) => a.loja.codUnid.localeCompare(b.loja.codUnid));
    const { coluna, dir } = atual;
    return [...lista].sort((a, b) => {
      if (coluna === "nome") return dir * a.loja.codUnid.localeCompare(b.loja.codUnid);
      const va = valoresDe(a)[coluna] ?? -Infinity;
      const vb = valoresDe(b)[coluna] ?? -Infinity;
      return dir * (va - vb);
    });
  }

  function ordenarRanking(lista: LojaAgregada[]): LojaAgregada[] {
    return [...lista].sort((a, b) => principalDe(b) - principalDe(a));
  }
  // O cabeçalho sticky é um <table> separado do corpo (ver comentário abaixo) — sincroniza o
  // scroll horizontal de um pro outro via ref, já que não são o mesmo elemento de scroll.
  const headerScrollRef = useRef<HTMLDivElement>(null);

  function aoClicarColuna(coluna: Coluna) {
    setOrdenacao((atual) =>
      atual?.coluna === coluna ? { coluna, dir: atual.dir === 1 ? -1 : 1 } : { coluna, dir: 1 },
    );
  }

  const ordenadas = modoRanking ? ordenarRanking(linhas) : ordenar(linhas, ordenacao);
  const valorMax = Math.max(1, ...linhas.map(principalDe));
  // Com "Mesmas Lojas" ligado, lojas que não estavam abertas desde o início dos dois períodos
  // saem do subtotal e do total usado pra calcular a coluna "Part." — mas continuam aparecendo
  // como linha (ver render abaixo), só marcadas.
  const linhasNoTotal = mesmasLojasAtivo ? linhas.filter((l) => l.mesmaLoja) : linhas;
  const totalPrincipal = linhasNoTotal.reduce((soma, l) => soma + principalDe(l), 0);

  const subtotalAtual = agregarMetricas(linhasNoTotal.map((l) => l.atual));
  const linhasComComparacao = linhasNoTotal.filter((l): l is LojaAgregada & { comparacao: NonNullable<LojaAgregada["comparacao"]> } => l.comparacao !== null);
  const subtotalComparacao = linhasComComparacao.length > 0 ? agregarMetricas(linhasComComparacao.map((l) => l.comparacao)) : null;
  const valoresSubtotal = valoresDaLinha(config, subtotalAtual, subtotalComparacao);
  const larguraMinima = larguraMinimaTabela(colunas);

  return (
    <div className="flex flex-col rounded-lg border border-zinc-200 bg-white shadow-sm">
      <div className="flex items-center justify-between rounded-t-lg bg-azul px-4 py-3">
        <div>
          <h2 className="font-display font-semibold text-white">Lojas</h2>
          <p className="mt-0.5 text-xs text-white/70">
            Clique para selecionar uma loja · Shift+clique para selecionar várias
          </p>
        </div>
        <div className="flex overflow-hidden rounded-md border border-white/30 text-xs font-medium">
          <button
            type="button"
            onClick={() => modoRanking && onToggleModo()}
            className={`px-3 py-1.5 ${!modoRanking ? "bg-white text-azul" : "text-white/80 hover:bg-white/10"}`}
          >
            Tabela
          </button>
          <button
            type="button"
            onClick={() => !modoRanking && onToggleModo()}
            className={`px-3 py-1.5 ${modoRanking ? "bg-white text-azul" : "text-white/80 hover:bg-white/10"}`}
          >
            Ranking
          </button>
        </div>
      </div>
      {modoRanking ? (
        <div className="space-y-1 p-3">
          {ordenadas.map((linha) => (
            <RankingBar
              key={linha.loja.codUnid}
              rotulo={linha.loja.nomeLoja}
              codigo={linha.loja.codUnid}
              valor={principalDe(linha)}
              valorMax={valorMax}
              desvio={linha.desvioVenda}
              ativo={selecionadas.includes(linha.loja.codUnid)}
              onClick={(evento) => onClickLinha(linha, evento)}
            />
          ))}
        </div>
      ) : (
        <>
      {/* Cabeçalho num <table> próprio, fora do container de scroll horizontal do corpo —
          testado empiricamente: um `<thead>` sticky dentro de um ancestral com overflow-x-auto
          (mesmo sem overflow vertical real) NÃO gruda ao rolar a página, porque qualquer
          ancestral com overflow não-visível quebra o `position: sticky` de um descendente, mesmo
          quando esse ancestral nunca chega a rolar por conta própria. Por isso o cabeçalho vira
          sua própria tabela sticky (sem overflow-x-auto entre ele e a página) e sincroniza o
          scroll horizontal com o corpo via `scrollLeft` (ref acima). */}
      <div
        ref={headerScrollRef}
        className="sticky z-20 overflow-x-hidden bg-azul text-[13px] font-medium tracking-wide text-white/80 uppercase"
        style={{ top: stickyTop }}
      >
        <table className="table-fixed text-sm" style={{ width: "100%", minWidth: larguraMinima }}>
          <Colgroup colunas={colunas} />
          <thead>
            <tr>
              <ThOrdenavel<Coluna>
                coluna="nome"
                ordenacao={ordenacao}
                onClick={aoClicarColuna}
                className="sticky left-0 z-30 min-w-[280px] bg-azul px-4 py-2 font-medium"
              >
                Loja
              </ThOrdenavel>
              {colunas.map((c) => (
                <ThOrdenavel<Coluna>
                  key={c.ref}
                  coluna={c.ref}
                  ordenacao={ordenacao}
                  onClick={aoClicarColuna}
                  className="bg-azul px-2 py-2 font-medium"
                >
                  {c.rotulo}
                </ThOrdenavel>
              ))}
              <th className="bg-azul px-3 py-2 text-center font-medium">Part.</th>
            </tr>
          </thead>
        </table>
      </div>
      <div
        className="overflow-x-auto rounded-b-lg"
        onScroll={(e) => {
          if (headerScrollRef.current) headerScrollRef.current.scrollLeft = e.currentTarget.scrollLeft;
        }}
      >
        <table className="table-fixed text-sm" style={{ width: "100%", minWidth: larguraMinima }}>
          <Colgroup colunas={colunas} />
          <tbody>
            {ordenadas.length > 0 && (
              <tr className={`border-b-2 border-azul/20 ${SUBTOTAL_BG}`}>
                <td className={`sticky left-0 z-10 min-w-[280px] px-4 py-2 font-semibold text-azul ${SUBTOTAL_BG}`}>Total</td>
                {colunas.map((c) => (
                  <CelulaMetrica key={c.ref} coluna={c} valor={valoresSubtotal[c.ref] ?? null} enfase />
                ))}
                <td className="px-3 py-2 text-right font-semibold tabular-nums text-azul">100%</td>
              </tr>
            )}
            {ordenadas.map((linha, i) => {
              const selecionada = selecionadas.includes(linha.loja.codUnid);
              const excluidaDoTotal = mesmasLojasAtivo && !linha.mesmaLoja;
              const corFundo = selecionada ? SELECIONADA_BG : i % 2 === 1 ? "bg-zinc-50" : "bg-white";
              // Vermelho (fora do total) tem prioridade visual sobre amarelo (fechamento) — os
              // dois podem ser verdadeiros ao mesmo tempo (loja nova que também fechou depois de
              // abrir), mas só uma borda por linha pra não poluir.
              const tituloLinha = excluidaDoTotal
                ? "Fora dos totais: loja não estava aberta desde o início dos dois períodos comparados (ver ⓘ nos Filtros)."
                : linha.temFechamento
                  ? textoFechamento(linha)
                  : undefined;
              return (
                <tr
                  key={linha.loja.codUnid}
                  onClick={(evento) => onClickLinha(linha, evento)}
                  title={tituloLinha}
                  className={[
                    "cursor-pointer select-none border-t border-zinc-100 hover:bg-azul/5",
                    corFundo,
                    excluidaDoTotal ? "border-l-4 border-l-vermelho" : linha.temFechamento ? "border-l-4 border-l-amber-400" : "",
                  ].join(" ")}
                >
                  <td className={`sticky left-0 z-10 min-w-[280px] truncate px-4 py-2 font-medium text-zinc-800 ${corFundo}`}>
                    <span className="font-normal text-zinc-400">{linha.loja.codUnid} - </span>
                    {linha.loja.nomeLoja}
                    <span
                      className={[
                        "ml-1.5 rounded px-1.5 py-0.5 text-[10px] font-medium",
                        linha.loja.formato === "Atacado" ? "bg-vermelho/10 text-vermelho" : "bg-azul/10 text-azul",
                      ].join(" ")}
                    >
                      {linha.loja.formato}
                    </span>
                  </td>
                  {colunas.map((c) => (
                    <CelulaMetrica key={c.ref} coluna={c} valor={valoresDe(linha)[c.ref] ?? null} />
                  ))}
                  <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap text-zinc-500">
                    {excluidaDoTotal
                      ? "—"
                      : formatPercent(totalPrincipal !== 0 ? (principalDe(linha) / totalPrincipal) * 100 : 0, 1)}
                  </td>
                </tr>
              );
            })}
            {ordenadas.length === 0 && (
              <tr>
                <td colSpan={colunas.length + 2} className="px-4 py-8 text-center text-zinc-400">
                  Nenhum dado para o recorte selecionado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
        </>
      )}
    </div>
  );
}
