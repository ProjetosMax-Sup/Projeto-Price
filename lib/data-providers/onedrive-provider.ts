import { ARQUIVOS_DESEMPENHO_COMERCIAL } from "@/config/data-sources";
import { baixarArquivo, obterVersaoArquivo } from "@/lib/onedrive/graph";
import { normalizarLojas, normalizarPeriodo, normalizarProdutos } from "./normalizar-desempenho";
import type { Loja, Produto } from "@/lib/types";
import type { DataProvider } from "./types";

interface ArquivoConfig {
  nome: string;
  encoding: BufferEncoding;
}

/** Cache em memória do processo, invalidado quando o eTag do arquivo no OneDrive muda. */
function criarCacheArquivo<T>(carregar: (conteudo: string) => Promise<T> | T, arquivo: ArquivoConfig) {
  let cache: { versao: string; valor: Promise<T> } | null = null;
  return async (): Promise<T> => {
    const versao = await obterVersaoArquivo(arquivo.nome).catch(() => "erro");
    if (cache && cache.versao === versao) return cache.valor;
    const valor = baixarArquivo(arquivo.nome, arquivo.encoding).then(carregar);
    cache = { versao, valor };
    return valor;
  };
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

const getAtualCache = criarCacheArquivo(async (conteudo) => {
  const { produtosPorCodigo, lojasPorCodigo } = await indices();
  return normalizarPeriodo(conteudo, produtosPorCodigo, lojasPorCodigo);
}, ARQUIVOS_DESEMPENHO_COMERCIAL.atual);

const getComparacaoCache = criarCacheArquivo(async (conteudo) => {
  const { produtosPorCodigo, lojasPorCodigo } = await indices();
  return normalizarPeriodo(conteudo, produtosPorCodigo, lojasPorCodigo);
}, ARQUIVOS_DESEMPENHO_COMERCIAL.comparacao);

/** Lê os arquivos direto do OneDrive via Microsoft Graph — usado em produção (Vercel). */
export function createOneDriveDataProvider(): DataProvider {
  return {
    getLojas: getLojasCache,
    getProdutos: getProdutosCache,
    getDesempenhoAtual: getAtualCache,
    getDesempenhoComparacao: getComparacaoCache,
  };
}
