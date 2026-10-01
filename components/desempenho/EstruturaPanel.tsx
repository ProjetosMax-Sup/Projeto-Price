"use client";

import { useMemo, useRef, useState } from "react";
import { RankingBar } from "@/components/charts/RankingBar";
import { CelulaMetrica } from "@/components/desempenho/CelulaMetrica";
import { ThOrdenavel } from "@/components/desempenho/ThOrdenavel";
import { BotaoFoco } from "@/components/ui/BotaoFoco";
import { PortalFoco } from "@/components/ui/PortalFoco";
import { useEscalaParaCaber } from "@/components/ui/useEscalaParaCaber";
import { useFoco } from "@/components/ui/useFoco";
import { agregarMetricas, labelNivel, type EstruturaAgregada, type NivelEstrutura, type NoSelecionado } from "@/lib/desempenho/aggregate";
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

// Tons sólidos (não translúcidos) — a 1ª coluna fica fixa (sticky) ao rolar a
// tabela pro lado, e uma cor translúcida deixaria as outras colunas
// "vazando" por baixo dela conforme passam por trás.
const SUBTOTAL_BG = "bg-[#E4ECF6]";
const SELECIONADA_BG = "bg-[#FBE6E6]";

/** Chave de ordenação da 1ª coluna: código pra todo mundo, exceto Produto (SKU não é sequência
 * significativa) — aí ordena pela descrição. */
function chaveNome(linha: EstruturaAgregada, nivel: NivelEstrutura): string {
  if (nivel === "produto") return linha.nome;
  return linha.codigo ?? linha.nome;
}

