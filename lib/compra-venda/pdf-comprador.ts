import type { jsPDF } from "jspdf";
import type {
  BlocoDepartamento,
  LinhaProduto,
  MotivoAnexo,
  NoCascata,
  NoLojaPrioridade,
  ResumoComprador,
} from "./priorizacao";
import { dde, ddeCalculado, margem, percentualCompraVenda, somarMetricas } from "./priorizacao";
import type { LojaCadastro } from "@/lib/parametros/types";

/**
 * PDF por Comprador do Compra e Venda — o que ele deve tratar neste período, em
 * ordem de relevância em dinheiro, de Departamento até Produto e Loja.
 *
 * Roda no **servidor** (`app/api/compra-venda/pdf-comprador/route.ts`), ao
 * contrário de `lib/desempenho/export.ts`, que é client-side: ali o PDF é um
 * retrato da tela aberta; aqui são ~10 relatórios de uma vez, cada um com um
 * recorte diferente do dataset — mandar isso pro navegador significaria mandar
 * o dado bruto junto, que é exatamente o que o CLAUDE.md proíbe.
 *
 * Toda a análise está em `priorizacao.ts`; este arquivo só desenha.
 *
 * ## Como o documento é montado (decisão de 2026-10-02)
 *
 * O relatório sai da plataforma e vai pro e-mail do time, então ele precisa se
 * explicar sozinho e ter sempre a mesma cara. Três regras sustentam isso:
 *
 * 1. **Toda página tem a mesma moldura** — marca e seção no topo, contexto
 *    (comprador · formato · período) à direita, rodapé com origem do dado e
 *    numeração. Desenhada de uma vez no fim (`moldura`), porque o autoTable
 *    quebra página sozinho e não dá pra saber antes quantas páginas cada tabela
 *    vai ocupar.
 * 2. **Cada seção tem uma cor** e ela aparece na régua do topo, no cabeçalho das
 *    tabelas e na tarja do título — dá pra saber em que parte do relatório se
 *    está sem ler uma palavra.
 * 3. **A ordem é sempre a mesma** em todo formato: visão geral → onde cortar →
 *    risco de ruptura → transferência → anexos. Ver `SECOES`.
 */

// ---------------------------------------------------------------------------
// Sistema visual
// ---------------------------------------------------------------------------

type RGB = [number, number, number];

/** Cores da marca — `docs/padroes-ux.md`. Verde não é cor de marca, é semáforo. */
const AZUL: RGB = [0, 76, 151];
const VERMELHO: RGB = [227, 0, 0];
const VERDE: RGB = [30, 158, 98];
const GRAFITE: RGB = [63, 63, 70];

const PRETO = "#18181b";
const CINZA = "#52525b";
const CINZA_CLARO = "#a1a1aa";
const LINHA: RGB = [228, 228, 231];
const ZEBRA: RGB = [247, 248, 250];
/** Fundo das linhas que exigem atenção (acima da meta). */
const ALERTA_FUNDO: RGB = [254, 242, 242];
/** Fundo das linhas de detalhe (lojas sob um produto). */
const DETALHE_FUNDO: RGB = [250, 250, 250];
/** Fundo da linha de subtotal — a cor da seção bem clara. */
const SUBTOTAL_FUNDO: RGB = [231, 238, 246];

const LARGURA = 297; // A4 paisagem
const ALTURA = 210;
const MARGEM_X = 12;
const UTIL = LARGURA - MARGEM_X * 2;

/** Onde o conteúdo começa em toda página — abaixo da moldura do topo. */
const TOPO = 27;
/** Régua do rodapé; o conteúdo nunca passa daqui. */
const RODAPE = 192;

/** Cada seção do relatório, com a cor que a identifica da capa ao rodapé. */
const SECOES = {
  capa: { nome: "Capa", cor: AZUL },
  legenda: { nome: "Como ler este relatório", cor: GRAFITE },
  visao: { nome: "Visão geral", cor: AZUL },
  cortar: { nome: "Onde cortar", cor: AZUL },
  ruptura: { nome: "Risco de ruptura", cor: VERMELHO },
  transferencia: { nome: "Transferência entre lojas", cor: VERDE },
  anexos: { nome: "Anexos", cor: GRAFITE },
} as const;
type Secao = keyof typeof SECOES;

export interface DadosPdfComprador {
  comprador: string;
  /** Normalmente um Formato só por arquivo (decisão de 2026-10-02: o time
   * trabalha Varejo e Atacado separados). Continua array porque a montagem
   * aceita mais de um, mas a capa e o título assumem um quando é um. */
  porFormato: ResumoComprador[];
  periodo: string;
  lojas: LojaCadastro[];
  geradoEm: Date;
}

// ---------------------------------------------------------------------------
// Formatação de texto
// ---------------------------------------------------------------------------

/**
 * As fontes padrão do jsPDF (Helvetica/WinAnsi) não têm travessão nem sinal de
 * menos tipográfico: `—` sai como aspas e `−` some, confirmado no PDF gerado em
 * 2026-10-01. Como o relatório sai da plataforma e vai pro e-mail de gente que
 * não tem como pedir a correção, tudo que é desenhado passa por aqui — inclusive
 * nome de produto, que vem do ERP e um dia pode trazer caractere de fora da
 * tabela. Embutir uma fonte Unicode resolveria também, mas custa ~300KB em cada
 * um dos ~10 arquivos, por 4 caracteres.
 */
function t(texto: string): string {
  return texto
    .replace(/[‒-―−]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, "...")
    .replace(/ /g, " ");
}

function tt(linhas: string[][]): string[][] {
  return linhas.map((linha) => linha.map(t));
}

const VAZIO = "-";

