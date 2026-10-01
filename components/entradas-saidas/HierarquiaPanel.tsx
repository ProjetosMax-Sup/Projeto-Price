"use client";

import { useMemo, useRef, useState } from "react";
import { CelulaMetrica } from "@/components/desempenho/CelulaMetrica";
import { ThOrdenavel } from "@/components/desempenho/ThOrdenavel";
import { BotaoFoco } from "@/components/ui/BotaoFoco";
import { PortalFoco } from "@/components/ui/PortalFoco";
import { useEscalaParaCaber } from "@/components/ui/useEscalaParaCaber";
import { useFoco } from "@/components/ui/useFoco";
import { labelNivel, type NivelEstrutura } from "@/lib/desempenho/aggregate";
import {
  LARGURA_COLUNA_PART,
  larguraMinimaTabela,
  valorPrincipal,
  type ColunaRenderizavel,
} from "@/lib/desempenho/colunas-configuradas";
import type { NoEntradasSaidas } from "@/lib/entradas-saidas/aggregate";
import { avaliarColunas } from "@/lib/parametros/avaliador";
import type { ConfigRelatorio } from "@/lib/parametros/types";

type Coluna = "nome" | string;

const SUBTOTAL_BG = "bg-[#E4ECF6]";
/** Segundo Total (com Apropriações/Sem Comprador incluídos) — cor própria, diferente do
 * primeiro, pra não confundir qual dos dois é a leitura principal ao passar o olho. */
const SUBTOTAL_ALT_BG = "bg-amber-50";

/**
 * "Apropriações" (departamento contábil, sem produto/venda de verdade) e "Sem
 * Comprador" (departamento sem comprador cadastrado) distorcem a leitura
 * principal do relatório — por isso ficam de fora do primeiro Total (o que
 * importa no dia a dia) e aparecem à parte, marcadas em vermelho, no segundo
 * Total (com tudo, pra bater com o número contábil fechado). Mesmo padrão
 * visual de "Mesmas Lojas" no Desempenho Comercial.
 */
function ehExcluidoDoTotalPrincipal(nome: string): boolean {
  const normalizado = nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
  return normalizado === "apropriacoes" || normalizado === "sem comprador" || normalizado === "s/ comprador";
}

/** Chave de ordenação da 1ª coluna: código pra todo mundo (Departamento, Seção, ...,
 * Comprador quando tem), exceto Produto — SKU não é sequência significativa pra
 * ordenar, aí usa o nome mesmo (pedido de 2026-10-01, mesma regra de `EstruturaPanel`
 * > `chaveNome`). */
function chaveOrdenacaoNome(no: NoEntradasSaidas): string {
  if (no.nivel === "produto") return no.nome;
  return no.codigo ?? no.nome;
}

/** "Meta" (Compra e Venda, ref sintético — ver lib/compra-venda/aggregate.ts) não pode
 * somar direto: é percentual, e a soma de percentuais de partes diferentes não é o
 * percentual do total. Precisa da média ponderada pela Venda de quem tem meta
 * cadastrada — mesma regra usada no Comprador e no "Todos" (Formato). Só entra no
 * total quando pelo menos uma linha tem "Meta"; senão nem aparece (nunca virou 0). */
function metaPonderadaPorVenda(linhas: NoEntradasSaidas[]): number | undefined {
  let somaPonderada = 0;
  let pesoComMeta = 0;
  for (const linha of linhas) {
    const meta = linha.valores.Meta;
    if (meta === undefined) continue;
    somaPonderada += meta * (linha.valores.Valor ?? 0);
    pesoComMeta += linha.valores.Valor ?? 0;
  }
  return pesoComMeta > 0 ? somaPonderada / pesoComMeta : undefined;
}

function somarValoresNativos(linhas: NoEntradasSaidas[]): Record<string, number> {
  const soma: Record<string, number> = {};
  for (const linha of linhas) {
    for (const [ref, valor] of Object.entries(linha.valores)) {
      if (ref === "Meta") continue;
      soma[ref] = (soma[ref] ?? 0) + valor;
    }
  }
  const meta = metaPonderadaPorVenda(linhas);
  if (meta !== undefined) soma.Meta = meta;
  return soma;
}

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

/**
 * Painel de drill-down genérico do Entradas e Saídas — usado pelos dois
 * painéis (Departamento e Comprador), cada um com seu próprio estado de
 * navegação (ver `EntradasSaidasDashboard`). Mesma mecânica visual de
 * `EstruturaPanel.tsx` (cabeçalho sticky em tabela própria, drill-down por
 * clique, breadcrumb), sem período de Comparação — decisão de 2026-09-30.
 */
