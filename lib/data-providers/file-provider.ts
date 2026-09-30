import { readdir, readFile, stat } from "fs/promises";
import path from "path";
import { ARQUIVOS_DESEMPENHO_COMERCIAL, arquivosMensaisDisponiveis, CABECALHO_REFERENCIA_MENSAL, DESEMPENHO_COMERCIAL_DATA_DIR } from "@/config/data-sources";
import { criarCacheVersionado } from "./cache-versionado";
import { decodificarComFallback } from "./parse-tabela";
import { normalizarLojas, normalizarMovimentos, normalizarProdutos, unirMovimentos } from "./normalizar-desempenho";
import { normalizarEntradasSaidas } from "./normalizar-entradas-saidas";
import { reduzirPorProdutoLoja, type LinhaReduzida } from "@/lib/entradas-saidas/aggregate";
import type { Loja, PeriodoDesempenho, Produto } from "@/lib/types";
import type { DataProvider } from "./types";

interface ArquivoConfig {
  nome: string;
  encoding: BufferEncoding;
}

const caminho = (arquivo: ArquivoConfig) => path.join(DESEMPENHO_COMERCIAL_DATA_DIR, arquivo.nome);

async function lerConteudoBuffer(arquivo: ArquivoConfig): Promise<Buffer> {
  return readFile(caminho(arquivo));
}

async function lerConteudo(arquivo: ArquivoConfig): Promise<string> {
  return (await lerConteudoBuffer(arquivo)).toString(arquivo.encoding);
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
        const buffer = await lerConteudoBuffer(arquivo);
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

/**
 * Cache do Entradas e Saídas — **por arquivo mensal, já reduzido**, ao
 * contrário de `getDesempenhoCache` (que guarda TODOS os meses brutos pra
 * sempre). Motivo: os dois datasets brutos completos (~7-8GB cada) chegaram a
 * coexistir no mesmo processo e derrubar o servidor por falta de memória
 * (confirmado em 2026-09-30 — "JavaScript heap out of memory" com os dois
 * módulos acessados ao mesmo tempo, mesmo processo, heap de 8GB).
 *
 * Como o Entradas e Saídas sempre opera num mês só por vez (decisão de
 * 2026-09-30, sem Atual/Comparação), não precisa reter os 9 meses de
 * registros brutos — só o resultado já reduzido por Produto×Loja de CADA
 * arquivo (ordens de grandeza menor: dezenas de milhares de linhas, não
 * milhões). `RegistroEntradasSaidas[]` de um arquivo nunca sai do escopo desta
 * função — fica elegível pro GC assim que a redução termina.
 */
const cacheReducaoPorArquivo = new Map<string, { versao: number; linhas: LinhaReduzida[] }>();

async function linhasReduzidasDoArquivo(
  arquivo: ArquivoConfig,
  produtosPorCodigo: Map<string, Produto>,
  lojasPorCodigo: Map<string, Loja>,
): Promise<LinhaReduzida[]> {
  const versao = await mtime(arquivo);
  const emCache = cacheReducaoPorArquivo.get(arquivo.nome);
  if (emCache && emCache.versao === versao) return emCache.linhas;

  const buffer = await lerConteudoBuffer(arquivo);
  const conteudo = decodificarComFallback(buffer, arquivo.encoding, CABECALHO_REFERENCIA_MENSAL, arquivo.nome);
  const registros = normalizarEntradasSaidas(conteudo, produtosPorCodigo, lojasPorCodigo);
  const linhas = reduzirPorProdutoLoja(registros);
  cacheReducaoPorArquivo.set(arquivo.nome, { versao, linhas });
  return linhas;
}

/**
 * Linhas reduzidas do Entradas e Saídas — só do(s) arquivo(s) pedido(s)
 * (`nomesArquivo`, ex: `["bdSetembro.txt"]`) ou de todos os meses disponíveis
 * se omitido. Um mês fora do padrão nunca derruba os demais — loga alto e
 * segue sem ele, mesmo comportamento de `getDesempenhoCache`.
 */
async function getLinhasReduzidasEntradasSaidas(nomesArquivo?: string[]): Promise<LinhaReduzida[]> {
  const [arquivos, { produtosPorCodigo, lojasPorCodigo }] = await Promise.all([listarArquivosMensais(), indices()]);
  const alvo = nomesArquivo ? arquivos.filter((a) => nomesArquivo.includes(a.nome)) : arquivos;
  const resultados = await Promise.all(
    alvo.map((arquivo) =>
      linhasReduzidasDoArquivo(arquivo, produtosPorCodigo, lojasPorCodigo).catch((erro) => {
        console.error(`Falha ao processar ${arquivo.nome} (Entradas e Saídas), excluído do conjunto:`, erro);
        return [] as LinhaReduzida[];
      }),
    ),
  );
  return resultados.flat();
}

/** Nomes (`bd<Mês>.txt`) dos arquivos mensais disponíveis agora — pra montar o
 * seletor de período do Entradas e Saídas sem precisar ler/reduzir nenhum
 * arquivo (só `readdir`, igual `listarArquivosMensais`). */
async function listarNomesArquivosMensais(): Promise<string[]> {
  return (await listarArquivosMensais()).map((a) => a.nome);
}

/** Lê os arquivos direto do disco — usado em desenvolvimento local (DESEMPENHO_COMERCIAL_DATA_DIR). */
export function createFileDataProvider(): DataProvider {
  return {
    getLojas: getLojasCache,
    getProdutos: getProdutosCache,
    getDesempenho: getDesempenhoCache,
  };
}

/**
 * Fora da interface `DataProvider` de propósito (ainda só existe caminho
 * local — sem suporte a OneDrive/produção, ver docs/exemplos-motor-colunas).
 * Quando o Entradas e Saídas precisar rodar em produção, migrar pra um método
 * opcional em `DataProvider`, igual `getDesempenho`.
 */
export function getEntradasSaidasReduzido(nomesArquivo?: string[]): Promise<LinhaReduzida[]> {
  return getLinhasReduzidasEntradasSaidas(nomesArquivo);
}

export function getMesesDisponiveisEntradasSaidas(): Promise<string[]> {
  return listarNomesArquivosMensais();
}