function brl(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return VAZIO;
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function pct(valor: number | null): string {
  if (valor === null || !Number.isFinite(valor)) return VAZIO;
  return `${(valor * 100).toFixed(1)}%`;
}

function pp(realizado: number | null, meta: number | null): string {
  if (realizado === null || meta === null) return VAZIO;
  const diferenca = (realizado - meta) * 100;
  return `${diferenca > 0 ? "+" : ""}${diferenca.toFixed(1)}`;
}

function dias(valor: number | null): string {
  return valor === null || !Number.isFinite(valor) ? VAZIO : valor.toFixed(0);
}

/** Quantidade com sinal, para "Comprou a mais": "+6.111", "-172", "0". A
 * unidade é a do produto — unidade, quilo, pacote —, por isso o número aparece
 * sem sufixo e a legenda avisa que não se soma entre produtos diferentes. */
function unidades(valor: number | null): string {
  if (valor === null || !Number.isFinite(valor)) return VAZIO;
  const inteiro = Math.round(valor);
  return (inteiro > 0 ? "+" : "") + inteiro.toLocaleString("pt-BR");
}

const ROTULO_MOTIVO: Record<MotivoAnexo, string> = {
  lancamento: "compra sem venda no período",
  precoIncoerente: "preço de compra acima de 2× o de venda",
  margemNegativa: "margem abaixo de −15%",
  quantidadeDesproporcional: "comprou mais de 20× o que vendeu (1ª carga ou unidade errada no cadastro)",
};

// ---------------------------------------------------------------------------
// Moldura: marca, cabeçalho e rodapé iguais em toda página
// ---------------------------------------------------------------------------

/** Assinatura tipográfica da MAX — "MAX" em azul, "SUPERMERCADOS" em vermelho,
 * como na logo (`docs/padroes-ux.md`). Não há arquivo de logo no projeto, e
 * embutir imagem em 10 PDFs custaria peso por página sem ganho de leitura. */
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

/** Em que seção está cada página. O autoTable quebra página sozinho, então a
 * moldura só pode ser desenhada no fim — e aí precisa saber a que seção cada
 * página pertence. Páginas criadas pelo autoTable herdam a última marcada. */
type RegistroPaginas = Map<number, { secao: Secao; contexto: string }>;

function marcarPagina(doc: jsPDF, registro: RegistroPaginas, secao: Secao, contexto: string): void {
  registro.set(doc.getCurrentPageInfo().pageNumber, { secao, contexto });
}

function moldura(doc: jsPDF, dados: DadosPdfComprador, registro: RegistroPaginas): void {
  const total = doc.getNumberOfPages();
  let atual = { secao: "capa" as Secao, contexto: "" };
  for (let pagina = 1; pagina <= total; pagina++) {
    atual = registro.get(pagina) ?? atual;
    const { cor, nome } = SECOES[atual.secao];
    doc.setPage(pagina);

    // --- topo: marca | seção | contexto, fechado por uma régua da cor da seção
    if (pagina > 1) {
      const largura = marca(doc, MARGEM_X, 14, 10);
      doc.setDrawColor(...LINHA);
      doc.setLineWidth(0.3);
      doc.line(MARGEM_X + largura + 5, 10.5, MARGEM_X + largura + 5, 15);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...cor);
      doc.text(t(nome), MARGEM_X + largura + 9, 14);
      doc.setFont("helvetica", "normal");

      doc.setFontSize(7);
      doc.setTextColor(CINZA);
      doc.text(t(atual.contexto), LARGURA - MARGEM_X, 14, { align: "right" });

      // A régua começa em vermelho e segue na cor da seção — a mesma dupla da
      // logo, repetida em toda página sem roubar espaço de conteúdo.
      doc.setLineWidth(0.8);
      doc.setDrawColor(...VERMELHO);
      doc.line(MARGEM_X, 18, MARGEM_X + 22, 18);
      doc.setDrawColor(...cor);
      doc.line(MARGEM_X + 22, 18, LARGURA - MARGEM_X, 18);
    }

    // --- rodapé: origem do dado à esquerda, página à direita
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
        `Inteligência de Mercado · Compra e Venda · ${dados.comprador} · ${dados.periodo} · ` +
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
// Blocos de texto
// ---------------------------------------------------------------------------

type AutoTable = (doc: jsPDF, opcoes: Record<string, unknown>) => void;

function ultimoY(doc: jsPDF): number {
  return (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? TOPO;
}

function cabeNaPagina(y: number, altura: number): boolean {
  return y + altura < RODAPE - 4;
}

/** Título de bloco com tarja da cor da seção à esquerda — a tarja é o que faz o
 * olho achar o começo de cada parte sem precisar ler. */
function tituloBloco(doc: jsPDF, texto: string, y: number, cor: RGB, tamanho = 11): number {
  doc.setFillColor(...cor);
  doc.rect(MARGEM_X, y - 3.4, 1.6, 4.6, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(tamanho);
  doc.setTextColor(...cor);
  doc.text(t(texto), MARGEM_X + 4, y);
  doc.setFont("helvetica", "normal");
  return y + tamanho * 0.42 + 2.4;
}

function subtitulo(doc: jsPDF, texto: string, y: number, tamanho = 8.5): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(tamanho);
  doc.setTextColor(PRETO);
  doc.text(t(texto), MARGEM_X, y);
  doc.setFont("helvetica", "normal");
  return y + tamanho * 0.42 + 1.6;
}

function paragrafo(doc: jsPDF, texto: string, y: number, cor: string = CINZA, tamanho = 7.6, recuo = 0): number {
  doc.setFontSize(tamanho);
  doc.setTextColor(cor);
  const linhas = doc.splitTextToSize(t(texto), UTIL - recuo);
  doc.text(linhas, MARGEM_X + recuo, y);
  return y + linhas.length * (tamanho * 0.45) + 2.2;
}

/** Faixa de indicadores — rótulo pequeno em cima, número grande embaixo, cada um
 * na sua caixa. Sempre no mesmo lugar e na mesma ordem em todo formato. */
function faixaIndicadores(
  doc: jsPDF,
  y: number,
  itens: { rotulo: string; valor: string; destaque?: boolean }[],
): number {
  const altura = 15;
  const vao = 2.5;
  const largura = (UTIL - vao * (itens.length - 1)) / itens.length;
  itens.forEach((item, i) => {
    const x = MARGEM_X + i * (largura + vao);
    doc.setFillColor(item.destaque ? 254 : 249, item.destaque ? 242 : 250, item.destaque ? 242 : 251);
    doc.setDrawColor(...(item.destaque ? VERMELHO : LINHA));
    doc.setLineWidth(item.destaque ? 0.4 : 0.2);
    doc.roundedRect(x, y, largura, altura, 1.2, 1.2, "FD");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.2);
    doc.setTextColor(CINZA);
    doc.text(t(item.rotulo.toUpperCase()), x + largura / 2, y + 5, { align: "center" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(item.destaque ? "#b91c1c" : PRETO);
    doc.text(t(item.valor), x + largura / 2, y + 11.6, { align: "center" });
    doc.setFont("helvetica", "normal");
  });
  return y + altura + 7;
}

// ---------------------------------------------------------------------------
// Tabela — um único desenho para o relatório inteiro
// ---------------------------------------------------------------------------

interface Coluna {
  titulo: string;
  largura?: number;
  /** O título da coluna recebe o MESMO alinhamento da célula (pedido de
   * 2026-10-02). ⚠️ Pôr `halign` só em `columnStyles` **não** basta: o
   * autoTable aplica `headStyles` por cima no cabeçalho, e o título ficava à
   * esquerda com o número à direita (confirmado no PDF gerado). O alinhamento
   * do cabeçalho é forçado em `didParseCell`, ver `tabela()`. */
  alinhar?: "left" | "right" | "center";
  negrito?: boolean;
  cor?: RGB;
  /** Cor por célula, decidida pelo conteúdo — ex.: TRANSFERIR em verde e o
   * resto em vermelho na coluna Causa. Ganha de `cor`. */
  corDaCelula?: (texto: string) => RGB | null;
}

function tabela(
  doc: jsPDF,
  autoTable: AutoTable,
  opcoes: {
    y: number;
    cor: RGB;
    colunas: Coluna[];
    linhas: string[][];
    fonte?: number;
    /** Linhas que pedem atenção — ganham fundo de alerta. */
    alertar?: (indice: number) => boolean;
    /** Linhas de detalhe (lojas sob um produto) — menores e esmaecidas. */
    detalhe?: Set<number>;
    /**
     * Linha de soma, desenhada como **primeira** linha da tabela (padrão do
     * Desempenho Comercial, `docs/padroes-ux.md`) — no fim ela sumiria abaixo da
     * dobra nas tabelas longas, e o número que fecha a conta é o primeiro que se
     * procura. Entra só quando há mais de uma linha de dado: com uma só, o
     * subtotal repetiria a linha.
     *
     * ⚠️ Quem monta passa a linha já calculada, porque percentual e DDE do
     * subtotal precisam ser recalculados das parcelas somadas — ver
     * `somarMetricas` em priorizacao.ts.
     */
    subtotal?: string[];
  },
): number {
  const fonte = opcoes.fonte ?? 7;

  // Largura fixa somando mais que a página faz o autoTable espremer tudo, e aí o
  // alinhamento com o título se perde sem ninguém perceber — avisa alto em vez
  // de sair torto no e-mail do time.
  const fixas = opcoes.colunas.reduce((total, c) => total + (c.largura ?? 0), 0);
  if (fixas > UTIL) {
    console.warn(
      `PDF por Comprador: colunas [${opcoes.colunas.map((c) => c.titulo).join(", ")}] somam ${fixas}mm, acima dos ${UTIL}mm da página.`,
    );
  }

  const columnStyles: Record<number, Record<string, unknown>> = {};
  opcoes.colunas.forEach((c, i) => {
    columnStyles[i] = {
      halign: c.alinhar ?? "left",
      ...(c.largura ? { cellWidth: c.largura } : {}),
      ...(c.negrito ? { fontStyle: "bold" } : {}),
      ...(c.cor ? { textColor: c.cor } : {}),
    };
  });

  // Subtotal entra como primeira linha; os índices de alerta/detalhe que quem
  // chamou calculou sobre `linhas` deslocam um.
  const temSubtotal = Boolean(opcoes.subtotal) && opcoes.linhas.length > 1;
  const corpo = temSubtotal ? [opcoes.subtotal!, ...opcoes.linhas] : opcoes.linhas;
  const desloca = temSubtotal ? 1 : 0;

  autoTable(doc, {
    startY: opcoes.y,
    theme: "grid",
    head: tt([opcoes.colunas.map((c) => c.titulo)]),
    body: tt(corpo),
    headStyles: { fillColor: opcoes.cor, textColor: [255, 255, 255], fontStyle: "bold", fontSize: fonte - 0.6 },
    bodyStyles: { textColor: PRETO },
    alternateRowStyles: { fillColor: ZEBRA },
    styles: { fontSize: fonte, cellPadding: 1.3, lineColor: LINHA, lineWidth: 0.1, overflow: "linebreak" },
    columnStyles,
    margin: { left: MARGEM_X, right: MARGEM_X, top: TOPO, bottom: ALTURA - RODAPE + 4 },
    didParseCell: (dados: {
      section: string;
      row: { index: number };
      column: { index: number };
      cell: { styles: Record<string, unknown>; text: string[] };
    }) => {
      const coluna = opcoes.colunas[dados.column.index];
      // Cabeçalho alinhado com o dado — tem que ser aqui, `columnStyles` não
      // vence `headStyles` no cabeçalho. Ver comentário em `Coluna.alinhar`.
      if (dados.section === "head") {
        dados.cell.styles.halign = coluna?.alinhar ?? "left";
        return;
      }
      if (dados.section !== "body") return;
      if (temSubtotal && dados.row.index === 0) {
        dados.cell.styles.fillColor = SUBTOTAL_FUNDO;
        dados.cell.styles.textColor = opcoes.cor;
        dados.cell.styles.fontStyle = "bold";
        return;
      }
      const indice = dados.row.index - desloca;
      if (opcoes.detalhe?.has(indice)) {
        dados.cell.styles.fontSize = fonte - 0.7;
        dados.cell.styles.textColor = CINZA;
        dados.cell.styles.fillColor = DETALHE_FUNDO;
        return;
      }
      if (opcoes.alertar?.(indice)) dados.cell.styles.fillColor = ALERTA_FUNDO;
      const cor = coluna?.corDaCelula?.(dados.cell.text.join(" "));
      if (cor) dados.cell.styles.textColor = cor;
    },
  });
  return ultimoY(doc) + 4;
}

/** Nome amigável da loja; cai no código quando a loja não está no cadastro. */
function nomeLoja(lojas: LojaCadastro[], codigo: string): string {
  return lojas.find((l) => l.codigo === codigo)?.nomeCustomizado ?? codigo;
}

/** Lojas com os dias de cobertura entre parênteses. Sem DDE (produto sem venda
 * média diária no ERP), sai só o nome — "(-d)" não quer dizer nada. */
function linhaLojas(lojas: LojaCadastro[], nos: NoLojaPrioridade[]): string {
  return nos
    .slice(0, 5)
    .map((no) => {
      const nome = nomeLoja(lojas, no.lojaCodigo);
      return no.dde === null || !Number.isFinite(no.dde) ? nome : `${nome} (${dias(no.dde)}d)`;
    })
    .join(", ");
}

// ---------------------------------------------------------------------------
// Seções do relatório
// ---------------------------------------------------------------------------

/** Os produtos de maior GAP de todo o relatório, em qualquer formato — alimenta
 * o destaque da capa. */
function maioresGaps(dados: DadosPdfComprador): { formato: string; produto: LinhaProduto }[] {
  return dados.porFormato
    .flatMap((r) =>
      r.departamentos
        .flatMap((d) => [...d.produtos, ...d.filhos.flatMap((s) => [...s.produtos, ...s.filhos.flatMap((c) => c.produtos)])])
        .map((produto) => ({ formato: r.formato, produto })),
    )
    .sort((a, b) => b.produto.gap - a.produto.gap);
}

/** Capa: quem, quando, o tamanho de cada formato e o roteiro do documento. */
function capa(doc: jsPDF, autoTable: AutoTable, dados: DadosPdfComprador): void {
  doc.setFillColor(...AZUL);
  const alturaFaixa = dados.porFormato.length === 1 ? 50 : 46;
  doc.rect(0, 0, LARGURA, alturaFaixa, "F");
  // Filete vermelho fechando a faixa azul: azul + vermelho é a assinatura da MAX.
  doc.setFillColor(...VERMELHO);
  doc.rect(0, alturaFaixa, LARGURA, 2.2, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  doc.text("MAX", MARGEM_X, 20);
  const largura = doc.getTextWidth("MAX");
  doc.setFontSize(8);
  doc.setTextColor(255, 190, 190);
  doc.text("SUPERMERCADOS", MARGEM_X + largura + 2.5, 20);

  // Um arquivo por Formato desde 2026-10-02, então o formato é parte da
  // identidade do documento e vem antes do nome, em caixa alta.
  const formatoUnico = dados.porFormato.length === 1 ? dados.porFormato[0].formato : null;
  if (formatoUnico) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(255, 190, 190);
    doc.text(t(formatoUnico.toUpperCase()), MARGEM_X, 30);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(19);
  doc.setTextColor(255, 255, 255);
  doc.text(t(`Compra e Venda — ${dados.comprador}`), MARGEM_X, formatoUnico ? 38 : 34);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(205, 222, 240);
  doc.text(t(`${dados.periodo}   ·   o que tratar, em ordem de relevância`), MARGEM_X, formatoUnico ? 44 : 41);

  let y = dados.porFormato.length === 1 ? 62 : 58;
  y = tituloBloco(doc, "Seu período em uma linha", y, AZUL, 11);
  y = tabela(doc, autoTable, {
    y,
    cor: AZUL,
    fonte: 8,
    colunas: [
      { titulo: "Formato", largura: 34 },
      { titulo: "Venda", alinhar: "right" },
      { titulo: "Compra", alinhar: "right" },
      { titulo: "% C/V", alinhar: "right" },
      { titulo: "Meta", alinhar: "right" },
      { titulo: "Desvio (pp)", alinhar: "right" },
      { titulo: "GAP em R$", alinhar: "right", negrito: true },
    ],
    subtotal: (() => {
      const soma = somarMetricas(dados.porFormato);
      const gap = dados.porFormato.reduce((tot, r) => tot + r.gap, 0);
      // Meta do total é ponderada pela venda de cada formato — média simples de
      // percentual ignoraria que um formato é o dobro do outro.
      const pesoMeta = dados.porFormato.filter((r) => r.meta !== null).reduce((tot, r) => tot + r.metricas.venda, 0);
      const metaPond = dados.porFormato.filter((r) => r.meta !== null).reduce((tot, r) => tot + r.meta! * r.metricas.venda, 0);
      const meta = pesoMeta > 0 ? metaPond / pesoMeta : null;
      return [
        "Total",
        brl(soma.venda),
        brl(soma.compra),
        pct(percentualCompraVenda(soma)),
        pct(meta),
        pp(percentualCompraVenda(soma), meta),
        brl(gap),
      ];
    })(),
    linhas: dados.porFormato.map((r) => [
      r.formato,
      brl(r.metricas.venda),
      brl(r.metricas.compra),
      pct(percentualCompraVenda(r.metricas)),
      pct(r.meta),
      pp(percentualCompraVenda(r.metricas), r.meta),
      brl(r.gap),
    ]),
    alertar: (i) => dados.porFormato[i].gap > 0,
  });

  y += 3;
  y = tituloBloco(doc, "O que você vai encontrar, nesta ordem", y, AZUL, 11);
  const roteiro: [string, string][] = [
    ["Como ler este relatório", "as colunas novas, explicadas com um produto do seu próprio relatório"],
    ["Visão geral", "seus números do formato e todos os departamentos, em ordem de venda"],
    ["Onde cortar", "uma página por departamento acima da meta: seção, categoria, produto e loja"],
    ["Risco de ruptura", "itens em cobertura crítica nas lojas que mais vendem"],
    ["Transferência entre lojas", "o que sobra numa loja e falta em outra, do mesmo formato"],
    ["Anexos", "o que foi tirado da lista de propósito, e por quê"],
  ];
  roteiro.forEach(([nome, descricao], i) => {
    const linhaY = y + i * 6.2;
    doc.setFillColor(...AZUL);
    doc.circle(MARGEM_X + 2, linhaY - 1.1, 1.5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.4);
    doc.setTextColor(PRETO);
    doc.text(t(nome), MARGEM_X + 7, linhaY);
    const larguraNome = doc.getTextWidth(t(nome));
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.6);
    doc.setTextColor(CINZA);
    doc.text(t(`— ${descricao}`), MARGEM_X + 9 + larguraNome, linhaY);
  });
  y += roteiro.length * 6.2 + 4;

  // Os maiores itens já na capa: quem só abrir a primeira página sai sabendo
  // onde está o dinheiro, e o resto do documento é o caminho até eles.
  // Só entram as linhas que cabem na capa: uma sobrando vira uma página inteira
  // com uma linha só e o título "Capa" no topo (aconteceu em 2026-10-02).
  const cabem = Math.max(0, Math.floor((RODAPE - 6 - y - 7) / 7.2));
  const topo = maioresGaps(dados).slice(0, Math.min(6, cabem));
  if (topo.length > 0) {
    y = tituloBloco(doc, "Os itens que mais pesam, de todo o relatório", y, AZUL, 11);
    tabela(doc, autoTable, {
      y,
      cor: AZUL,
      fonte: 7.6,
      colunas: [
        ...(formatoUnico ? [] : [{ titulo: "Formato", largura: 24 }]),
        { titulo: "Código", largura: 18 },
        { titulo: "Produto", largura: formatoUnico ? 114 : 90 },
        { titulo: "Venda", alinhar: "right" },
        { titulo: "% C/V", alinhar: "right" },
        { titulo: "GAP R$", alinhar: "right", negrito: true },
        { titulo: "Comprou a mais", alinhar: "right" },
      ],
      subtotal: [
        ...(formatoUnico ? [] : [""]),
        "",
        `Soma dos ${topo.length} listados`,
        brl(somarMetricas(topo.map((x) => x.produto)).venda),
        pct(percentualCompraVenda(somarMetricas(topo.map((x) => x.produto)))),
        brl(topo.reduce((tot, x) => tot + x.produto.gap, 0)),
        VAZIO,
      ],
      linhas: topo.map(({ formato, produto }) => [
        ...(formatoUnico ? [] : [formato]),
        produto.codigo,
        produto.nome,
        brl(produto.metricas.venda),
        pct(percentualCompraVenda(produto.metricas)),
        brl(produto.gap),
        unidades(produto.metricas.qtdeCompras - produto.metricas.qtdeVendas),
      ]),
    });
  }
}

/**
 * Legenda — vai **antes** do conteúdo (decisão de 2026-10-02; estava no fim, que
 * é onde se põe nota de rodapé). O documento chega por e-mail, sem ninguém do
 * lado pra explicar, e vai ser relido.
 *
 * Cabe numa página só desde que a tabela de produtos foi enxugada pra oito
 * colunas: sobraram duas colunas novas pra explicar (GAP R$ e GAP Qtde) em vez
 * de seis. `exemplo` é um produto real do próprio relatório de quem vai ler.
 */
function legenda(doc: jsPDF, autoTable: AutoTable, exemplo: LinhaProduto | null): void {
  const cor = SECOES.legenda.cor;
  let y = TOPO;

  y = tituloBloco(doc, "Antes de começar", y, cor, 13);
  y = paragrafo(
    doc,
    "Este relatório não ordena por desvio percentual, e sim por dinheiro. Um desvio de 40 pontos numa categoria pequena " +
      "vale menos que 3 pontos numa grande — e é a grande que precisa ser tratada primeiro. Dentro do que está acima da " +
      "meta, a ordem é sempre de VENDA: trata-se primeiro o que mais pesa no faturamento.",
    y,
    PRETO,
    8.4,
  );
  y += 2;

  y = subtitulo(doc, "As colunas", y, 9);
  y = tabela(doc, autoTable, {
    y,
    cor,
    fonte: 8,
    colunas: [
      { titulo: "Coluna", largura: 28, negrito: true },
      { titulo: "Conta", largura: 56 },
      { titulo: "Como usar" },
    ],
    linhas: [
      [
        "% C/V",
        "Compra ÷ Venda do período",
        "O indicador de sempre, o mesmo da plataforma. Sozinho ele não diz tamanho: 130% numa categoria pequena pode valer menos que 102% numa grande.",
      ],
      [
        "GAP R$",
        "Compra - (Meta % × Venda)",
        "Quanto de compra passou do que a meta autorizava, em dinheiro. É o número da cobrança e é o que ordena o relatório inteiro. Soma: o GAP de uma categoria é a soma do GAP dos produtos dela, e o do departamento é a soma das categorias.",
      ],
      [
        "Comprou a mais",
        "unidades compradas - unidades vendidas",
        "Quantas unidades entraram a mais do que saíram no período, na unidade do produto (peça, quilo, pacote). Positivo quer dizer que o pedido veio maior que a venda e o estoque subiu; negativo quer dizer que você comprou menos do que vendeu e o estoque caiu — e aí, se o item ainda estourou a meta, o problema não é o pedido, é preço. Não aparece no subtotal de propósito: não se soma unidade de produtos diferentes, nem quilo com peça.",
      ],
      [
        "DDE",
        "Estoque no último dia ÷ Qtde Venda Média Diária",
        "Dias de cobertura. Os dois números vêm do sistema: o estoque é a foto do último dia do período e a venda média diária é a coluna do ERP, que cobre os 3 meses fechados. Pode diferir da tela de Sugestão de Compra, que divide pelos dias em que o item teve estoque — em item que ficou zerado, a cobertura aqui aparece mais folgada. Não aparece em Açougue, Hortifruti, Padaria Própria e Eletro, onde o estoque do sistema não descreve a prateleira. Acima de Produto é indicativo: soma quilos com unidades.",
      ],
    ],
  });

  if (exemplo && exemplo.causa) {
    y += 1;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(...LINHA);
    doc.setLineWidth(0.2);
    const linhasExemplo = doc.splitTextToSize(
      t(
        `No seu relatório: ${exemplo.codigo} ${exemplo.nome} vendeu ${brl(exemplo.metricas.venda)}, comprou ` +
          `${brl(exemplo.metricas.compra)} e fechou em ${pct(percentualCompraVenda(exemplo.metricas))} de % C/V. ` +
          `O GAP de ${brl(exemplo.gap)} tem ${brl(exemplo.causa.quantidade)} vindos de quantidade comprada a mais — ` +
          `o resto é preço.`,
      ),
      UTIL - 10,
    );
    const alturaCaixa = linhasExemplo.length * 4 + 6;
    doc.roundedRect(MARGEM_X, y - 1, UTIL, alturaCaixa, 1.2, 1.2, "FD");
    doc.setFontSize(8.4);
    doc.setTextColor(PRETO);
    doc.text(linhasExemplo, MARGEM_X + 5, y + 4.5);
    y += alturaCaixa + 3;
  }

  y = subtitulo(doc, "As contagens de SKU no fim de cada categoria", y, 9);
  y = paragrafo(
    doc,
    "São números diferentes e a conta fecha. «N na categoria» é tudo que existe ali, inclusive o que está dentro da meta e " +
      "não tem nada de errado. «N acima da meta» é o universo do problema. «N listados» são os que viraram linha, por " +
      "terem GAP de R$ 3.000 ou mais. «N pulverizados» são o restante dos que estão acima da meta, cada um abaixo de " +
      "R$ 3.000 — o GAP deles é somado e mostrado, para nenhuma conta fechar errado, mas eles não viram linha porque não " +
      "se trata 200 itens de R$ 400. Listados + pulverizados + fora da lista = acima da meta.",
    y,
    PRETO,
    8,
  );
  y += 1;

  y = subtitulo(doc, "O que foi tirado da lista de propósito", y, 9);
  paragrafo(
    doc,
    "Nada disso conta como trabalho de compra, e por isso não entra no GAP cobrado de você — mas vai nos Anexos, no fim, " +
      "para o relatório não parecer que deixou passar: itens cujo preço de compra passa de 2× o de venda (rateio de " +
      "desmembramento, insumo de produção); compras sem venda no período (1ª carga de lançamento); compras acima de 20× o " +
      "vendido (1ª carga ou unidade errada no cadastro); margem abaixo de -15%; e departamentos sem meta cadastrada.",
    y,
    PRETO,
    8,
  );
}

/** Visão geral do formato: indicadores e todos os departamentos. */
function visaoGeral(doc: jsPDF, autoTable: AutoTable, resumo: ResumoComprador): void {
  const m = resumo.metricas;
  let y = TOPO;
  y = tituloBloco(doc, `${resumo.formato} — visão geral`, y, SECOES.visao.cor, 13);

  y = faixaIndicadores(doc, y, [
    { rotulo: "Venda", valor: brl(m.venda) },
    { rotulo: "Compra", valor: brl(m.compra) },
    { rotulo: "% Compra/Venda", valor: pct(percentualCompraVenda(m)) },
    { rotulo: "Meta ponderada", valor: pct(resumo.meta) },
    { rotulo: "Desvio (pp)", valor: pp(percentualCompraVenda(m), resumo.meta) },
    { rotulo: "GAP em R$", valor: brl(resumo.gap), destaque: resumo.gap > 0 },
    { rotulo: "Margem", valor: pct(margem(m)) },
  ]);

  const frase =
    resumo.gap > 0
      ? `GAP em R$ = Compra − (Meta × Venda): é o quanto de compra passou do que a meta autorizava — ${brl(resumo.gap)}.`
      : `Compra dentro da meta no período (${brl(Math.abs(resumo.gap))} de folga). Não há corte a fazer — ` +
        `a atenção deste formato está no risco de ruptura, mais adiante.`;
  y = paragrafo(doc, frase, y, PRETO, 8);
  y += 2;

  y = tituloBloco(doc, "Departamentos — em ordem de venda", y, SECOES.visao.cor, 10);
  doc.setFontSize(6.8);
  doc.setTextColor(CINZA);
  doc.text(t("As linhas em vermelho estão acima da meta e têm página própria em «Onde cortar»."), MARGEM_X, y);
  y += 4;

  tabela(doc, autoTable, {
    y,
    cor: SECOES.visao.cor,
    fonte: 7.6,
    colunas: [
      { titulo: "Departamento", largura: 56 },
      { titulo: "Venda", alinhar: "right" },
      { titulo: "% part.", alinhar: "right" },
      { titulo: "Compra", alinhar: "right" },
      { titulo: "% C/V", alinhar: "right" },
      { titulo: "Meta", alinhar: "right" },
      { titulo: "Desvio (pp)", alinhar: "right" },
      { titulo: "GAP R$", alinhar: "right", negrito: true },
      { titulo: "Margem", alinhar: "right" },
      {
        titulo: "Situação",
        alinhar: "center",
        largura: 26,
        negrito: true,
        corDaCelula: (texto) => (texto.includes("TRATAR") ? VERMELHO : null),
      },
    ],
    subtotal: [
      `Total ${resumo.formato}`,
      brl(m.venda),
      "100,0%",
      brl(m.compra),
      pct(percentualCompraVenda(m)),
      pct(resumo.meta),
      pp(percentualCompraVenda(m), resumo.meta),
      brl(resumo.gap),
      pct(margem(m)),
      "",
    ],
    linhas: resumo.panorama.map((d) => [
      d.nome,
      brl(d.metricas.venda),
      pct(m.venda > 0 ? d.metricas.venda / m.venda : null),
      brl(d.metricas.compra),
      pct(percentualCompraVenda(d.metricas)),
      pct(d.meta),
      pp(percentualCompraVenda(d.metricas), d.meta),
      brl(d.gap),
      pct(margem(d.metricas)),
      d.meta === null ? "sem meta" : (d.gap ?? 0) > 0 ? "TRATAR" : "na meta",
    ]),
    alertar: (i) => (resumo.panorama[i].gap ?? 0) > 0,
  });
}

function tabelaProdutos(
  doc: jsPDF,
  autoTable: AutoTable,
  produtos: LinhaProduto[],
  lojas: LojaCadastro[],
  estoqueConfiavel: boolean,
  y: number,
): number {
  if (produtos.length === 0) return y;

  const linhas: string[][] = [];
  // Índice paralelo: quais linhas são detalhe de loja. O autoTable não devolve a
  // origem da linha, então guardamos aqui.
  const detalhe = new Set<number>();

  const vazia = () => ["", "", "", "", "", "", "", ""];
  let algumDdeCalculado = false;
  for (const p of produtos) {
    linhas.push([
      p.codigo,
      p.nome,
      brl(p.metricas.venda),
      brl(p.metricas.compra),
      pct(percentualCompraVenda(p.metricas)),
      brl(p.gap),
      unidades(p.metricas.qtdeCompras - p.metricas.qtdeVendas),
      // O asterisco marca o DDE que não veio da VMD do ERP — ver `vmdEfetiva`
      // em priorizacao.ts e a nota embaixo da tabela.
      estoqueConfiavel ? dias(dde(p.metricas)) + (ddeCalculado(p.metricas) ? " *" : "") : VAZIO,
    ]);
    if (estoqueConfiavel && ddeCalculado(p.metricas)) algumDdeCalculado = true;
    if (p.lojas) {
      // Uma linha para cada lado (pedido de 2026-10-02): juntas na mesma linha,
      // "Sobra" e "Falta" se misturavam e a leitura perdia a objetividade.
      const ehTransferencia = p.lojas.faltando.length > 0;
      const detalheLoja = (texto: string) => {
        const l = vazia();
        l[1] = texto;
        detalhe.add(linhas.length);
        linhas.push(l);
      };

      if (ehTransferencia) {
        detalheLoja(`Sobra em: ${linhaLojas(lojas, p.lojas.sobrando)}`);
        detalheLoja(`Falta em: ${linhaLojas(lojas, p.lojas.faltando)}`);
      } else if (p.lojas.sobrando.length > 0) {
        // Sem loja faltando não há transferência: é uma loja só carregando o GAP
        // do item. Aqui o que importa é o DINHEIRO que ela concentra, não a
        // cobertura dela — e a cobertura pode nem existir (produto sem venda
        // média diária no ERP saía como "(-d)", achado em 2026-10-02 no Leite Em
        // Pó Ninho da Independência).
        const loja = p.lojas.sobrando[0];
        const fatia = p.gap > 0 ? `, ${pct((loja.gap ?? 0) / p.gap)} do GAP do produto` : "";
        detalheLoja(`Concentrado em: ${nomeLoja(lojas, loja.lojaCodigo)} — ${brl(loja.gap)}${fatia}`);
      }
    }
  }

  const soma = somarMetricas(produtos);
  const gapTotal = produtos.reduce((total, p) => total + p.gap, 0);

  const fim = tabela(doc, autoTable, {
    y,
    cor: SECOES.cortar.cor,
    subtotal: [
      "",
      `Subtotal — ${produtos.length} produtos listados`,
      brl(soma.venda),
      brl(soma.compra),
      pct(percentualCompraVenda(soma)),
      brl(gapTotal),
      // Quantidade não soma entre produtos diferentes (pacote de 500g com
      // pacote de 250g, quilo com unidade) — o subtotal fica vazio de propósito,
      // e a legenda diz por quê.
      VAZIO,
      estoqueConfiavel ? dias(dde(soma)) : VAZIO,
    ],
    // Oito colunas em vez de doze (decisão de 2026-10-02) deixaram espaço pra
    // subir a fonte de 6,8 pra 8 — o relatório ficou mais curto de ler e mais
    // fácil de enxergar. QC vs QV, Equilíbrio e Causa saíram da tabela; continuam
    // calculados em `priorizacao.ts` e voltam quando o time estiver à vontade com
    // o básico. Histórico (sequência de meses acima da meta) foi removido de
    // vez em 2026-10-03: não estava sendo usado no PDF.
    fonte: 8,
    detalhe,
    // ⚠️ A soma das larguras tem que caber em `UTIL` (273mm). Estourando, o
    // autoTable espreme as colunas e o alinhamento com o título se perde.
    colunas: [
      { titulo: "Código", largura: 16 },
      { titulo: "Produto", largura: 113 },
      { titulo: "Venda", alinhar: "right", largura: 26 },
      { titulo: "Compra", alinhar: "right", largura: 26 },
      { titulo: "% C/V", alinhar: "right", largura: 18 },
      { titulo: "GAP R$", alinhar: "right", largura: 26, negrito: true },
      { titulo: "Comprou a mais", alinhar: "right", largura: 26 },
      { titulo: "DDE", alinhar: "right", largura: 16 },
    ],
    linhas,
  });

  if (!algumDdeCalculado) return fim;
  // Nota de rodapé da tabela: o leitor precisa saber que aquele DDE saiu de
  // outra régua, senão compara com a tela do ERP e acha que um dos dois mente.
  doc.setFontSize(6.8);
  doc.setTextColor(CINZA);
  const nota = doc.splitTextToSize(
    t(
      "* DDE calculado pela venda do próprio período, do primeiro dia em que o item vendeu até o fim do recorte — " +
        "o sistema não tem venda média diária para ele, porque a janela do ERP é de 3 meses fechados e o item é novo ou de promoção.",
    ),
    UTIL - 4,
  );
  doc.text(nota, MARGEM_X + 2, fim);
  return fim + nota.length * 3.2 + 1;
}

function bloco(
  doc: jsPDF,
  autoTable: AutoTable,
  no: NoCascata,
  lojas: LojaCadastro[],
  estoqueConfiavel: boolean,
  nivel: "secao" | "categoria",
  y: number,
): number {
  if (!cabeNaPagina(y, 30)) {
    doc.addPage();
    y = TOPO;
  }
  const secao = nivel === "secao";
  const recuo = secao ? 0 : 5;
  const largura = UTIL - recuo;

  // Barra sólida com o nome à esquerda e os números à direita, sempre nas mesmas
  // posições (decisão de 2026-10-02). Antes eram três linhas de texto corrido em
  // fonte 6,5 — informação importante com cara de letra miúda de contrato.
  const altura = secao ? 7 : 6;
  const fundo: RGB = secao ? [223, 233, 244] : [243, 244, 246];
  doc.setFillColor(...fundo);
  doc.rect(MARGEM_X + recuo, y - 4, largura, altura, "F");
  const tarja: RGB = secao ? SECOES.cortar.cor : [161, 161, 170];
  doc.setFillColor(...tarja);
  doc.rect(MARGEM_X + recuo, y - 4, 1.6, altura, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(secao ? 9 : 8.2);
  doc.setTextColor(secao ? "#003a73" : PRETO);
  doc.text(t(`${secao ? "Seção" : "Categoria"}: ${no.nome}`), MARGEM_X + recuo + 4, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.8);
  doc.setTextColor(secao ? "#003a73" : CINZA);
  const partes = [
    `Venda ${brl(no.metricas.venda)}`,
    `% C/V ${pct(percentualCompraVenda(no.metricas))}`,
    `GAP ${brl(no.gap)}`,
  ];
  if (estoqueConfiavel) partes.push(`DDE ${dias(dde(no.metricas))}`);
  doc.text(t(partes.join("      ")), LARGURA - MARGEM_X - 2.5, y, { align: "right" });
  // Respiro entre a barra da Seção e a da Categoria — coladas, as duas viravam
  // um bloco só e perdiam a hierarquia.
  y += altura + (secao ? 2 : 0.5);

  y = tabelaProdutos(doc, autoTable, no.produtos, lojas, estoqueConfiavel, y);

  // Uma linha só fechando a categoria: as contagens de SKU e o GAP que não virou
  // linha. Antes eram duas linhas separadas, uma acima e outra abaixo da tabela.
  if (nivel === "categoria") {
    const contagens = [
      `${no.skus} SKUs na categoria`,
      `${no.skusAcimaDaMeta} acima da meta`,
      `${no.produtos.length} listados`,
    ];
    if (no.skusPulverizados > 0) {
      contagens.push(`${no.skusPulverizados} pulverizados, somando ${brl(no.gapPulverizado)} de GAP`);
    }
    if (no.anexados.length > 0) contagens.push(`${no.anexados.length} fora da lista (ver Anexos)`);
    doc.setFontSize(7.2);
    doc.setTextColor(CINZA);
    const linhas = doc.splitTextToSize(t(contagens.join("   ·   ")), largura - 4);
    doc.text(linhas, MARGEM_X + recuo + 4, y);
    y += linhas.length * 3.4 + 1.5;
  }

  for (const filho of no.filhos) y = bloco(doc, autoTable, filho, lojas, estoqueConfiavel, "categoria", y);
  return y + 2.5;
}

function ondeCortar(
  doc: jsPDF,
  autoTable: AutoTable,
  resumo: ResumoComprador,
  lojas: LojaCadastro[],
  registro: RegistroPaginas,
  contexto: string,
): void {
  for (const dep of resumo.departamentos) {
    doc.addPage();
    marcarPagina(doc, registro, "cortar", contexto);
    let y = TOPO;
    y = tituloBloco(doc, `Onde cortar — ${dep.nome}`, y, SECOES.cortar.cor, 13);
    y = faixaIndicadores(doc, y, [
      { rotulo: "GAP do departamento", valor: brl(dep.gap), destaque: true },
      { rotulo: "SKUs acima da meta", valor: `${dep.skusAcimaDaMeta} de ${dep.skus}` },
      { rotulo: "Venda", valor: brl(dep.metricas.venda) },
      { rotulo: "% Compra/Venda", valor: pct(percentualCompraVenda(dep.metricas)) },
      { rotulo: "Meta", valor: pct(dep.meta) },
    ]);
    if (!dep.estoqueConfiavel) {
      doc.setFontSize(7);
      doc.setTextColor(CINZA);
      doc.text(
        t("Estoque e DDE não aparecem neste departamento: produção própria, pesável ou entrega futura — o estoque do sistema não descreve a prateleira."),
        MARGEM_X,
        y,
      );
      y += 4.5;
    }
    y = tabelaProdutos(doc, autoTable, (dep as BlocoDepartamento).produtos, lojas, dep.estoqueConfiavel, y);
    for (const secao of dep.filhos) y = bloco(doc, autoTable, secao, lojas, dep.estoqueConfiavel, "secao", y);
  }
}

function riscoDeRuptura(doc: jsPDF, autoTable: AutoTable, resumo: ResumoComprador): void {
  let y = TOPO;
  y = tituloBloco(doc, `Risco de ruptura — ${resumo.formato}`, y, SECOES.ruptura.cor, 13);
  y = paragrafo(
    doc,
    "Itens em cobertura crítica nas lojas que mais vendem, do mais grave para o menos: pesa a venda do item e em quantas das " +
      "lojas ele está apertado. Não aparece aqui o que está " +
      "em departamento de produção própria, pesável ou entrega futura, onde o estoque do sistema não descreve a prateleira. " +
      "Comprou a mais negativo significa que entraram menos unidades do que saíram no período: o estoque caiu.",
    y,
    PRETO,
  );
  y += 1;
  tabela(doc, autoTable, {
    y,
    cor: SECOES.ruptura.cor,
    fonte: 7.4,
    colunas: [
      { titulo: "Código", largura: 16 },
      { titulo: "Produto", largura: 96 },
      { titulo: "Venda no período", alinhar: "right" },
      { titulo: "DDE", alinhar: "right" },
      { titulo: "Lojas zeradas", alinhar: "center" },
      { titulo: "Lojas críticas", alinhar: "center" },
      { titulo: "Lojas", alinhar: "center" },
      { titulo: "Comprou a mais", alinhar: "right" },
    ],
    subtotal: [
      "",
      `Subtotal — ${resumo.ruptura.length} itens em risco`,
      brl(somarMetricas(resumo.ruptura).venda),
      "",
      "",
      "",
      "",
      "",
    ],
    linhas: resumo.ruptura.map((i) => [
      i.codigo,
      i.nome,
      brl(i.metricas.venda),
      dias(i.dde),
      String(i.lojasZeradas),
      String(i.lojasCriticas),
      String(i.lojas),
      unidades(i.metricas.qtdeCompras - i.metricas.qtdeVendas),
    ]),
    alertar: (i) => resumo.ruptura[i].lojasZeradas > 0,
  });
}

function transferencias(doc: jsPDF, autoTable: AutoTable, resumo: ResumoComprador, lojas: LojaCadastro[]): void {
  let y = TOPO;
  y = tituloBloco(doc, `Transferência entre lojas — ${resumo.formato}`, y, SECOES.transferencia.cor, 13);
  y = paragrafo(
    doc,
    `Mesmo produto, mesmo período, lojas do formato ${resumo.formato}: uma com estoque parado e outra em cobertura crítica. ` +
      "Resolve sem comprar nada e sem cortar nada — é a ação mais rápida da lista. Só aparece transferência dentro do mesmo " +
      "formato: Varejo e Atacado têm matrizes diferentes, e mandar de um para o outro é venda de uma loja para a outra, não " +
      "remanejamento.",
    y,
    PRETO,
  );
  y += 1;
  tabela(doc, autoTable, {
    y,
    cor: SECOES.transferencia.cor,
    fonte: 7.4,
    colunas: [
      { titulo: "Código", largura: 15 },
      { titulo: "Produto", largura: 68 },
      { titulo: "R$ parado", alinhar: "right", largura: 22, negrito: true },
      { titulo: "Lojas com sobra (dias de cobertura)", largura: 84 },
      { titulo: "Lojas com falta (dias de cobertura)", largura: 84 },
    ],
    subtotal: [
      "",
      `Subtotal — ${resumo.transferencias.length} produtos`,
      brl(resumo.transferencias.reduce((tot, tr) => tot + tr.gapParado, 0)),
      "",
      "",
    ],
    linhas: resumo.transferencias.map((tr) => [
      tr.produto.codigo,
      tr.produto.nome,
      brl(tr.gapParado),
      linhaLojas(lojas, tr.produto.lojas?.sobrando ?? []),
      linhaLojas(lojas, tr.produto.lojas?.faltando ?? []),
    ]),
  });
}

/** Anexos: tudo que NÃO é trabalho do comprador, mas que ele precisa saber que
 * existe — senão descobre sozinho, desconfia do número e descarta o relatório. */
function anexos(doc: jsPDF, autoTable: AutoTable, resumo: ResumoComprador): void {
  const cor = SECOES.anexos.cor;
  let y = TOPO;
  y = tituloBloco(doc, `Anexos — ${resumo.formato}`, y, cor, 13);
  y = paragrafo(
    doc,
    "Nada desta página conta como trabalho de compra, e por isso nada daqui entra no GAP cobrado de você. Está aqui para o " +
      "relatório não parecer que deixou passar.",
    y,
    PRETO,
  );
  y += 1;

  const cadastro = resumo.departamentos.flatMap((d) => [
    ...d.anexados,
    ...d.filhos.flatMap((s) => [...s.anexados, ...s.filhos.flatMap((c) => c.anexados)]),
  ]);

  const blocos: { titulo: string; texto: string; colunas: Coluna[]; linhas: string[][]; subtotal?: string[] }[] = [];
  if (cadastro.length > 0) {
    blocos.push({
      titulo: "Revisar cadastro ou rateio",
      texto:
        "Itens cujo número não descreve uma decisão de compra: rateio de desmembramento, insumo de produção ou preço fora de escala. Ficam fora da lista de ação para não inflar o GAP — mas o cadastro precisa ser corrigido. A data de cadastro ajuda a achar o que entrou errado agora e ainda dá pra ajustar.",
      colunas: [
        { titulo: "Código", largura: 16 },
        { titulo: "Produto", largura: 84 },
        { titulo: "Cadastrado em", alinhar: "center", largura: 24 },
        { titulo: "Motivo", largura: 96 },
        { titulo: "R$ que ficou fora", alinhar: "right", negrito: true },
      ],
      linhas: cadastro.map((a) => [a.codigo, a.nome, a.dataCadastro || VAZIO, ROTULO_MOTIVO[a.motivo], brl(a.gap)]),
      subtotal: ["", "Subtotal", "", "", brl(cadastro.reduce((tot, a) => tot + a.gap, 0))],
    });
  }
  if (resumo.lancamentos.length > 0) {
    blocos.push({
      titulo: "Comprou e ainda não vendeu",
      texto:
        "Primeira carga de lançamento ou item parado desde a entrada. Não é excesso de compra — é giro a acompanhar. " +
        "A data de cadastro separa os dois casos: cadastro recente é lançamento entrando; cadastro antigo com compra e " +
        "sem venda é item que travou.",
      colunas: [
        { titulo: "Código", largura: 16 },
        { titulo: "Produto", largura: 130 },
        { titulo: "Cadastrado em", alinhar: "center", largura: 26 },
        { titulo: "Compra no período", alinhar: "right", negrito: true },
      ],
      linhas: resumo.lancamentos.map((l) => [l.codigo, l.nome, l.dataCadastro || VAZIO, brl(l.compra)]),
      subtotal: ["", "Subtotal", "", brl(resumo.lancamentos.reduce((tot, l) => tot + l.compra, 0))],
    });
  }
  if (resumo.metasFaltando.length > 0) {
    blocos.push({
      titulo: "Departamentos sem meta cadastrada",
      texto: "Ficam fora do GAP porque não há régua. A compra abaixo entrou no % C/V geral, mas não foi cobrada de ninguém.",
      colunas: [
        { titulo: "Departamento", largura: 120 },
        { titulo: "Compra no período", alinhar: "right" },
        { titulo: "Venda no período", alinhar: "right" },
      ],
      linhas: resumo.metasFaltando.map((m) => [m.nome, brl(m.compra), brl(m.venda)]),
      subtotal: ["Subtotal", brl(resumo.metasFaltando.reduce((tot, m) => tot + m.compra, 0)), brl(resumo.metasFaltando.reduce((tot, m) => tot + m.venda, 0))],
    });
  }

  for (const b of blocos) {
    if (!cabeNaPagina(y, 30)) {
      doc.addPage();
      y = TOPO;
    }
    y = subtitulo(doc, b.titulo, y);
    y = paragrafo(doc, b.texto, y);
    y = tabela(doc, autoTable, { y, cor, fonte: 7.4, colunas: b.colunas, linhas: b.linhas, subtotal: b.subtotal });
    y += 2;
  }
}

function temAnexos(resumo: ResumoComprador): boolean {
  return (
    resumo.lancamentos.length > 0 ||
    resumo.metasFaltando.length > 0 ||
    resumo.departamentos.some((d) => d.anexados.length > 0 || d.filhos.some((s) => s.anexados.length > 0))
  );
}

// ---------------------------------------------------------------------------
// Montagem
// ---------------------------------------------------------------------------

/** Gera o PDF de um comprador (todos os formatos num arquivo só) e devolve os bytes. */
export async function gerarPdfComprador(dados: DadosPdfComprador): Promise<Uint8Array> {
  const { jsPDF: JsPdf } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default as unknown as AutoTable;

  const doc = new JsPdf({ orientation: "landscape", unit: "mm", format: "a4" });
  const registro: RegistroPaginas = new Map();
  const contextoBase = `${dados.comprador} · ${dados.periodo}`;

  marcarPagina(doc, registro, "capa", contextoBase);
  capa(doc, autoTable, dados);

  // A legenda vem antes do conteúdo, com um exemplo do próprio relatório desta
  // pessoa: o produto de maior GAP entre todos os formatos.
  const maiorGap = dados.porFormato
    .flatMap((r) => r.departamentos)
    .flatMap((d) => [...d.produtos, ...d.filhos.flatMap((s) => [...s.produtos, ...s.filhos.flatMap((c) => c.produtos)])])
    .sort((a, b) => b.gap - a.gap)[0];
  doc.addPage();
  marcarPagina(doc, registro, "legenda", contextoBase);
  legenda(doc, autoTable, maiorGap ?? null);

  // Mesma ordem de seções em todo formato — ver `SECOES`.
  for (const resumo of dados.porFormato) {
    const contexto = `${dados.comprador} · ${resumo.formato} · ${dados.periodo}`;

    doc.addPage();
    marcarPagina(doc, registro, "visao", contexto);
    visaoGeral(doc, autoTable, resumo);

    ondeCortar(doc, autoTable, resumo, dados.lojas, registro, contexto);

    if (resumo.ruptura.length > 0) {
      doc.addPage();
      marcarPagina(doc, registro, "ruptura", contexto);
      riscoDeRuptura(doc, autoTable, resumo);
    }
    if (resumo.transferencias.length > 0) {
      doc.addPage();
      marcarPagina(doc, registro, "transferencia", contexto);
      transferencias(doc, autoTable, resumo, dados.lojas);
    }
    if (temAnexos(resumo)) {
      doc.addPage();
      marcarPagina(doc, registro, "anexos", contexto);
      anexos(doc, autoTable, resumo);
    }
  }

  moldura(doc, dados, registro);
  return new Uint8Array(doc.output("arraybuffer") as ArrayBuffer);
}