export function HierarquiaPanel({
  titulo,
  linhas,
  breadcrumb,
  config,
  colunas,
  onClickLinha,
  onVoltarPara,
  stickyTop,
  ordenacaoPadrao = "principal",
}: {
  titulo: string;
  linhas: NoEntradasSaidas[];
  /** Trilha de navegação já percorrida (nomes) — clicar num item anterior volta pra lá.
   * `onVoltarPara(-1)` volta pra raiz do painel. */
  breadcrumb: { nome: string }[];
  config: ConfigRelatorio;
  colunas: ColunaRenderizavel[];
  onClickLinha: (linha: NoEntradasSaidas) => void;
  onVoltarPara: (indice: number) => void;
  stickyTop: number;
  /** "principal": ordem padrão é a coluna principal (Saldo), decrescente — pedido explícito
   * pro painel Comprador. "nome": ordem alfabética/código, como o Desempenho Comercial. */
  ordenacaoPadrao?: "principal" | "nome";
}) {
  const [ordenacao, setOrdenacao] = useState<{ coluna: Coluna; dir: 1 | -1 } | null>(null);
  const headerScrollRef = useRef<HTMLDivElement>(null);

  const valoresPorChave = useMemo(() => {
    const mapa = new Map<string, Record<string, number | null>>();
    for (const linha of linhas) mapa.set(linha.chave, avaliarColunas(config, { atual: linha.valores, comparacao: null }));
    return mapa;
  }, [linhas, config]);
  const valoresDe = (linha: NoEntradasSaidas) => valoresPorChave.get(linha.chave) ?? {};
  const principalDe = (linha: NoEntradasSaidas) => valorPrincipal(config, valoresDe(linha), colunas);

  // 1º clique numa coluna: maior pro menor (pedido de 2026-10-01 — "dir: -1" é
  // descendente na fórmula abaixo). 2º clique: inverte pra menor pro maior.
  function aoClicarColuna(coluna: Coluna) {
    setOrdenacao((atual) => (atual?.coluna === coluna ? { coluna, dir: atual.dir === 1 ? -1 : 1 } : { coluna, dir: -1 }));
  }

  const ordenadas = useMemo(() => {
    if (ordenacao) {
      const { coluna, dir } = ordenacao;
      return [...linhas].sort((a, b) => {
        if (coluna === "nome") return dir * chaveOrdenacaoNome(a).localeCompare(chaveOrdenacaoNome(b), "pt-BR");
        const va = valoresDe(a)[coluna] ?? -Infinity;
        const vb = valoresDe(b)[coluna] ?? -Infinity;
        return dir * (va - vb);
      });
    }
    if (ordenacaoPadrao === "principal") return [...linhas].sort((a, b) => principalDe(b) - principalDe(a));
    return [...linhas].sort((a, b) => chaveOrdenacaoNome(a).localeCompare(chaveOrdenacaoNome(b), "pt-BR"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linhas, ordenacao, ordenacaoPadrao, valoresPorChave]);

  const totalPrincipal = linhas.reduce((soma, l) => soma + principalDe(l), 0);
  const linhasExcluidas = useMemo(() => linhas.filter((l) => ehExcluidoDoTotalPrincipal(l.nome)), [linhas]);
  const temExclusao = linhasExcluidas.length > 0;
  const linhasSemExclusao = useMemo(() => linhas.filter((l) => !ehExcluidoDoTotalPrincipal(l.nome)), [linhas]);

  // Com exclusão: dois totais — "Total" (o principal, sem Apropriações/Sem Comprador, vem
  // primeiro por ser a leitura do dia a dia) e "Total (com tudo)" (inclui tudo, pra bater
  // com o fechamento contábil). Sem exclusão nenhuma linha marcada: só o Total de sempre.
  const subtotalPrincipalValores = useMemo(
    () => avaliarColunas(config, { atual: somarValoresNativos(linhasSemExclusao), comparacao: null }),
    [linhasSemExclusao, config],
  );
  const subtotalGeralValores = useMemo(
    () => avaliarColunas(config, { atual: somarValoresNativos(linhas), comparacao: null }),
    [linhas, config],
  );
  const larguraMinima = larguraMinimaTabela(colunas);

  // Mesmo mecanismo de `EstruturaPanel` — ver comentário lá: Foco escala o conteúdo pra
  // caber sem scroll, não só expande pra tela cheia com scroll.
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
          <h2 className="font-display font-semibold text-white">{titulo}</h2>
          {breadcrumb.length > 0 && (
            <div className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-white/70">
              <button type="button" onClick={() => onVoltarPara(-1)} className="text-white hover:underline">
                {titulo}
              </button>
              {breadcrumb.map((no, i) => (
                <span key={i} className="flex items-center gap-1">
                  <span>{">"}</span>
                  {i === breadcrumb.length - 1 ? (
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
        <BotaoFoco focado={focado} onClick={alternar} />
      </div>

      <div
        ref={containerRef}
        className={focado ? "flex min-h-0 flex-1 items-start justify-center overflow-auto" : undefined}
      >
      <div ref={contentRef} style={focado ? { display: "inline-block", zoom: escala } : undefined}>
      {/* Em Foco, `sticky` sai de vez: nada rola ali (o próprio propósito do modo), e
          `sticky` + `zoom` (ver useEscalaParaCaber) numa ancestral é uma combinação
          com bug conhecido no Chrome/Edge — sobra um vão em branco fantasma no topo,
          mesmo com `top: 0`. */}
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
                {breadcrumb.length > 0 ? labelNivelOuComprador(inferirNivel(linhas)) : titulo}
              </ThOrdenavel>
              {colunas.map((c) => (
                <ThOrdenavel<Coluna> key={c.ref} coluna={c.ref} ordenacao={ordenacao} onClick={aoClicarColuna} className="bg-azul px-2 py-2 font-medium">
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
                <td className={`sticky left-0 z-10 min-w-[280px] px-4 py-2 font-semibold text-azul ${SUBTOTAL_BG}`}>
                  {temExclusao ? "Total S/ Apropriações" : "Total"}
                </td>
                {colunas.map((c) => (
                  <CelulaMetrica key={c.ref} coluna={c} valor={(temExclusao ? subtotalPrincipalValores : subtotalGeralValores)[c.ref] ?? null} enfase />
                ))}
                {/* Linha de Comparação % faz sentido contra o total GERAL (as próprias linhas somam
                    nisso, ver `totalPrincipal`) — quando este Total é o principal (parcial, sem
                    Apropriações/Sem Comprador), "100%" seria enganoso aqui. */}
                <td className="px-3 py-2 text-right font-semibold tabular-nums text-azul">{temExclusao ? "—" : "100%"}</td>
              </tr>
            )}
            {temExclusao && (
              <tr className={`border-b-2 border-amber-300/60 ${SUBTOTAL_ALT_BG}`}>
                <td
                  className={`sticky left-0 z-10 min-w-[280px] px-4 py-2 text-xs font-semibold text-amber-700 ${SUBTOTAL_ALT_BG}`}
                  title={`Inclui ${linhasExcluidas.map((l) => l.nome).join(", ")}`}
                >
                  Total C/ Apropriações
                </td>
                {colunas.map((c) => (
                  <CelulaMetrica key={c.ref} coluna={c} valor={subtotalGeralValores[c.ref] ?? null} />
                ))}
                <td className="px-3 py-2 text-right text-xs tabular-nums text-amber-700">100%</td>
              </tr>
            )}
            {ordenadas.map((linha, i) => {
              const excluida = ehExcluidoDoTotalPrincipal(linha.nome);
              const corFundo = i % 2 === 1 ? "bg-zinc-50" : "bg-white";
              return (
                <tr
                  key={linha.chave}
                  onClick={() => onClickLinha(linha)}
                  title={excluida ? "Fora do Total principal — soma separado, ver linha 'Total (com tudo)'." : undefined}
                  className={[
                    "cursor-pointer border-t border-zinc-100 hover:bg-azul/5",
                    corFundo,
                    excluida ? "border-l-4 border-l-vermelho" : "",
                  ].join(" ")}
                >
                  <td className={`sticky left-0 z-10 min-w-[280px] truncate px-4 py-2 font-medium ${excluida ? "text-vermelho" : "text-zinc-800"} ${corFundo}`}>
                    {linha.codigo && <span className="font-normal text-zinc-400">{linha.codigo} - </span>}
                    {linha.nome}
                  </td>
                  {colunas.map((c) => (
                    <CelulaMetrica key={c.ref} coluna={c} valor={valoresDe(linha)[c.ref] ?? null} />
                  ))}
                  <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap text-zinc-500">
                    {totalPrincipal !== 0 ? `${((principalDe(linha) / totalPrincipal) * 100).toFixed(1)}%` : "—"}
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
      </div>
      </div>
    </div>
    </PortalFoco>
  );
}

function inferirNivel(linhas: NoEntradasSaidas[]): NivelEstrutura | "comprador" {
  return linhas[0]?.nivel ?? "departamento";
}

function labelNivelOuComprador(nivel: NivelEstrutura | "comprador"): string {
  return nivel === "comprador" ? "Comprador" : labelNivel(nivel);
}
