import { readFile, stat } from "fs/promises";
import path from "path";
import { ARQUIVOS_DESEMPENHO_COMERCIAL, DESEMPENHO_COMERCIAL_DATA_DIR } from "@/config/data-sources";
import { normalizarLojas, normalizarPeriodo, normalizarProdutos } from "./normalizar-desempenho";
import type { Loja, Produto } from "@/lib/types";
import type { DataProvider } from "./types";

interface ArquivoConfig {
  nome: string;
  encoding: BufferEncoding;
}

const caminho = (arquivo: ArquivoConfig) => path.join(DESEMPENHO_COMERCIAL_DATA_DIR, arquivo.nome);

async function lerConteudo(arquivo: ArquivoConfig): Promise<string> {
  const buffer = await readFile(caminho(arquivo));
  return buffer.toString(arquivo.encoding);
}

/** Cache em memória do processo, invalidado quando o arquivo muda (mtime). */
function criarCacheArquivo<T>(carregar: () => Promise<T>, arquivo: ArquivoConfig) {
  let cache: { mtimeMs: number; valor: Promise<T> } | null = null;
  return async (): Promise<T> => {
    const stats = await stat(caminho(arquivo)).catch(() => null);
    const mtimeMs = stats?.mtimeMs ?? -1;
    if (cache && cache.mtimeMs === mtimeMs) return cache.valor;
    const valor = carregar();
    cache = { mtimeMs, valor };
    return valor;
  };
}

// Caches em nível de módulo (não por instância) para persistir entre requisições
// do mesmo processo — os arquivos reais são grandes (dezenas de MB, centenas de
// milhares de linhas) e reprocessá-los a cada requisição seria muito lento.
const getLojasCache = criarCacheArquivo(
  async () => normalizarLojas(await lerConteudo(ARQUIVOS_DESEMPENHO_COMERCIAL.lojas)),
  ARQUIVOS_DESEMPENHO_COMERCIAL.lojas,
);

const getProdutosCache = criarCacheArquivo(
  async () => normalizarProdutos(await lerConteudo(ARQUIVOS_DESEMPENHO_COMERCIAL.cadastro)),
  ARQUIVOS_DESEMPENHO_COMERCIAL.cadastro,
);

async function indices() {
  const [produtos, lojas] = await Promise.all([getProdutosCache(), getLojasCache()]);
  return {
    produtosPorCodigo: new Map(produtos.map((p: Produto) => [p.codigo, p])),
    lojasPorCodigo: new Map(lojas.map((l: Loja) => [l.codUnid, l])),
  };
}

const getAtualCache = criarCacheArquivo(async () => {
  const [conteudo, { produtosPorCodigo, lojasPorCodigo }] = await Promise.all([
    lerConteudo(ARQUIVOS_DESEMPENHO_COMERCIAL.atual),
    indices(),
  ]);
  return normalizarPeriodo(conteudo, produtosPorCodigo, lojasPorCodigo);
}, ARQUIVOS_DESEMPENHO_COMERCIAL.atual);

const getComparacaoCache = criarCacheArquivo(async () => {
  const [conteudo, { produtosPorCodigo, lojasPorCodigo }] = await Promise.all([
    lerConteudo(ARQUIVOS_DESEMPENHO_COMERCIAL.comparacao),
    indices(),
  ]);
  return normalizarPeriodo(conteudo, produtosPorCodigo, lojasPorCodigo);
}, ARQUIVOS_DESEMPENHO_COMERCIAL.comparacao);

/** Lê os arquivos direto do disco — usado em desenvolvimento local (DESEMPENHO_COMERCIAL_DATA_DIR). */
export function createFileDataProvider(): DataProvider {
  return {
    getLojas: getLojasCache,
    getProdutos: getProdutosCache,
    getDesempenhoAtual: getAtualCache,
    getDesempenhoComparacao: getComparacaoCache,
  };
}
