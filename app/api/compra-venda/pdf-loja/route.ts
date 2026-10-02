import { NextResponse } from "next/server";
import { arquivoMensal, NOMES_MESES_ARQUIVO } from "@/config/data-sources";
import { getEntradasSaidasReduzido } from "@/lib/data-providers/file-provider";
import { filtrarPorFormato, FORMATO_TODOS, metasPorDepartamento, pesosPorDepartamentoFormato } from "@/lib/compra-venda/aggregate";
import { gerarPdfPorLoja, type BlocoPdfLoja, type DepartamentoPdfLoja } from "@/lib/compra-venda/pdf-loja";
import { agregarDepartamento, filtrarPorLojas } from "@/lib/entradas-saidas/aggregate";
import { departamentosExcluidosDoTotal } from "@/lib/entradas-saidas/consulta";
import { colunasDoRelatorio } from "@/lib/desempenho/colunas-configuradas";
import {
  obterOuSemearConfigRelatorio,
  obterOuSemearDepartamentosCadastro,
  obterOuSemearDicionarioColunas,
  obterOuSemearLojasCadastro,
} from "@/lib/parametros/store";

/**
 * Gera o PDF por Loja do Compra e Venda — substitui a planilha que o time
 * montava à mão (ver `docs/exemplos-pdf`): Total da rede no formato escolhido
 * seguido de um bloco por Loja, cada um com as mesmas colunas configuradas na
 * tela. Pedido de 2026-10-02: "não precisa destrinchar" — bem mais simples que
 * `pdf-comprador`, sem seções nem priorização (ver `lib/compra-venda/pdf-loja.ts`).
 *
 * Mesmo esquema de acesso que `pdf-comprador`: em validação, restrito por
 * `PDF_COMPRADOR_TOKEN`.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const HEADER_TOKEN = "x-pdf-comprador-token";

function autorizado(request: Request): boolean {
  const esperado = process.env.PDF_COMPRADOR_TOKEN;
  if (!esperado) return !process.env.SITE_PASSWORD;
  return request.headers.get(HEADER_TOKEN) === esperado;
}

interface CorpoPdf {
  meses: string[];
  formato: string;
  lojas?: string[];
}

function nomesDeArquivo(meses: string[]): string[] {
  return meses
    .filter((m): m is (typeof NOMES_MESES_ARQUIVO)[number] => (NOMES_MESES_ARQUIVO as readonly string[]).includes(m))
    .map((m) => arquivoMensal(m).nome);
}

const ABREVIACAO_MES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

/** Mesmo critério de `pdf-comprador.ts`: do 1º dia do mês mais antigo escolhido
 * até o último dia com movimento nos dados (o arquivo do mês corrente pode
 * parar antes do fim do calendário). */
function periodoDoRecorte(meses: string[], linhas: { ultimaData: string }[]): { inicio: string; fim: string } {
  const primeiroMes = Math.min(...meses.map((m) => (NOMES_MESES_ARQUIVO as readonly string[]).indexOf(m)).filter((i) => i >= 0));
  const inicio = `01-${ABREVIACAO_MES[primeiroMes] ?? ""}`;
  let maior = "";
  for (const linha of linhas) if (linha.ultimaData > maior) maior = linha.ultimaData;
  if (!maior) return { inicio, fim: inicio };
  const [, mes, dia] = maior.split("-");
  return { inicio, fim: `${dia}-${ABREVIACAO_MES[Number(mes) - 1] ?? mes}` };
}

function anexo(nome: string): string {
  const ascii = nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\x20-\x7e]/g, "_")
    .replace(/"/g, "");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nome)}`;
}

