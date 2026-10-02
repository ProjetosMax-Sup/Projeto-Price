import { NextResponse } from "next/server";
import { arquivoMensal, NOMES_MESES_ARQUIVO } from "@/config/data-sources";
import { getEntradasSaidasReduzido } from "@/lib/data-providers/file-provider";
import { filtrarPorFormato, FORMATO_TODOS } from "@/lib/compra-venda/aggregate";
import { gerarPdfComprador } from "@/lib/compra-venda/pdf-comprador";
import {
  gapPorSku,
  compradoresPresentes,
  criarResolverMeta,
  PISO_RELEVANCIA_PADRAO,
  priorizarComprador,
} from "@/lib/compra-venda/priorizacao";
import { filtrarPorLojas } from "@/lib/entradas-saidas/aggregate";
import { construirIndiceDepartamentos } from "@/lib/desempenho/comprador-cadastro";
import { obterOuSemearConfigRelatorio, obterOuSemearDepartamentosCadastro, obterOuSemearLojasCadastro } from "@/lib/parametros/store";

/**
 * Gera o PDF por Comprador do Compra e Venda — um arquivo por pessoa, com
 * Varejo e Atacado dentro (o comprador é uma pessoa só e negocia com um
 * fornecedor só; decisão de 2026-10-01). Mais de um comprador numa chamada
 * volta como ZIP.
 *
 * Roda no servidor de propósito: são ~9 relatórios de uma vez, cada um sobre um
 * recorte diferente do dataset. Fazer isso no cliente (como
 * `lib/desempenho/export.ts` faz, porque lá o PDF é um retrato da tela)
 * obrigaria a mandar o dado bruto pro navegador — o que o CLAUDE.md proíbe.
 *
 * ## Acesso
 *
 * Restrito enquanto o relatório está em validação (pedido de 2026-10-01: "um
 * botão ativo só pra mim neste primeiro momento"). `lib/auth/usuario-atual.ts`
 * hoje devolve Gestor com acesso total pra todo mundo que passa da senha única
 * do site — não distingue pessoa, então não serve de porta aqui. A porta é uma
 * variável de ambiente: sem `PDF_COMPRADOR_TOKEN` configurada, a rota só
 * responde em ambiente local (onde não existe login nem gente além de você);
 * com ela configurada (produção), exige o mesmo valor no header. Quando o
 * relatório for liberado pro time, isto vira uma checagem de perfil de verdade
 * e esta variável some.
 */

export const dynamic = "force-dynamic";
/** Nove PDFs sobre 76 mil linhas não cabem nos 10s padrão da Vercel. */
export const maxDuration = 300;

const HEADER_TOKEN = "x-pdf-comprador-token";

function autorizado(request: Request): boolean {
  const esperado = process.env.PDF_COMPRADOR_TOKEN;
  if (!esperado) return !process.env.SITE_PASSWORD; // sem senha de site = rodando local
  return request.headers.get(HEADER_TOKEN) === esperado;
}

interface CorpoPdf {
  meses: string[];
  /** Vazio = todos os compradores presentes no recorte. */
  compradores?: string[];
  lojas?: string[];
  /** Vazio/ausente = Varejo e Atacado. */
  formatos?: string[];
  piso?: number;
}

function nomesDeArquivo(meses: string[]): string[] {
  return meses
    .filter((m): m is (typeof NOMES_MESES_ARQUIVO)[number] => (NOMES_MESES_ARQUIVO as readonly string[]).includes(m))
    .map((m) => arquivoMensal(m).nome);
}

/** Até quantos meses antes do recorte o histórico olha — o bastante pra dizer
 * "3º mês seguido" sem ler o ano inteiro. Cada mês é um arquivo a mais (já
 * reduzido e em cache depois da 1ª leitura). */
const MESES_DE_HISTORICO = 3;

/** Meses imediatamente anteriores ao recorte, do mais recente pro mais antigo —
 * alimentam `Historico` (sequência acima da meta e variação do GAP). Lista
 * vazia quando o recorte já começa em Janeiro. */
function mesesAnteriores(meses: string[]): string[] {
  const indices = meses.map((m) => (NOMES_MESES_ARQUIVO as readonly string[]).indexOf(m)).filter((i) => i >= 0);
  if (indices.length === 0) return [];
  const primeiro = Math.min(...indices);
  const anteriores: string[] = [];
  for (let i = 1; i <= MESES_DE_HISTORICO; i++) {
    const indice = primeiro - i;
    if (indice < 0) break;
    anteriores.push(NOMES_MESES_ARQUIVO[indice]);
  }
  return anteriores;
}

