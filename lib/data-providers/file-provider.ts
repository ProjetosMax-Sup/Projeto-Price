import { readdir, readFile, stat } from "fs/promises";
import path from "path";
import { ARQUIVOS_DESEMPENHO_COMERCIAL, arquivosMensaisDisponiveis, DESEMPENHO_COMERCIAL_DATA_DIR } from "@/config/data-sources";
import { criarCacheVersionado } from "./cache-versionado";
import { normalizarLojas, normalizarMovimentos, normalizarProdutos, unirMovimentos } from "./normalizar-desempenho";
import type { Loja, PeriodoDesempenho, Produto } from "@/lib/types";
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

/** Quais `bd<Mês>.txt` existem de fato na pasta agora (ordem cronológica, meses ausentes ignorados). */
async function listarArquivosMensais(): Promise<ArquivoConfig[]> {
  const nomes = await readdir(DESEMPENHO_COMERCIAL_DATA_DIR).catch(() => [] as string[]);
  return arquivosMensaisDisponiveis(nomes);
}

/** Combinação de nome+mtime de cada mês encontrado — muda sozinho quando um mês novo
 * aparece (ex: Julho sendo subido) ou algum arquivo existente é sobrescrito. */
async function versaoMensal(): Promise<string> {
  const arquivos = await listarArquivosMensais();
  const partes = await Promise.all(arquivos.map(async (a) => `${a.nome}:${await mtime(a)}`));
  return partes.join(",");
}

const getDesempenhoCache = criarCacheVersionado(versaoMensal, async (): Promise<PeriodoDesempenho> => {
  const [arquivos, { produtosPorCodigo, lojasPorCodigo }] = await Promise.all([listarArquivosMensais(), indices()]);
  const resultados = await Promise.all(
    arquivos.map(async (arquivo): Promise<PeriodoDesempenho | null> => {
      try {
        const conteudo = await lerConteudo(arquivo);
        return normalizarMovimentos(conteudo, produtosPorCodigo, lojasPorCodigo, arquivo.nome);
      } catch (erro) {
        // Um mês fora do padrão nunca derruba os demais — loga alto e segue sem ele.
        console.error(`Falha ao processar ${arquivo.nome}, excluído do conjunto:`, erro);
        return null;
      }
    }),
  );
  return unirMovimentos(resultados.filter((r): r is PeriodoDesempenho => r !== null));
});

/** Lê os arquivos direto do disco — usado em desenvolvimento local (DESEMPENHO_COMERCIAL_DATA_DIR). */
export function createFileDataProvider(): DataProvider {
  return {
    getLojas: getLojasCache,
    getProdutos: getProdutosCache,
    getDesempenho: getDesempenhoCache,
  };
}
