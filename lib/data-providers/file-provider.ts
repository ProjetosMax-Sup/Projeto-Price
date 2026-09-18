import { readFile, stat } from "fs/promises";
import path from "path";
import { ARQUIVOS_DESEMPENHO_COMERCIAL, DESEMPENHO_COMERCIAL_DATA_DIR } from "@/config/data-sources";
import { criarCacheVersionado } from "./cache-versionado";
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

async function mtime(arquivo: ArquivoConfig): Promise<number> {
  const stats = await stat(caminho(arquivo)).catch(() => null);
  return stats?.mtimeMs ?? -1;
}

function criarCacheArquivo<T>(carregar: (conteudo: string) => T, arquivo: ArquivoConfig) {
  return criarCacheVersionado(
    () => mtime(arquivo),
    async () => carregar(await lerConteudo(arquivo)),
  );
}

const getLojasCache = criarCacheArquivo(normalizarLojas, ARQUIVOS_DESEMPENHO_COMERCIAL.lojas);
const getProdutosCache = criarCacheArquivo(normalizarProdutos, ARQUIVOS_DESEMPENHO_COMERCIAL.cadastro);

async function indices() {
  const [produtos, lojas] = await Promise.all([getProdutosCache(), getLojasCache()]);
  return {
    produtosPorCodigo: new Map(produtos.map((p: Produto) => [p.codigo, p])),
    lojasPorCodigo: new Map(lojas.map((l: Loja) => [l.codUnid, l])),
  };
}

function criarCachePeriodo(arquivo: ArquivoConfig) {
  return criarCacheVersionado(
    () => mtime(arquivo),
    async () => {
      const [conteudo, { produtosPorCodigo, lojasPorCodigo }] = await Promise.all([
        lerConteudo(arquivo),
        indices(),
      ]);
      return normalizarPeriodo(conteudo, produtosPorCodigo, lojasPorCodigo);
    },
  );
}

const getAtualCache = criarCachePeriodo(ARQUIVOS_DESEMPENHO_COMERCIAL.atual);
const getComparacaoCache = criarCachePeriodo(ARQUIVOS_DESEMPENHO_COMERCIAL.comparacao);

/** Lê os arquivos direto do disco — usado em desenvolvimento local (DESEMPENHO_COMERCIAL_DATA_DIR). */
export function createFileDataProvider(): DataProvider {
  return {
    getLojas: getLojasCache,
    getProdutos: getProdutosCache,
    getDesempenhoAtual: getAtualCache,
    getDesempenhoComparacao: getComparacaoCache,
  };
}
