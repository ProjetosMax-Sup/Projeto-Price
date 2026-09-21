import { ARQUIVOS_DESEMPENHO_COMERCIAL, arquivosMensaisDisponiveis, CABECALHO_REFERENCIA_MENSAL } from "@/config/data-sources";
import { baixarArquivo, baixarArquivoBuffer, listarNomesArquivos, obterVersaoArquivo } from "@/lib/onedrive/graph";
import { criarCacheVersionado } from "./cache-versionado";
import { decodificarComFallback } from "./parse-tabela";
import { normalizarLojas, normalizarMovimentos, normalizarProdutos, unirMovimentos } from "./normalizar-desempenho";
import type { Loja, PeriodoDesempenho, Produto } from "@/lib/types";
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

/** Quais `bd<Mês>.txt` existem de fato na pasta do OneDrive agora (ordem cronológica). */
async function listarArquivosMensais(): Promise<ArquivoConfig[]> {
  const nomes = await listarNomesArquivos().catch(() => [] as string[]);
  return arquivosMensaisDisponiveis(nomes);
}

/** Combinação de nome+eTag de cada mês encontrado — muda sozinho quando um mês novo
 * é subido ou algum arquivo existente é sobrescrito. */
async function versaoMensal(): Promise<string> {
  const arquivos = await listarArquivosMensais();
  const partes = await Promise.all(arquivos.map(async (a) => `${a.nome}:${await obterVersaoArquivo(a.nome).catch(() => "erro")}`));
  return partes.join(",");
}

const getDesempenhoCache = criarCacheVersionado(versaoMensal, async (): Promise<PeriodoDesempenho> => {
  const [arquivos, { produtosPorCodigo, lojasPorCodigo }] = await Promise.all([listarArquivosMensais(), indices()]);
  const resultados = await Promise.all(
    arquivos.map(async (arquivo): Promise<PeriodoDesempenho | null> => {
      try {
        const buffer = await baixarArquivoBuffer(arquivo.nome);
        const conteudo = decodificarComFallback(buffer, arquivo.encoding, CABECALHO_REFERENCIA_MENSAL, arquivo.nome);
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

/** Lê os arquivos direto do OneDrive via Microsoft Graph — usado em produção (Vercel). */
export function createOneDriveDataProvider(): DataProvider {
  return {
    getLojas: getLojasCache,
    getProdutos: getProdutosCache,
    getDesempenho: getDesempenhoCache,
  };
}
