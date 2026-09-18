import { ARQUIVOS_DESEMPENHO_COMERCIAL } from "@/config/data-sources";
import { baixarArquivo, obterVersaoArquivo } from "@/lib/onedrive/graph";
import { criarCacheVersionado } from "./cache-versionado";
import { normalizarLojas, normalizarPeriodo, normalizarProdutos } from "./normalizar-desempenho";
import type { Loja, Produto } from "@/lib/types";
import type { DataProvider } from "./types";

interface ArquivoConfig {
  nome: string;
  encoding: BufferEncoding;
}

function criarCacheArquivo<T>(carregar: (conteudo: string) => T, arquivo: ArquivoConfig) {
  return criarCacheVersionado(
    () => obterVersaoArquivo(arquivo.nome).catch(() => "erro"),
    async () => carregar(await baixarArquivo(arquivo.nome, arquivo.encoding)),
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
    () => obterVersaoArquivo(arquivo.nome).catch(() => "erro"),
    async () => {
      const [conteudo, { produtosPorCodigo, lojasPorCodigo }] = await Promise.all([
        baixarArquivo(arquivo.nome, arquivo.encoding),
        indices(),
      ]);
      return normalizarPeriodo(conteudo, produtosPorCodigo, lojasPorCodigo);
    },
  );
}

const getAtualCache = criarCachePeriodo(ARQUIVOS_DESEMPENHO_COMERCIAL.atual);
const getComparacaoCache = criarCachePeriodo(ARQUIVOS_DESEMPENHO_COMERCIAL.comparacao);

/** Lê os arquivos direto do OneDrive via Microsoft Graph — usado em produção (Vercel). */
export function createOneDriveDataProvider(): DataProvider {
  return {
    getLojas: getLojasCache,
    getProdutos: getProdutosCache,
    getDesempenhoAtual: getAtualCache,
    getDesempenhoComparacao: getComparacaoCache,
  };
}
