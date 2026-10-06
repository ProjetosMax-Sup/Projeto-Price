import { mkdir, readFile, rename, writeFile } from "fs/promises";
import Redis from "ioredis";
import path from "path";
import { lojaExcluida } from "@/config/data-sources";
import { semearDicionarioColunas } from "@/lib/parametros/dicionario";
import { migrarConfigRelatorio, migrarDicionario } from "@/lib/parametros/migracao-refs";
import {
  semearColunasCompraVenda,
  semearColunasDesempenhoComercial,
  semearColunasEntradasSaidas,
  semearDepartamentosCadastro,
  semearLojasCadastro,
} from "@/lib/parametros/seed";
import type { ColunaNativa, ConfigRelatorio, DepartamentoCadastro, LojaCadastro } from "@/lib/parametros/types";

/**
 * Cadastro de Lojas, Departamentos e Colunas, editável pela tela /parametros.
 *
 * Dois back-ends, escolhidos pela presença de `REDIS_URL` (mesmo padrão de
 * `getDataProvider()`, ver lib/data-providers/index.ts): com Redis
 * configurado (produção, Vercel) usa Redis, como sempre foi; sem Redis
 * (desenvolvimento local, sem nenhuma conta de nuvem) cai pra arquivos JSON
 * locais em `PARAMETROS_DATA_DIR` (padrão: `./data/parametros`), escrita
 * atômica (grava em `.tmp` e renomeia) pra nunca deixar um arquivo corrompido
 * pela metade se o processo cair no meio da escrita. Mesma chave→valor nos
 * dois casos, só muda onde fica guardado — nenhum código fora deste arquivo
 * precisa saber qual dos dois está em uso.
 */

const CHAVE_LOJAS = "lojas";
const CHAVE_DEPARTAMENTOS = "departamentos";
const CHAVE_DICIONARIO = "dicionario-colunas";
const chaveConfigRelatorio = (modulo: string) => `relatorio-${modulo}`;

// --- back-end Redis (produção) -------------------------------------------

// Client reaproveitado entre chamadas (mesmo padrão de lib/onedrive/token-store.ts) — uma conexão
// nova por leitura/escrita custaria um handshake TCP+auth a cada request, inclusive em
// lerUsuariosCadastro-like reads, chamadas em toda request.
let clienteRedis: Redis | null = null;
function obterClienteRedis(): Redis {
  if (clienteRedis) return clienteRedis;
  clienteRedis = new Redis(process.env.REDIS_URL!);
  return clienteRedis;
}

async function lerRedis<T>(chave: string): Promise<T | null> {
  const bruto = await obterClienteRedis().get(`parametros:${chave}`);
  return bruto ? (JSON.parse(bruto) as T) : null;
}

async function salvarRedis(chave: string, valor: unknown): Promise<void> {
  await obterClienteRedis().set(`parametros:${chave}`, JSON.stringify(valor));
}

// --- back-end arquivo local (desenvolvimento, sem contas de nuvem) -------

const PASTA_DADOS_LOCAL = process.env.PARAMETROS_DATA_DIR || path.join(process.cwd(), "data", "parametros");