/** Dias corridos aproximados do período — converte venda do período em
 * venda/dia na seção de ruptura. 30 por mês escolhido é suficiente: a lista é
 * ordenada por esse número, e um erro de ±1 dia não troca a ordem de nada. */
function diasDoPeriodo(meses: string[]): number {
  return Math.max(meses.length, 1) * 30;
}

const ABREVIACAO_MES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

/**
 * O período que o relatório cobre de verdade: do **primeiro dia do mês mais
 * antigo escolhido** até o **último dia com movimento** nos dados (decisão de
 * 2026-10-02). O fim não é o fim do mês de calendário — o arquivo do mês
 * corrente para no último dia que o ERP exportou, e dizer "30/Set" num
 * relatório que só tem dado até o dia 24 seria mentira.
 *
 * `LinhaReduzida.ultimaData` vem no formato ordenável `AA-MM-DD`.
 */
function periodoDoRecorte(meses: string[], linhas: { ultimaData: string }[]): { inicio: string; fim: string } {
  const primeiroMes = Math.min(...meses.map((m) => (NOMES_MESES_ARQUIVO as readonly string[]).indexOf(m)).filter((i) => i >= 0));
  const inicio = `01-${ABREVIACAO_MES[primeiroMes] ?? ""}`;

  let maior = "";
  for (const linha of linhas) if (linha.ultimaData > maior) maior = linha.ultimaData;
  if (!maior) return { inicio, fim: inicio };
  const [, mes, dia] = maior.split("-");
  return { inicio, fim: `${dia}-${ABREVIACAO_MES[Number(mes) - 1] ?? mes}` };
}

/** Caracteres que o Windows não aceita em nome de arquivo. A barra do formato
 * pedido ("DD/MMM") é um deles, por isso vira hífen: `01-Set à 30-Set`. */
