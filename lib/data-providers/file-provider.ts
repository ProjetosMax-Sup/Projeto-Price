import { readFile, stat } from "fs/promises";
import path from "path";
import { ARQUIVOS_DESEMPENHO_COMERCIAL, DELIMITADOR, DESEMPENHO_COMERCIAL_DATA_DIR } from "@/config/data-sources";
import type { Loja, MovimentoVendas, PeriodoDesempenho, Produto } from "@/lib/types";
import type { DataProvider } from "./types";

interface ArquivoConfig {
  nome: string;
  encoding: BufferEncoding;
}

/**
 * Lê um TXT pipe-delimited com cabeçalho de 2 linhas (nome + complemento, unidos
 * como "{linha1} {linha2}"). Quando `duasLinhasHeader` é false, a primeira linha
 * já é o cabeçalho final (caso do bdLojas).
 *
 * Extrai só os `campos` pedidos (por nome, resolvido pela primeira ocorrência no
 * cabeçalho) em vez de montar um objeto com todas as colunas — os arquivos reais
 * têm dezenas/centenas de colunas que não usamos (ex: bdCadastro tem ~130) e
 * podem ter nomes repetidos (que a junção com a linha 2 normalmente desambigua).
 * Um campo pedido que não existir no arquivo (ex: "Unidade Código" em
 * bdDesempenhoComercialAtual.txt, que não tem esse recorte) vira sempre "".
 */
async function lerTabela<T extends string>(
  arquivo: ArquivoConfig,
  campos: readonly T[],
  duasLinhasHeader = true,
): Promise<Record<T, string>[]> {
  const caminho = path.join(DESEMPENHO_COMERCIAL_DATA_DIR, arquivo.nome);
  const buffer = await readFile(caminho);
  const conteudo = buffer.toString(arquivo.encoding);
  const linhas = conteudo.split(/\r\n|\n/).filter((linha) => linha.length > 0);

  let colunas: string[];
  let primeiraLinhaDados: number;

  if (duasLinhasHeader) {
    const linha1 = linhas[0]?.split(DELIMITADOR) ?? [];
    const linha2 = linhas[1]?.split(DELIMITADOR) ?? [];
    colunas = linha1.map((nome, i) => {
      const complemento = linha2[i]?.trim();
      return complemento ? `${nome.trim()} ${complemento}` : nome.trim();
    });
    primeiraLinhaDados = 2;
  } else {
    colunas = (linhas[0]?.split(DELIMITADOR) ?? []).map((nome) => nome.trim());
    primeiraLinhaDados = 1;
  }

  // Primeira ocorrência de cada campo pedido — evita colisão se algum nome se repetir.
  const indices = campos.map((campo) => colunas.indexOf(campo));

  const linhasDados = linhas.slice(primeiraLinhaDados);
  const resultado: Record<T, string>[] = new Array(linhasDados.length);

  for (let i = 0; i < linhasDados.length; i++) {
    const valores = linhasDados[i].split(DELIMITADOR);
    const registro = {} as Record<T, string>;
    for (let c = 0; c < campos.length; c++) {
      const idx = indices[c];
      registro[campos[c]] = idx === -1 ? "" : (valores[idx]?.trim() ?? "");
    }
    resultado[i] = registro;
  }

  return resultado;
}

/** Cache em memória do processo, invalidado quando o arquivo muda (mtime). */
function criarCacheArquivo<T>(carregar: () => Promise<T>, obterCaminho: () => string) {
  let cache: { mtimeMs: number; valor: Promise<T> } | null = null;
  return async (): Promise<T> => {
    const stats = await stat(obterCaminho()).catch(() => null);
    const mtimeMs = stats?.mtimeMs ?? -1;
    if (cache && cache.mtimeMs === mtimeMs) return cache.valor;
    const valor = carregar();
    cache = { mtimeMs, valor };
    return valor;
  };
}

/** Números do arquivo usam vírgula decimal (padrão BR). */
function parseNumeroBr(valor: string | undefined): number {
  if (!valor) return 0;
  const normalizado = valor.replace(/\./g, "").replace(",", ".");
  const numero = Number(normalizado);
  return Number.isFinite(numero) ? numero : 0;
}

/** Hierarquia mercadológica incompleta (ex: cai em "Verificar Dpto") — ver regra de negócio no CLAUDE.md. */
function isCadastroIncompleto(hierarquiaGrupos: string): boolean {
  const niveis = hierarquiaGrupos.split(",").map((n) => n.trim()).filter(Boolean);
  return niveis.length < 5 || hierarquiaGrupos.toLowerCase().includes("verificar");
}

const CAMPOS_LOJA = ["Cód Unid", "Cód Unid Reduzido", "Nome Sistema", "Nome Loja", "Formato"] as const;

async function carregarLojas(): Promise<Loja[]> {
  const linhas = await lerTabela(ARQUIVOS_DESEMPENHO_COMERCIAL.lojas, CAMPOS_LOJA, false);
  return linhas.map((l) => ({
    codUnid: l["Cód Unid"],
    codUnidReduzido: l["Cód Unid Reduzido"],
    nomeSistema: l["Nome Sistema"],
    nomeLoja: l["Nome Loja"],
    formato: l["Formato"] === "Atacado" ? "Atacado" : "Varejo",
  }));
}

const CAMPOS_PRODUTO = ["Código", "Dpto", "Grupo", "Nome Grupo", "Hierarquia de Grupos", "Compr", "Nome Comprador"] as const;

