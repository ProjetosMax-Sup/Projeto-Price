import type { jsPDF } from "jspdf";
import { avaliarColunas, type ValoresNativos } from "@/lib/parametros/avaliador";
import { formatarColuna, type ColunaRenderizavel } from "@/lib/desempenho/colunas-configuradas";
import type { ConfigRelatorio } from "@/lib/parametros/types";

/**
 * PDF por Loja do Compra e Venda — substitui a planilha que o time montava à
 * mão (`docs/exemplos-pdf`, pedido de 2026-10-02): Total da rede no formato
 * escolhido, depois um bloco por Loja, cada um com as mesmas colunas
 * configuradas na tela (`colunasDoRelatorio`) e os dois subtotais de sempre —
 * com e sem "Apropriações" (departamento contábil, sem produto/venda de
 * verdade, sinalizado em `DepartamentoCadastro.excluirDoTotalPrincipal`).
 *
 * Bem mais simples que `pdf-comprador.ts` de propósito (pedido de 2026-10-02:
 * "não precisa destrinchar") — uma tabela por bloco, sem seções, sem
 * priorização. Reaproveita o motor de colunas (`avaliarColunas`) pra nunca
 * divergir dos números da tela.
 */

type RGB = [number, number, number];

const AZUL: RGB = [0, 76, 151];
const VERMELHO: RGB = [227, 0, 0];
const PRETO = "#18181b";
const CINZA = "#52525b";
const CINZA_CLARO = "#a1a1aa";
const LINHA: RGB = [228, 228, 231];
const ZEBRA: RGB = [247, 248, 250];
const SUBTOTAL_FUNDO: RGB = [231, 238, 246];
const APROPRIACOES_FUNDO: RGB = [244, 244, 245];

const LARGURA = 297; // A4 paisagem
const MARGEM_X = 12;
const UTIL = LARGURA - MARGEM_X * 2;
const TOPO = 30;
const RODAPE = 192;
const LARGURA_DEPARTAMENTO = 54;

/** Mesmo motivo de `pdf-comprador.ts`: a fonte padrão do jsPDF não tem travessão
 * nem sinal de menos tipográfico. */
function t(texto: string): string {
  return texto
    .replace(/[‒-―−]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, "...");
}

function tt(linhas: string[][]): string[][] {
  return linhas.map((linha) => linha.map(t));
}

/** Um nó de Departamento já pronto pra virar linha — mesmo shape que
 * `agregarDepartamento` devolve (ver `lib/entradas-saidas/aggregate.ts`). */
export interface DepartamentoPdfLoja {
  codigo: string | null;
  nome: string;
  valores: ValoresNativos;
}

export interface BlocoPdfLoja {
  titulo: string;
  departamentos: DepartamentoPdfLoja[];
}

export interface DadosPdfLoja {
  formato: string;
  periodo: string;
  geradoEm: Date;
  config: ConfigRelatorio;
  colunas: ColunaRenderizavel[];
  /** Códigos de Departamento marcados "excluir do total principal". */
  departamentosExcluidos: Set<string>;
  total: BlocoPdfLoja;
  porLoja: BlocoPdfLoja[];
}

// ---------------------------------------------------------------------------
// Heatmap — mesma régua de `components/desempenho/CelulaMetrica.tsx`, em RGB
// ---------------------------------------------------------------------------

const HEATMAP_SATURACAO_PP = 20;