function nomeDeArquivo(formato: string, comprador: string, periodo: { inicio: string; fim: string }): string {
  const limpo = (texto: string) => texto.replace(/[\\/:*?"<>|]/g, "-").trim();
  return `${limpo(formato)}_Compra_Venda_${limpo(comprador)}_${periodo.inicio} à ${periodo.fim}.pdf`;
}

/**
 * Cabeçalho de download com o nome de arquivo acentuado preservado. O `filename`
 * simples só aceita ASCII, então vai uma versão sem acento como reserva e o
 * `filename*` (RFC 5987) com o nome de verdade — "à" e nomes como "Johathan"
 * chegam inteiros nos navegadores atuais.
 */
function anexo(nome: string): string {
  const ascii = nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\x20-\x7e]/g, "_")
    .replace(/"/g, "");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nome)}`;
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

  const [linhasBrutas, departamentos, lojasCadastro, config] = await Promise.all([
    getEntradasSaidasReduzido(nomesDeArquivo(meses)),
    obterOuSemearDepartamentosCadastro(),
    obterOuSemearLojasCadastro(),
    obterOuSemearConfigRelatorio("compra-venda"),
  ]);

  const indiceComprador = construirIndiceDepartamentos(departamentos);
  const resolverMeta = criarResolverMeta(config.metas ?? {});
  const nomeDepartamento = (codigo: string) => departamentos.find((d) => d.codigo === codigo)?.nome ?? codigo;

  // Data de cadastro por SKU, indexada uma vez (a mesma pra toda loja e formato).
  const cadastroPorSku = new Map<string, string>();
  for (const linha of linhasBrutas) if (linha.dataCadastro) cadastroPorSku.set(linha.codigo, linha.dataCadastro);
  const dataCadastro = (codigo: string) => cadastroPorSku.get(codigo) ?? "";
  const piso = corpo.piso ?? PISO_RELEVANCIA_PADRAO;

  // Loja é recorte prévio, igual na rota principal — aplicado antes de tudo.
  const linhas = filtrarPorLojas(linhasBrutas, corpo.lojas ?? []);

  // Formatos de verdade (nunca "Todos" aqui: a meta é cadastrada por
  // Departamento×Formato, e misturar os dois num bloco só esconderia que a
  // mesma pessoa pode estar na meta num e fora no outro).
  const formatosDisponiveis = Array.from(new Set(lojasCadastro.map((l) => l.formato.trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, "pt-BR"),
  );
  const formatos = (corpo.formatos?.filter((f) => f !== FORMATO_TODOS) ?? []).length
    ? corpo.formatos!.filter((f) => f !== FORMATO_TODOS)
    : formatosDisponiveis;

  // Períodos anteriores, só pra montar o histórico de cada SKU — arquivos a
  // mais, já reduzidos e em cache. Falha em qualquer um nunca derruba o
  // relatório: o histórico some e o resto sai igual.
  const linhasAnteriores = await Promise.all(
    mesesAnteriores(meses).map(async (mes) => {
      try {
        return filtrarPorLojas(await getEntradasSaidasReduzido(nomesDeArquivo([mes])), corpo.lojas ?? []);
      } catch {
        return [];
      }
    }),
  );

  const pedidos = corpo.compradores?.length ? corpo.compradores : compradoresPresentes(linhas, indiceComprador);
  if (pedidos.length === 0) return NextResponse.json({ erro: "Nenhum comprador no recorte escolhido" }, { status: 400 });

  const recorte = periodoDoRecorte(meses, linhas);
  const periodo = `${recorte.inicio} à ${recorte.fim} · ${new Date().getFullYear()}`;
  const geradoEm = new Date();

  // Pré-calcula por formato o que não depende do comprador — reduzir e varrer
  // 76 mil linhas uma vez por formato, não uma vez por comprador.
  const porFormatoBase = formatos.map((formato) => ({
    formato,
    linhas: filtrarPorFormato(linhas, formato),
    // Histórico sempre dentro do MESMO formato: a meta é por Departamento×Formato,
    // e um item pode ser crônico no Atacado e saudável no Varejo.
    gapAnterior: linhasAnteriores.map((doMes) => gapPorSku(filtrarPorFormato(doMes, formato), resolverMeta)),
  }));

  // Um arquivo por Comprador × Formato (decisão de 2026-10-02, revendo a de
  // 2026-10-01): o time trabalha Varejo e Atacado separados, e um PDF só com os
  // dois dentro obrigava a pessoa a achar a sua metade. Quem não atua num
  // formato simplesmente não ganha arquivo dele.
  const arquivos: { nome: string; bytes: Uint8Array }[] = [];
  for (const comprador of pedidos) {
    for (const base of porFormatoBase) {
      const resumo = priorizarComprador(base.linhas, comprador, base.formato, indiceComprador, resolverMeta, {
        piso,
        diasDoPeriodo: diasDoPeriodo(meses),
        gapAnterior: base.gapAnterior,
        nomeDepartamento,
        dataCadastro,
      });
      if (resumo.metricas.venda <= 0 && resumo.metricas.compra <= 0) continue;
      const bytes = await gerarPdfComprador({
        comprador,
        porFormato: [resumo],
        periodo,
        lojas: lojasCadastro,
        geradoEm,
      });
      arquivos.push({ nome: nomeDeArquivo(base.formato, comprador, recorte), bytes });
    }
  }

  if (arquivos.length === 0) return NextResponse.json({ erro: "Nenhum comprador com movimento no recorte" }, { status: 400 });

  if (arquivos.length === 1) {
    const unico = arquivos[0];
    return new NextResponse(unico.bytes as unknown as BodyInit, {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": anexo(unico.nome) },
    });
  }

  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  for (const arquivo of arquivos) zip.file(arquivo.nome, arquivo.bytes);
  const conteudo = await zip.generateAsync({ type: "nodebuffer" });
  return new NextResponse(conteudo as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": anexo(`Compra_Venda_${recorte.inicio} à ${recorte.fim}.zip`),
    },
  });
}

/** Quem receberia PDF no recorte atual — alimenta o seletor do botão. */
export async function GET(request: Request) {
  if (!autorizado(request)) return NextResponse.json({ habilitado: false, compradores: [] });
  const departamentos = await obterOuSemearDepartamentosCadastro();
  const nomes = new Set<string>();
  for (const d of departamentos) {
    if (d.mesmoCompradorTodosFormatos) {
      if (d.comprador) nomes.add(d.comprador);
    } else {
      for (const nome of Object.values(d.compradorPorFormato)) if (nome) nomes.add(nome);
    }
  }
  return NextResponse.json({
    habilitado: true,
    compradores: Array.from(nomes)
      .filter((n) => !/^s\/\s*comprador$/i.test(n))
      .sort((a, b) => a.localeCompare(b, "pt-BR")),
  });
}