async function carregarProdutos(): Promise<Produto[]> {
  const linhas = await lerTabela(ARQUIVOS_DESEMPENHO_COMERCIAL.cadastro, CAMPOS_PRODUTO, true);
  return linhas.map((l) => {
    const hierarquiaGrupos = l["Hierarquia de Grupos"];
    return {
      codigo: l["Código"],
      dpto: l["Dpto"],
      grupo: l["Grupo"],
      nomeGrupo: l["Nome Grupo"],
      hierarquiaGrupos,
      comprador: l["Compr"],
      nomeComprador: l["Nome Comprador"],
      cadastroIncompleto: isCadastroIncompleto(hierarquiaGrupos),
    };
  });
}

// "Descricao" sem acento e sem "Unidade Código/Nome" em bdDesempenhoComercialAtual.txt
// (esse recorte não tem quebra por loja — ver aviso em CLAUDE.md). Campos ausentes no
// arquivo voltam como "" pelo lerTabela, então funciona para os dois arquivos.
const CAMPOS_MOVIMENTO = [
  "Código",
  "Descricao",
  "Complemento",
  "Marca",
  "Código Barras",
  "Unidade Código",
  "Unidade Nome",
  "Qtde Vendas",
  "Valor",
  "Lucros",
  "Qtde Vendas Oferta",
  "Vendas Oferta",
  "Lucros Oferta",
] as const;

function linhaParaMovimento(l: Record<(typeof CAMPOS_MOVIMENTO)[number], string>): MovimentoVendas {
  const qtdeVendasTotal = parseNumeroBr(l["Qtde Vendas"]);
  const valorTotal = parseNumeroBr(l["Valor"]);
  const lucrosTotal = parseNumeroBr(l["Lucros"]);
  const qtdeVendasOferta = parseNumeroBr(l["Qtde Vendas Oferta"]);
  const vendasOferta = parseNumeroBr(l["Vendas Oferta"]);
  const lucrosOferta = parseNumeroBr(l["Lucros Oferta"]);

  return {
    codigo: l["Código"],
    descricao: l["Descricao"],
    complemento: l["Complemento"],
    marca: l["Marca"],
    codigoBarras: l["Código Barras"],
    unidadeCodigo: l["Unidade Código"],
    unidadeNome: l["Unidade Nome"],
    qtdeVendasTotal,
    valorTotal,
    lucrosTotal,
    qtdeVendasOferta,
    vendasOferta,
    lucrosOferta,
    // Regular = Total − Oferta (calculado, não vem do arquivo)
    qtdeVendasRegular: qtdeVendasTotal - qtdeVendasOferta,
    vendasRegular: valorTotal - vendasOferta,
    lucrosRegular: lucrosTotal - lucrosOferta,
  };
}

async function carregarPeriodo(
  arquivo: ArquivoConfig,
  produtosPorCodigo: Map<string, Produto>,
  lojasPorCodigo: Map<string, Loja>,
): Promise<PeriodoDesempenho> {
  const linhas = await lerTabela(arquivo, CAMPOS_MOVIMENTO, true);
  let produtosDescartados = 0;

  const registros = linhas
    .map((l) => {
      const movimento = linhaParaMovimento(l);
      const produto = produtosPorCodigo.get(movimento.codigo) ?? null;
      const loja = movimento.unidadeCodigo ? (lojasPorCodigo.get(movimento.unidadeCodigo) ?? null) : null;
      return { movimento, produto, loja };
    })
    .filter(({ movimento, produto }) => {
      const descartar = (produto?.cadastroIncompleto ?? false) && movimento.qtdeVendasTotal > 0;
      if (descartar) produtosDescartados += 1;
      return !descartar;
    });

  return { registros, produtosDescartados };
}

// Caches em nível de módulo (não por instância) para persistir entre requisições
// do mesmo processo — os arquivos reais são grandes (dezenas de MB, centenas de
// milhares de linhas) e reprocessá-los a cada requisição seria muito lento.
const caminho = (arquivo: ArquivoConfig) => path.join(DESEMPENHO_COMERCIAL_DATA_DIR, arquivo.nome);

const getLojasCache = criarCacheArquivo(carregarLojas, () => caminho(ARQUIVOS_DESEMPENHO_COMERCIAL.lojas));
const getProdutosCache = criarCacheArquivo(carregarProdutos, () => caminho(ARQUIVOS_DESEMPENHO_COMERCIAL.cadastro));

async function indices() {
  const [produtos, lojas] = await Promise.all([getProdutosCache(), getLojasCache()]);
  return {
    produtosPorCodigo: new Map(produtos.map((p) => [p.codigo, p])),
    lojasPorCodigo: new Map(lojas.map((l) => [l.codUnid, l])),
  };
}

const getAtualCache = criarCacheArquivo(
  async () => {
    const { produtosPorCodigo, lojasPorCodigo } = await indices();
    return carregarPeriodo(ARQUIVOS_DESEMPENHO_COMERCIAL.atual, produtosPorCodigo, lojasPorCodigo);
  },
  () => caminho(ARQUIVOS_DESEMPENHO_COMERCIAL.atual),
);

const getComparacaoCache = criarCacheArquivo(
  async () => {
    const { produtosPorCodigo, lojasPorCodigo } = await indices();
    return carregarPeriodo(ARQUIVOS_DESEMPENHO_COMERCIAL.comparacao, produtosPorCodigo, lojasPorCodigo);
  },
  () => caminho(ARQUIVOS_DESEMPENHO_COMERCIAL.comparacao),
);

export function createFileDataProvider(): DataProvider {
  return {
    getLojas: getLojasCache,
    getProdutos: getProdutosCache,
    getDesempenhoAtual: getAtualCache,
    getDesempenhoComparacao: getComparacaoCache,
  };
}
