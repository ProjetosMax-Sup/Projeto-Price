import type { ColunaRenderizavel } from "./colunas-configuradas";
import { valoresDaLinha } from "./colunas-configuradas";
import type { ConfigRelatorio } from "@/lib/parametros/types";
import type { EstruturaAgregada, LojaAgregada, Metricas, NivelEstrutura } from "./aggregate";
import { labelNivel } from "./aggregate";
import { formatMoeda, formatPercent } from "./format";

export interface DadosExportacao {
  descricaoRecorte: string;
  nivelEstrutura: NivelEstrutura;
  kpiAtual: Metricas;
  kpiComparacao: Metricas | null;
  linhasEstrutura: EstruturaAgregada[];
  linhasLojas: LojaAgregada[];
  /** Mesmas colunas e mesma ordem da tela — a aba Ativas manda também aqui
   * (padrão documentado em docs/padroes-ux.md). */
  config: ConfigRelatorio;
  colunas: ColunaRenderizavel[];
}

function nomeArquivoBase(): string {
  const hoje = new Date().toISOString().slice(0, 10);
  return `desempenho-comercial-${hoje}`;
}

/** Texto de uma célula, no formato da coluna. Vazio vira "—", como na tela. */
function celula(coluna: ColunaRenderizavel, valor: number | null): string {
  if (valor === null) return "—";
  switch (coluna.formato) {
    case "moeda":
      return formatMoeda(valor);
    case "numero":
      return valor.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
    case "percentual":
    case "pontosPercentuais":
      return `${valor >= 0 && coluna.semaforo ? "+" : ""}${formatPercent(valor)}`;
  }
}

function linhasDaTabela(
  dados: DadosExportacao,
  linhas: { rotulo: string; codigo: string; atual: Metricas; comparacao: Metricas | null }[],
): string[][] {
  return linhas.map((linha) => {
    const valores = valoresDaLinha(dados.config, linha.atual, linha.comparacao);
    return [linha.codigo, linha.rotulo, ...dados.colunas.map((c) => celula(c, valores[c.ref] ?? null))];
  });
}

function estruturaParaLinhas(dados: DadosExportacao) {
  return dados.linhasEstrutura.map((l) => ({
    rotulo: l.nome,
    codigo: l.codigo ?? "",
    atual: l.atual,
    comparacao: l.comparacao,
  }));
}

function lojasParaLinhas(dados: DadosExportacao) {
  return dados.linhasLojas.map((l) => ({
    rotulo: `${l.loja.nomeLoja} (${l.loja.formato})`,
    codigo: l.loja.codUnid,
    atual: l.atual,
    comparacao: l.comparacao,
  }));
}

export function baixarBlob(blob: Blob, nomeArquivo: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nomeArquivo;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function exportarExcel(dados: DadosExportacao) {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "MAX Supermercados — Inteligência de Mercado";
  workbook.created = new Date();

  const valoresKpi = valoresDaLinha(dados.config, dados.kpiAtual, dados.kpiComparacao);

  const resumo = workbook.addWorksheet("Resumo");
  resumo.columns = [
    { header: "Indicador", key: "indicador", width: 30 },
    { header: "Valor", key: "valor", width: 22 },
  ];
  resumo.getRow(1).font = { bold: true };
  resumo.addRow({ indicador: "Recorte ativo", valor: dados.descricaoRecorte });
  resumo.addRow({});
  for (const coluna of dados.colunas) {
    resumo.addRow({ indicador: coluna.rotulo, valor: celula(coluna, valoresKpi[coluna.ref] ?? null) });
  }

  const cabecalhoTabela = (primeira: string) => ["Código", primeira, ...dados.colunas.map((c) => c.rotulo)];

  const estrutura = workbook.addWorksheet("Estrutura Mercadológica");
  estrutura.addRow(cabecalhoTabela(labelNivel(dados.nivelEstrutura)));
  estrutura.getRow(1).font = { bold: true };
  for (const linha of linhasDaTabela(dados, estruturaParaLinhas(dados))) estrutura.addRow(linha);
  estrutura.getColumn(2).width = 36;

  const lojas = workbook.addWorksheet("Lojas");
  lojas.addRow(cabecalhoTabela("Loja"));
  lojas.getRow(1).font = { bold: true };
  for (const linha of linhasDaTabela(dados, lojasParaLinhas(dados))) lojas.addRow(linha);
  lojas.getColumn(2).width = 32;

  const buffer = await workbook.xlsx.writeBuffer();
  baixarBlob(
    new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `${nomeArquivoBase()}.xlsx`,
  );
}

export async function exportarPdf(dados: DadosExportacao) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ orientation: "landscape" });
  const azul = "#004C97";

  doc.setFontSize(16);
  doc.setTextColor(azul);
  doc.text("MAX Supermercados — Desempenho Comercial", 14, 16);

  doc.setFontSize(10);
  doc.setTextColor("#3f3f46");
  doc.text(`Recorte ativo: ${dados.descricaoRecorte}`, 14, 23);
  doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, 14, 28);

  // Cabeçalho com as 3 primeiras colunas ativas — o resto está nas tabelas abaixo.
  const valoresKpi = valoresDaLinha(dados.config, dados.kpiAtual, dados.kpiComparacao);
  doc.setFontSize(11);
  doc.setTextColor("#18181b");
  doc.text(
    dados.colunas
      .slice(0, 3)
      .map((c) => `${c.rotulo}: ${celula(c, valoresKpi[c.ref] ?? null)}`)
      .join("   |   "),
    14,
    36,
  );

  const cabecalho = (primeira: string) => [["Código", primeira, ...dados.colunas.map((c) => c.rotulo)]];

  autoTable(doc, {
    startY: 42,
    head: cabecalho(labelNivel(dados.nivelEstrutura)),
    body: linhasDaTabela(dados, estruturaParaLinhas(dados)),
    headStyles: { fillColor: [0, 76, 151] },
    styles: { fontSize: 7 },
  });

  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  autoTable(doc, {
    startY: finalY + 10,
    head: cabecalho("Loja"),
    body: linhasDaTabela(dados, lojasParaLinhas(dados)),
    headStyles: { fillColor: [0, 76, 151] },
    styles: { fontSize: 7 },
  });

  doc.save(`${nomeArquivoBase()}.pdf`);
}