function ordenarPadrao(linhas: EstruturaAgregada[], nivel: NivelEstrutura): EstruturaAgregada[] {
  return [...linhas].sort((a, b) => chaveNome(a, nivel).localeCompare(chaveNome(b, nivel), "pt-BR"));
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

const TITULO_NIVEL: Record<NivelEstrutura, string> = {
  departamento: "Departamentos",
  secao: "Seções",
  categoria: "Categorias",
  grupo: "Grupos",
  subGrupo: "Sub Grupos",
  produto: "Produtos",
};

export function EstruturaPanel({
  nivel,
  linhas,
  caminho,
  produtoSelecionado,
  modoRanking,
  onToggleModo,
  onClickLinha,
  onVoltarPara,
  stickyTop,
  config,
  colunas,
}: {
  nivel: NivelEstrutura;
  linhas: EstruturaAgregada[];
  caminho: NoSelecionado[];
  produtoSelecionado: string | null;
  modoRanking: boolean;
  onToggleModo: () => void;
  onClickLinha: (linha: EstruturaAgregada) => void;
  onVoltarPara: (indice: number) => void;
  /** Offset (px) do cabeçalho sticky — soma da altura do nav + do bloco Filtros+KPIs. */
  stickyTop: number;
  /** Configuração do relatório (Parâmetros) — decide quais colunas existem e como calculá-las. */
  config: ConfigRelatorio;
  colunas: ColunaRenderizavel[];
}) {
  const [ordenacao, setOrdenacao] = useState<{ coluna: Coluna; dir: 1 | -1 } | null>(null);
  // Uma avaliação por linha, reaproveitada por exibição, ordenação e ranking — o
  // avaliador é barato (já recebe os valores agregados), mas não precisa rodar 3x.
  const valoresPorChave = useMemo(() => {
    const mapa = new Map<string, Record<string, number | null>>();
    for (const linha of linhas) mapa.set(linha.chave, valoresDaLinha(config, linha.atual, linha.comparacao));
    return mapa;
  }, [linhas, config]);
  const valoresDe = (linha: EstruturaAgregada) => valoresPorChave.get(linha.chave) ?? {};
  const principalDe = (linha: EstruturaAgregada) => valorPrincipal(config, valoresDe(linha), colunas);

  function ordenarPor(lista: EstruturaAgregada[], coluna: Coluna, dir: 1 | -1): EstruturaAgregada[] {
    return [...lista].sort((a, b) => {
      if (coluna === "nome") return dir * chaveNome(a, nivel).localeCompare(chaveNome(b, nivel), "pt-BR");
      const va = valoresDe(a)[coluna] ?? -Infinity;
      const vb = valoresDe(b)[coluna] ?? -Infinity;
      return dir * (va - vb);
    });
  }

  function ordenarRanking(lista: EstruturaAgregada[]): EstruturaAgregada[] {
    return [...lista].sort((a, b) => principalDe(b) - principalDe(a));
  }
  // O cabeçalho sticky é um <table> separado do corpo (ver comentário abaixo) — sincroniza o
  // scroll horizontal de um pro outro via ref, já que não são o mesmo elemento de scroll.
  const headerScrollRef = useRef<HTMLDivElement>(null);

  // Muda de nível (drill-down) — volta pra ordenação padrão daquele nível.
  const [nivelAnterior, setNivelAnterior] = useState(nivel);
  if (nivel !== nivelAnterior) {
    setNivelAnterior(nivel);
    setOrdenacao(null);
  }

  // 1º clique numa coluna: maior pro menor (pedido de 2026-10-01 — "dir: -1" é
  // descendente na fórmula de `ordenarPor` abaixo). 2º clique: inverte pra menor
  // pro maior. 3º: volta pra maior pro menor, e assim por diante.
  function aoClicarColuna(coluna: Coluna) {
    setOrdenacao((atual) =>
      atual?.coluna === coluna ? { coluna, dir: atual.dir === 1 ? -1 : 1 } : { coluna, dir: -1 },
    );
  }

  const ordenadas = modoRanking
    ? ordenarRanking(linhas)
    : ordenacao
      ? ordenarPor(linhas, ordenacao.coluna, ordenacao.dir)
      : ordenarPadrao(linhas, nivel);
  const valorMax = Math.max(1, ...linhas.map(principalDe));
  const totalPrincipal = linhas.reduce((soma, l) => soma + principalDe(l), 0);

  const subtotalAtual = agregarMetricas(linhas.map((l) => l.atual));
  const linhasComComparacao = linhas.filter((l): l is EstruturaAgregada & { comparacao: NonNullable<EstruturaAgregada["comparacao"]> } => l.comparacao !== null);
  const subtotalComparacao = linhasComComparacao.length > 0 ? agregarMetricas(linhasComComparacao.map((l) => l.comparacao)) : null;
  const valoresSubtotal = valoresDaLinha(config, subtotalAtual, subtotalComparacao);
  const larguraMinima = larguraMinimaTabela(colunas);

  // Foco: painel vira overlay de tela cheia (fixed inset-0), perde borda/sombra/cantos
  // arredondados (edge-to-edge), e o conteúdo abaixo do título é ESCALADO (zoom out/in)
  // pra caber inteiro sem scroll — não é só "tela cheia com scroll", é ver todas as
  // linhas/colunas de uma vez, qualquer resolução (ver `useEscalaParaCaber`). Como nada
  // rola mais, `stickyTopEfetivo` não precisa ser 0 de verdade: só zera o deslocamento
  // do nav/filtros, que deixou de existir aqui.
  const { focado, alternar } = useFoco();
  const stickyTopEfetivo = focado ? 0 : stickyTop;
  const { containerRef, contentRef, escala } = useEscalaParaCaber(focado, larguraMinima);

  return (
    <PortalFoco ativo={focado}>
    <div
      className={
        focado
          ? "fixed inset-0 z-50 flex flex-col bg-white"
          : "flex flex-col rounded-lg border border-zinc-200 bg-white shadow-sm"
      }
    >
      <div className={`flex items-center justify-between bg-azul px-4 py-3 ${focado ? "" : "rounded-t-lg"}`}>
        <div className="text-sm">
          <h2 className="font-display font-semibold text-white">{TITULO_NIVEL[nivel]}</h2>
          {caminho.length > 0 && (
            <div className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-white/70">
              <button type="button" onClick={() => onVoltarPara(-1)} className="text-white hover:underline">
                {TITULO_NIVEL.departamento}
              </button>
              {caminho.map((no, i) => (
                <span key={no.chave} className="flex items-center gap-1">
                  <span>{">"}</span>
                  {i === caminho.length - 1 ? (
                    <span className="text-white/90">{no.nome}</span>
                  ) : (
                    <button type="button" onClick={() => onVoltarPara(i)} className="text-white hover:underline">
                      {no.nome}
                    </button>
                  )}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
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
          <BotaoFoco focado={focado} onClick={alternar} />
        </div>
      </div>

      <div
        ref={containerRef}
        className={focado ? "flex min-h-0 flex-1 items-start justify-center overflow-auto" : undefined}
      >
      <div ref={contentRef} style={focado ? { display: "inline-block", zoom: escala } : undefined}>
      {modoRanking ? (
        <div className="space-y-1 p-3">
          {ordenadas.map((linha) => (
            <RankingBar
              key={linha.chave}
              rotulo={linha.nome}
              codigo={linha.codigo}
              valor={principalDe(linha)}
              valorMax={valorMax}
              desvio={linha.desvioVenda}
              ativo={nivel === "produto" && linha.chave === produtoSelecionado}
              onClick={() => onClickLinha(linha)}
            />
          ))}
        </div>
      ) : (
        <>
          {/* Cabeçalho num <table> próprio, fora do container de scroll horizontal do corpo —
              testado empiricamente: um `<thead>` sticky dentro de um ancestral com overflow-x-auto
              (mesmo sem overflow vertical real) NÃO gruda ao rolar a página, porque qualquer
              ancestral com overflow não-visível quebra o `position: sticky` de um descendente,
              mesmo quando esse ancestral nunca chega a rolar por conta própria. Por isso o
              cabeçalho vira sua própria tabela sticky (sem overflow-x-auto entre ele e a página) e
              sincroniza o scroll horizontal com o corpo via `scrollLeft` (ref abaixo). */}
          {/* Em Foco, `sticky` sai de vez: nada rola ali (o próprio propósito do modo), e
              `sticky` + `zoom` (ver useEscalaParaCaber) numa ancestral é uma combinação
              com bug conhecido no Chrome/Edge — sobra um vão em branco fantasma no
              topo, mesmo com `top: 0`. */}
          <div
            ref={headerScrollRef}
            className={`${focado ? "" : "sticky"} z-20 overflow-x-hidden bg-azul text-[13px] font-medium tracking-wide text-white/80 uppercase`}
            style={focado ? undefined : { top: stickyTopEfetivo }}
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
                    {labelNivel(nivel)}
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
            className={`overflow-x-auto ${focado ? "" : "rounded-b-lg"}`}
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
                const selecionada = nivel === "produto" && linha.chave === produtoSelecionado;
                const corFundo = selecionada ? SELECIONADA_BG : i % 2 === 1 ? "bg-zinc-50" : "bg-white";
                return (
                  <tr
                    key={linha.chave}
                    onClick={() => onClickLinha(linha)}
                    className={`cursor-pointer border-t border-zinc-100 hover:bg-azul/5 ${corFundo}`}
                  >
                    <td className={`sticky left-0 z-10 min-w-[280px] truncate px-4 py-2 font-medium text-zinc-800 ${corFundo}`}>
                      {linha.codigo && <span className="font-normal text-zinc-400">{linha.codigo} - </span>}
                      {linha.nome}
                    </td>
                    {colunas.map((c) => (
                      <CelulaMetrica key={c.ref} coluna={c} valor={valoresDe(linha)[c.ref] ?? null} />
                    ))}
                    <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap text-zinc-500">
                      {formatPercent(totalPrincipal !== 0 ? (principalDe(linha) / totalPrincipal) * 100 : 0, 1)}
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
      </div>
    </div>
    </PortalFoco>
  );
}