function hslParaRgb(h: number, s: number, l: number): RGB {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

function corHeatmap(valor: number, invertido: boolean): RGB {
  const tNorm = Math.max(-1, Math.min(1, valor / HEATMAP_SATURACAO_PP));
  const intensidade = Math.abs(tNorm);
  const positivoEhVerde = !invertido;
  const ehVerde = tNorm >= 0 ? positivoEhVerde : !positivoEhVerde;
  const matiz = ehVerde ? 120 : 0;
  const luminosidade = 90 - intensidade * 30;
  return hslParaRgb(matiz, 70, luminosidade);
}

// ---------------------------------------------------------------------------
// Moldura: marca, cabeçalho e rodapé
// ---------------------------------------------------------------------------

function marca(doc: jsPDF, x: number, y: number, tamanho: number): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(tamanho);
  doc.setTextColor(...AZUL);
  doc.text("MAX", x, y);
  const largura = doc.getTextWidth("MAX");
  doc.setFontSize(tamanho * 0.42);
  doc.setTextColor(...VERMELHO);
  doc.text("SUPERMERCADOS", x + largura + 1.3, y);
  const total = largura + 1.3 + doc.getTextWidth("SUPERMERCADOS");
  doc.setFont("helvetica", "normal");
  return total;
}

/** Cabeçalho + rodapé em toda página, desenhados no fim (pedido de 2026-10-02:
 * documento simples, uma passada só) — mesma ideia de `pdf-comprador.ts` >
 * `moldura`, sem a complexidade de seções/cores por parte do relatório. */
function moldura(doc: jsPDF, dados: DadosPdfLoja): void {
  const total = doc.getNumberOfPages();
  for (let pagina = 1; pagina <= total; pagina++) {
    doc.setPage(pagina);

    const largura = marca(doc, MARGEM_X, 14, 13);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...AZUL);
    doc.text(t(`Compra e Venda por Loja — ${dados.formato}`), MARGEM_X + largura + 6, 14);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(CINZA);
    doc.text(t(dados.periodo), LARGURA - MARGEM_X, 14, { align: "right" });

    doc.setLineWidth(0.8);
    doc.setDrawColor(...VERMELHO);
    doc.line(MARGEM_X, 18, MARGEM_X + 22, 18);
    doc.setDrawColor(...AZUL);
    doc.line(MARGEM_X + 22, 18, LARGURA - MARGEM_X, 18);

    doc.setLineWidth(0.3);
    doc.setDrawColor(...VERMELHO);
    doc.line(MARGEM_X, RODAPE, MARGEM_X + 22, RODAPE);
    doc.setDrawColor(...LINHA);
    doc.line(MARGEM_X + 22, RODAPE, LARGURA - MARGEM_X, RODAPE);
    const larguraRodape = marca(doc, MARGEM_X, RODAPE + 5, 7);
    doc.setFontSize(6.2);
    doc.setTextColor(CINZA_CLARO);
    doc.text(
      t(
        `Inteligência de Mercado · Compra e Venda por Loja · ${dados.formato} · ${dados.periodo} · ` +
          `gerado em ${dados.geradoEm.toLocaleString("pt-BR")} · metas conforme o cadastro de Parâmetros na data de geração`,
      ),
      MARGEM_X + larguraRodape + 3,
      RODAPE + 5,
    );
    doc.setFontSize(6.6);
    doc.setTextColor(CINZA);
    doc.text(`${pagina} / ${total}`, LARGURA - MARGEM_X, RODAPE + 5, { align: "right" });
  }
}

// ---------------------------------------------------------------------------
// Dados → linha de tabela
// ---------------------------------------------------------------------------

/** Soma os nativos de uma lista de departamentos, sem somar "Meta" — meta é um
 * percentual, não dá pra somar (ver `linha(...)` abaixo, que pondera à parte). */
function somarNativosSemMeta(departamentos: DepartamentoPdfLoja[]): ValoresNativos {
  const resultado: ValoresNativos = {};
  for (const d of departamentos) {
    for (const [ref, valor] of Object.entries(d.valores)) {
      if (ref === "Meta") continue;
      resultado[ref] = (resultado[ref] ?? 0) + valor;
    }
  }
  return resultado;
}

/** Meta do bloco: média ponderada pela Venda de cada Departamento que TEM meta
 * (mesmo espírito de `lib/compra-venda/aggregate.ts` > `metaTotalPonderada`,
 * só que local ao bloco — cada Departamento já chega com a própria Meta
 * injetada, então pesar pela Venda dele aqui dá o mesmo resultado). */