function nomeDeArquivo(formato: string, periodo: { inicio: string; fim: string }): string {
  const limpo = (texto: string) => texto.replace(/[\\/:*?"<>|]/g, "-").trim();
  return `${limpo(formato)}_Compra_Venda_por_Loja_${periodo.inicio} à ${periodo.fim}.pdf`;
}

function paraDepartamentoPdf(nos: { codigo: string | null; nome: string; valores: Record<string, number> }[]): DepartamentoPdfLoja[] {
  return nos.map((n) => ({ codigo: n.codigo, nome: n.nome, valores: n.valores }));
}

export async function POST(request: Request) {
  if (!autorizado(request)) {
    return NextResponse.json({ erro: "Relatório em validação — acesso restrito." }, { status: 403 });
  }

  let corpo: CorpoPdf;
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido" }, { status: 400 });
  }

  const meses = (corpo.meses ?? []).filter((m) => (NOMES_MESES_ARQUIVO as readonly string[]).includes(m));
  if (meses.length === 0) return NextResponse.json({ erro: "Nenhum mês selecionado" }, { status: 400 });
  if (!corpo.formato || corpo.formato === FORMATO_TODOS) {
    return NextResponse.json({ erro: "Escolha um Formato (Varejo ou Atacado) — a meta é cadastrada por formato." }, { status: 400 });
  }

  const [linhasBrutas, departamentosCadastro, lojasCadastro, config, dicionario] = await Promise.all([
    getEntradasSaidasReduzido(nomesDeArquivo(meses)),
    obterOuSemearDepartamentosCadastro(),
    obterOuSemearLojasCadastro(),
    obterOuSemearConfigRelatorio("compra-venda"),
    obterOuSemearDicionarioColunas(),
  ]);

  const linhasDaLoja = filtrarPorLojas(linhasBrutas, corpo.lojas ?? []);
  const linhas = filtrarPorFormato(linhasDaLoja, corpo.formato);
  if (linhas.length === 0) return NextResponse.json({ erro: "Nenhum dado no recorte escolhido" }, { status: 400 });

  const colunas = colunasDoRelatorio(config, dicionario);
  const excluidos = departamentosExcluidosDoTotal(departamentosCadastro);
  const pesos = pesosPorDepartamentoFormato(linhasDaLoja).filter((p) => !excluidos.has(p.dpto));
  const metasDpto = metasPorDepartamento(pesos, config.metas ?? {}, corpo.formato);

  const injetarMeta = (nos: ReturnType<typeof agregarDepartamento>) =>
    nos.map((n) => ({ ...n, valores: n.codigo && metasDpto.has(n.codigo) ? { ...n.valores, Meta: metasDpto.get(n.codigo)! } : n.valores }));

  const total: BlocoPdfLoja = {
    titulo: "Total",
    departamentos: paraDepartamentoPdf(injetarMeta(agregarDepartamento(linhas, "departamento"))),
  };

  const porLoja: BlocoPdfLoja[] = lojasCadastro
    .filter((l) => l.formato === corpo.formato && (!corpo.lojas?.length || corpo.lojas.includes(l.codigo)))
    .map((loja) => {
      const linhasDaLojaEspecifica = linhas.filter((l) => l.lojaCodigo === loja.codigo);
      return {
        titulo: loja.nomeCustomizado,
        departamentos: paraDepartamentoPdf(injetarMeta(agregarDepartamento(linhasDaLojaEspecifica, "departamento"))),
      };
    })
    .filter((bloco) => bloco.departamentos.length > 0);

  const recorte = periodoDoRecorte(meses, linhas);
  const periodo = `Período ${recorte.inicio} à ${recorte.fim} · ${new Date().getFullYear()}`;

  const bytes = await gerarPdfPorLoja({
    formato: corpo.formato,
    periodo,
    geradoEm: new Date(),
    config,
    colunas,
    departamentosExcluidos: excluidos,
    total,
    porLoja,
  });

  return new NextResponse(bytes as unknown as BodyInit, {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": anexo(nomeDeArquivo(corpo.formato, recorte)) },
  });
}

/** Mesma porta de acesso de pdf-comprador — alimenta o botão (aparece/some). */
export async function GET(request: Request) {
  return NextResponse.json({ habilitado: autorizado(request) });
}
