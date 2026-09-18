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
}

function nomeArquivoBase(): string {
  const hoje = new Date().toISOString().slice(0, 10);
  return `desempenho-comercial-${hoje}`;
}

function desvioTexto(valor: number | null): string {
  if (valor === null) return "—";
  return `${valor >= 0 ? "+" : ""}${formatPercent(valor)}`;
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

  const resumo = workbook.addWorksheet("Resumo");
  resumo.columns = [
    { header: "Indicador", key: "indicador", width: 24 },
    { header: "Período atual", key: "atual", width: 18 },
    { header: "Período comparação", key: "comparacao", width: 20 },
    { header: "% Desvio", key: "desvio", width: 12 },
  ];
  resumo.getRow(1).font = { bold: true };
  resumo.addRow({
    indicador: "Recorte ativo",
    atual: dados.descricaoRecorte,
    comparacao: "",
    desvio: "",
  });
  resumo.addRow({});
  resumo.addRow({
    indicador: "Venda",
    atual: dados.kpiAtual.venda,
    comparacao: dados.kpiComparacao?.venda ?? "",
    desvio: dados.kpiComparacao
      ? desvioTexto(((dados.kpiAtual.venda - dados.kpiComparacao.venda) / (dados.kpiComparacao.venda || 1)) * 100)
      : "—",
  });
  resumo.addRow({
    indicador: "Lucro",
    atual: dados.kpiAtual.lucro,
    comparacao: dados.kpiComparacao?.lucro ?? "",
    desvio: dados.kpiComparacao
      ? desvioTexto(((dados.kpiAtual.lucro - dados.kpiComparacao.lucro) / (dados.kpiComparacao.lucro || 1)) * 100)
      : "—",
  });
  resumo.addRow({
    indicador: "% Lucro",
    atual: `${formatPercent(dados.kpiAtual.percLucro)}`,
    comparacao: dados.kpiComparacao ? formatPercent(dados.kpiComparacao.percLucro) : "",
    desvio: "",
  });
  const estrutura = workbook.addWorksheet("Estrutura Mercadológica");
  estrutura.columns = [
    { header: labelNivel(dados.nivelEstrutura), key: "nome", width: 32 },
    { header: "Código", key: "codigo", width: 10 },
    { header: "Venda", key: "venda", width: 16 },
    { header: "% Desvio Venda", key: "desvioVenda", width: 16 },
    { header: "Lucro", key: "lucro", width: 16 },
    { header: "% Lucro", key: "percLucro", width: 12 },
    { header: "% Desvio Lucro", key: "desvioLucro", width: 16 },
  ];
  estrutura.getRow(1).font = { bold: true };
  for (const linha of dados.linhasEstrutura) {
    estrutura.addRow({
      nome: linha.nome,
      codigo: linha.codigo ?? "",
      venda: linha.atual.venda,
      desvioVenda: desvioTexto(linha.desvioVenda),
      lucro: linha.atual.lucro,
      percLucro: formatPercent(linha.atual.percLucro),
      desvioLucro: desvioTexto(linha.desvioLucro),
    });
  }
  estrutura.getColumn("venda").numFmt = '"R$" #,##0.00';
  estrutura.getColumn("lucro").numFmt = '"R$" #,##0.00';

  const lojas = workbook.addWorksheet("Lojas");
  lojas.columns = [
    { header: "Código", key: "codigo", width: 10 },
    { header: "Loja", key: "nome", width: 26 },
    { header: "Formato", key: "formato", width: 12 },
    { header: "Venda", key: "venda", width: 16 },
    { header: "% Desvio Venda", key: "desvioVenda", width: 16 },
    { header: "Lucro", key: "lucro", width: 16 },
    { header: "% Lucro", key: "percLucro", width: 12 },
    { header: "% Desvio Lucro", key: "desvioLucro", width: 16 },
  ];
  lojas.getRow(1).font = { bold: true };
  for (const linha of dados.linhasLojas) {
    lojas.addRow({
      codigo: linha.loja.codUnid,
      nome: linha.loja.nomeLoja,
      formato: linha.loja.formato,
      venda: linha.atual.venda,
      desvioVenda: desvioTexto(linha.desvioVenda),
      lucro: linha.atual.lucro,
      percLucro: formatPercent(linha.atual.percLucro),
      desvioLucro: desvioTexto(linha.desvioLucro),
    });
  }
  lojas.getColumn("venda").numFmt = '"R$" #,##0.00';
  lojas.getColumn("lucro").numFmt = '"R$" #,##0.00';

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

  doc.setFontSize(11);
  doc.setTextColor("#18181b");
  const kpiLinha = [
    `Venda: ${formatMoeda(dados.kpiAtual.venda)} (${desvioTexto(
      dados.kpiComparacao
        ? ((dados.kpiAtual.venda - dados.kpiComparacao.venda) / (dados.kpiComparacao.venda || 1)) * 100
        : null,
    )})`,
    `Lucro: ${formatMoeda(dados.kpiAtual.lucro)} (${desvioTexto(
      dados.kpiComparacao
        ? ((dados.kpiAtual.lucro - dados.kpiComparacao.lucro) / (dados.kpiComparacao.lucro || 1)) * 100
        : null,
    )})`,
    `% Lucro: ${formatPercent(dados.kpiAtual.percLucro)}`,
  ];
  doc.text(kpiLinha.join("   |   "), 14, 36);

  autoTable(doc, {
    startY: 42,
    head: [[labelNivel(dados.nivelEstrutura), "Venda", "% Desvio Venda", "Lucro", "% Lucro", "% Desvio Lucro"]],
    body: dados.linhasEstrutura.map((linha) => [
      linha.codigo ? `${linha.codigo} - ${linha.nome}` : linha.nome,
      formatMoeda(linha.atual.venda),
      desvioTexto(linha.desvioVenda),
      formatMoeda(linha.atual.lucro),
      formatPercent(linha.atual.percLucro),
      desvioTexto(linha.desvioLucro),
    ]),
    headStyles: { fillColor: [0, 76, 151] },
    styles: { fontSize: 9 },
  });

  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  autoTable(doc, {
    startY: finalY + 10,
    head: [["Loja", "Formato", "Venda", "% Desvio Venda", "Lucro", "% Lucro", "% Desvio Lucro"]],
    body: dados.linhasLojas.map((linha) => [
      `${linha.loja.codUnid} - ${linha.loja.nomeLoja}`,
      linha.loja.formato,
      formatMoeda(linha.atual.venda),
      desvioTexto(linha.desvioVenda),
      formatMoeda(linha.atual.lucro),
      formatPercent(linha.atual.percLucro),
      desvioTexto(linha.desvioLucro),
    ]),
    headStyles: { fillColor: [0, 76, 151] },
    styles: { fontSize: 9 },
  });

  doc.save(`${nomeArquivoBase()}.pdf`);
}