// PASTA_DADOS_LOCAL vem de env var (dinâmico aos olhos do bundler) — turbopackIgnore evita que o
// Next tente rastrear/empacotar o projeto inteiro por causa desse acesso a arquivo (ver aviso de
// build "Dynamic filesystem access"); só roda em desenvolvimento local, nunca em runtime
// serverless, então esse rastreamento de output não se aplica aqui.
async function lerArquivoLocal<T>(chave: string): Promise<T | null> {
  try {
    const bruto = await readFile(/* turbopackIgnore: true */ path.join(PASTA_DADOS_LOCAL, `${chave}.json`), "utf8");
    return JSON.parse(bruto) as T;
  } catch (erro) {
    if ((erro as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw erro;
  }
}

async function salvarArquivoLocal(chave: string, valor: unknown): Promise<void> {
  await mkdir(/* turbopackIgnore: true */ PASTA_DADOS_LOCAL, { recursive: true });
  const destino = path.join(PASTA_DADOS_LOCAL, `${chave}.json`);
  const temporario = `${destino}.tmp`;
  await writeFile(temporario, JSON.stringify(valor, null, 2), "utf8");
  await rename(temporario, destino);
}

// --- seleção do back-end ---------------------------------------------------

function usaRedis(): boolean {
  return Boolean(process.env.REDIS_URL);
}

async function ler<T>(chave: string): Promise<T | null> {
  return usaRedis() ? lerRedis<T>(chave) : lerArquivoLocal<T>(chave);
}

async function salvar(chave: string, valor: unknown): Promise<void> {
  return usaRedis() ? salvarRedis(chave, valor) : salvarArquivoLocal(chave, valor);
}

// --- API pública (igual nos dois back-ends) -------------------------------

export async function lerLojasCadastro(): Promise<LojaCadastro[] | null> {
  return ler<LojaCadastro[]>(CHAVE_LOJAS);
}

/**
 * Grava o cadastro de Lojas preservando as lojas excluídas da plataforma
 * (`LOJAS_EXCLUIDAS`). Quem chama daqui — a tela /parametros — só enxerga a
 * lista já filtrada por `obterOuSemearLojasCadastro`, então salvar o que veio
 * da tela apagaria a loja excluída do cadastro de vez e reativá-la exigiria
 * recadastrar nome e formato na mão. Ela continua guardada, só invisível.
 */
export async function salvarLojasCadastro(lojas: LojaCadastro[]): Promise<void> {
  const anteriores = (await ler<LojaCadastro[]>(CHAVE_LOJAS)) ?? [];
  const informados = new Set(lojas.map((l) => l.codigo));
  const preservadas = anteriores.filter((l) => lojaExcluida(l.codigo) && !informados.has(l.codigo));
  await salvar(CHAVE_LOJAS, [...lojas, ...preservadas].sort((a, b) => a.codigo.localeCompare(b.codigo)));
}

export async function lerDepartamentosCadastro(): Promise<DepartamentoCadastro[] | null> {
  return ler<DepartamentoCadastro[]>(CHAVE_DEPARTAMENTOS);
}

export async function salvarDepartamentosCadastro(departamentos: DepartamentoCadastro[]): Promise<void> {
  await salvar(CHAVE_DEPARTAMENTOS, departamentos);
}

/**
 * Lê o cadastro, semeando (e já persistindo) a partir do que já existe hoje
 * (bdLojas.txt, compradores.ts/departamentos.ts) na primeira vez que o
 * cadastro ainda não existe — assim a semeadura vira o ponto de partida
 * editável de fato, em vez de ser recalculada a cada leitura.
 */
export async function obterOuSemearLojasCadastro(): Promise<LojaCadastro[]> {
  // Filtra na leitura, não no que está gravado: o cadastro da loja excluída
  // continua salvo, e tirá-la de `LOJAS_EXCLUIDAS` basta pra ela voltar.
  const visiveis = (lojas: LojaCadastro[]) => lojas.filter((l) => !lojaExcluida(l.codigo));
  const salvas = await lerLojasCadastro();
  if (salvas) return visiveis(salvas);
  const semeadas = await semearLojasCadastro();
  await salvarLojasCadastro(semeadas);
  return visiveis(semeadas);
}

export async function obterOuSemearDepartamentosCadastro(): Promise<DepartamentoCadastro[]> {
  const salvos = await lerDepartamentosCadastro();
  if (salvos) return salvos;
  const semeados = semearDepartamentosCadastro();
  await salvarDepartamentosCadastro(semeados);
  return semeados;
}

export async function lerDicionarioColunas(): Promise<ColunaNativa[] | null> {
  return ler<ColunaNativa[]>(CHAVE_DICIONARIO);
}

export async function salvarDicionarioColunas(colunas: ColunaNativa[]): Promise<void> {
  await salvar(CHAVE_DICIONARIO, colunas);
}

export async function obterOuSemearDicionarioColunas(): Promise<ColunaNativa[]> {
  const salvo = await lerDicionarioColunas();
  if (salvo) {
    // Migração única de ref por posição → ref por nome (ver migracao-refs.ts). Só
    // regrava quando de fato mudou algo.
    const migrado = migrarDicionario(salvo);
    if (migrado !== salvo) await salvarDicionarioColunas(migrado);
    return migrado;
  }
  const semeado = semearDicionarioColunas();
  await salvarDicionarioColunas(semeado);
  return semeado;
}

function configRelatorioVazia(modulo: string): ConfigRelatorio {
  return {
    modulo,
    nativasVisiveis: [],
    calculadas: [],
    ordemAtivas: [],
    acessoComprador: false,
    acessoGestor: true,
    status: "Rascunho",
  };
}

/**
 * Semente por módulo — Desempenho Comercial nasce com as colunas que já usa
 * hoje (ver `semearColunasDesempenhoComercial`, documentação/ponto de partida,
 * a tabela ainda não lê isto pra renderizar). Módulos novos (Entradas e
 * Saídas, Compra e Venda, ...) nascem vazios, pra montar do zero na tela.
 */
function semearConfigRelatorio(modulo: string): ConfigRelatorio {
  if (modulo === "desempenho-comercial") return semearColunasDesempenhoComercial();
  if (modulo === "entradas-saidas") return semearColunasEntradasSaidas();
  if (modulo === "compra-venda") return semearColunasCompraVenda();
  return configRelatorioVazia(modulo);
}

export async function lerConfigRelatorio(modulo: string): Promise<ConfigRelatorio | null> {
  return ler<ConfigRelatorio>(chaveConfigRelatorio(modulo));
}

export async function salvarConfigRelatorio(config: ConfigRelatorio): Promise<void> {
  await salvar(chaveConfigRelatorio(config.modulo), config);
}

export async function obterOuSemearConfigRelatorio(modulo: string): Promise<ConfigRelatorio> {
  const salva = await lerConfigRelatorio(modulo);
  if (salva) {
    const migrada = migrarConfigRelatorio(salva);
    if (migrada !== salva) await salvarConfigRelatorio(migrada);
    return migrada;
  }
  const semeada = semearConfigRelatorio(modulo);
  await salvarConfigRelatorio(semeada);
  return semeada;
}