function metaPonderadaDoBloco(departamentos: DepartamentoPdfLoja[]): number | undefined {
  let peso = 0;
  let soma = 0;
  for (const d of departamentos) {
    const meta = d.valores.Meta;
    const venda = d.valores.Valor ?? 0;
    if (meta === undefined || venda <= 0) continue;
    peso += venda;
    soma += meta * venda;
  }
  return peso > 0 ? soma / peso : undefined;
}

function linhaDaColuna(config: ConfigRelatorio, colunas: ColunaRenderizavel[], atual: ValoresNativos): string[] {
  const valores = avaliarColunas(config, { atual, comparacao: null });
  return colunas.map((c) => formatarColuna(c, valores[c.ref] ?? null));
}

// ---------------------------------------------------------------------------
// Tabela de um bloco (Total da rede, ou uma Loja)
// ---------------------------------------------------------------------------

type AutoTable = (doc: jsPDF, opcoes: Record<string, unknown>) => void;

/** Uma tabela por página, sempre — nunca duas tabelas na mesma página mesmo
 * quando a anterior é curta (pedido de 2026-10-02). `primeiroBloco` pula o
 * `addPage()` porque a primeira página já existe (criada pelo `new JsPdf()`). */
function tabelaBloco(
  doc: jsPDF,
  autoTable: AutoTable,
  dados: DadosPdfLoja,
  bloco: BlocoPdfLoja,
  primeiroBloco: boolean,
): void {
  if (!primeiroBloco) doc.addPage();
  let y = TOPO;

  doc.setFillColor(...AZUL);
  doc.rect(MARGEM_X, y - 4.4, 1.6, 6, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...AZUL);
  doc.text(t(bloco.titulo), MARGEM_X + 4, y);
  y += 9 - 4;

  const { config, colunas, departamentosExcluidos } = dados;
  // Ordenado por código de Departamento (pedido de 2026-10-02) — só pra ordem
  // das linhas, o código em si nunca aparece na tabela (só o nome).
  const departamentosOrdenados = [...bloco.departamentos].sort((a, b) => (a.codigo ?? "zzz").localeCompare(b.codigo ?? "zzz"));
  const incluidos = departamentosOrdenados.filter((d) => !d.codigo || !departamentosExcluidos.has(d.codigo));
  const excluidos = departamentosOrdenados.filter((d) => d.codigo && departamentosExcluidos.has(d.codigo));

  const linhas = incluidos.map((d) => [d.nome, ...linhaDaColuna(config, colunas, d.valores)]);

  const temExclusao = excluidos.length > 0 && (excluidos.reduce((s, d) => s + (d.valores.Compras ?? 0) + (d.valores.Valor ?? 0), 0) > 0);

  const linhaTotalSemApropriacoes = [
    temExclusao ? "Total s/ Apropriações" : "Total",
    ...linhaDaColuna(config, colunas, {
      ...somarNativosSemMeta(incluidos),
      ...(metaPonderadaDoBloco(incluidos) !== undefined ? { Meta: metaPonderadaDoBloco(incluidos)! } : {}),
    }),
  ];

  const corpo = [...linhas, linhaTotalSemApropriacoes];
  const indiceSubtotal = linhas.length;
  let indiceApropriacoes = -1;
  let indiceTotalComApropriacoes = -1;

  if (temExclusao) {
    const nativosExcluidos = somarNativosSemMeta(excluidos);
    // Linha "Apropriações": só os valores nativos (Compra/Venda) — colunas
    // calculadas (% Compra/Venda, Meta, GAP R$...) não fazem sentido pra um
    // departamento contábil, então ficam em branco (não são refs nativos, nunca
    // existem em `nativosExcluidos`).
    indiceApropriacoes = corpo.length;
    corpo.push([
      excluidos.map((d) => d.nome).join(", "),
      // Zero vira branco aqui (não "R$ 0"): departamento contábil não tem Venda
      // de verdade, e um zero explícito confundiria com "vendeu zero".
      ...colunas.map((c) => formatarColuna(c, nativosExcluidos[c.ref] || null)),
    ]);

    indiceTotalComApropriacoes = corpo.length;
    corpo.push([
      "Total c/ Apropriações",
      ...linhaDaColuna(config, colunas, {
        ...somarNativosSemMeta(bloco.departamentos),
        ...(metaPonderadaDoBloco(bloco.departamentos) !== undefined
          ? { Meta: metaPonderadaDoBloco(bloco.departamentos)! }
          : {}),
      }),
    ]);
  }

  const larguraColuna = (UTIL - LARGURA_DEPARTAMENTO) / colunas.length;
  const columnStyles: Record<number, Record<string, unknown>> = {
    0: { halign: "left", cellWidth: LARGURA_DEPARTAMENTO },
  };
  colunas.forEach((_, i) => {
    columnStyles[i + 1] = { halign: "right", cellWidth: larguraColuna };
  });

  autoTable(doc, {
    startY: y,
    theme: "grid",
    head: tt([["Departamento", ...colunas.map((c) => c.rotulo)]]),
    body: tt(corpo),
    headStyles: { fillColor: AZUL, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7.4 },
    bodyStyles: { textColor: PRETO },
    alternateRowStyles: { fillColor: ZEBRA },
    styles: { fontSize: 7.6, cellPadding: 1.3, lineColor: LINHA, lineWidth: 0.1, overflow: "linebreak" },
    columnStyles,
    margin: { left: MARGEM_X, right: MARGEM_X, top: TOPO, bottom: 20 },
    didParseCell: (d: {
      section: string;
      row: { index: number };
      column: { index: number };
      cell: { styles: Record<string, unknown>; text: string[] };
    }) => {
      // `columnStyles` sozinho não vence `headStyles` no cabeçalho (autoTable
      // aplica headStyles por cima) — sem isso o título fica à esquerda e o
      // dado à direita, cada um num ponto diferente. Mesma régua de
      // `pdf-comprador.ts` > `Coluna.alinhar`.
      if (d.section === "head") {
        d.cell.styles.halign = d.column.index === 0 ? "left" : "right";
        return;
      }
      if (d.section !== "body") return;
      if (d.row.index === indiceSubtotal || d.row.index === indiceTotalComApropriacoes) {
        d.cell.styles.fillColor = SUBTOTAL_FUNDO;
        d.cell.styles.textColor = AZUL;
        d.cell.styles.fontStyle = "bold";
        return;
      }
      if (d.row.index === indiceApropriacoes) {
        d.cell.styles.fillColor = APROPRIACOES_FUNDO;
        d.cell.styles.textColor = CINZA;
        return;
      }
      // Heatmap por coluna (ex.: "Meta - Realizado") — mesma régua da tela.
      if (d.column.index === 0) return;
      const coluna = colunas[d.column.index - 1];
      if (!coluna?.heatmap) return;
      const departamento = incluidos[d.row.index];
      if (!departamento) return;
      const valores = avaliarColunas(config, { atual: departamento.valores, comparacao: null });
      const valor = valores[coluna.ref];
      if (valor === null || valor === undefined) return;
      d.cell.styles.fillColor = corHeatmap(valor, coluna.heatmapInvertido);
    },
  });
}

// ---------------------------------------------------------------------------
// Montagem
// ---------------------------------------------------------------------------

export async function gerarPdfPorLoja(dados: DadosPdfLoja): Promise<Uint8Array> {
  const { jsPDF: JsPdf } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default as unknown as AutoTable;

  const doc = new JsPdf({ orientation: "landscape", unit: "mm", format: "a4" });

  tabelaBloco(doc, autoTable, dados, dados.total, true);
  for (const bloco of dados.porLoja) tabelaBloco(doc, autoTable, dados, bloco, false);

  moldura(doc, dados);
  return new Uint8Array(doc.output("arraybuffer") as ArrayBuffer);
}
