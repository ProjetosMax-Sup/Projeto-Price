import Redis from "ioredis";
import { semearDepartamentosCadastro, semearLojasCadastro } from "@/lib/parametros/seed";
import type { DepartamentoCadastro, LojaCadastro } from "@/lib/parametros/types";

/**
 * Cadastro de Lojas e Departamentos, editável pela tela /parametros.
 * Mesmo padrão de client do lib/desempenho/dataset-cache.ts (client novo por
 * chamada, disconnect() no finally) — sem chunk/gzip, porque aqui são
 * dezenas de linhas, não milhões.
 */

const CHAVE_LOJAS = "parametros:lojas";
const CHAVE_DEPARTAMENTOS = "parametros:departamentos";

function obterCliente(): Redis {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("Redis não configurado (REDIS_URL).");
  return new Redis(url);
}

export async function lerLojasCadastro(): Promise<LojaCadastro[] | null> {
  const cliente = obterCliente();
  try {
    const bruto = await cliente.get(CHAVE_LOJAS);
    return bruto ? (JSON.parse(bruto) as LojaCadastro[]) : null;
  } finally {
    cliente.disconnect();
  }
}

export async function salvarLojasCadastro(lojas: LojaCadastro[]): Promise<void> {
  const cliente = obterCliente();
  try {
    await cliente.set(CHAVE_LOJAS, JSON.stringify(lojas));
  } finally {
    cliente.disconnect();
  }
}

export async function lerDepartamentosCadastro(): Promise<DepartamentoCadastro[] | null> {
  const cliente = obterCliente();
  try {
    const bruto = await cliente.get(CHAVE_DEPARTAMENTOS);
    return bruto ? (JSON.parse(bruto) as DepartamentoCadastro[]) : null;
  } finally {
    cliente.disconnect();
  }
}

export async function salvarDepartamentosCadastro(departamentos: DepartamentoCadastro[]): Promise<void> {
  const cliente = obterCliente();
  try {
    await cliente.set(CHAVE_DEPARTAMENTOS, JSON.stringify(departamentos));
  } finally {
    cliente.disconnect();
  }
}

/**
 * Lê o cadastro, semeando (e já persistindo) a partir do que já existe hoje
 * (bdLojas.txt, compradores.ts/departamentos.ts) na primeira vez que a chave
 * ainda não existe no Redis — assim a semeadura vira o ponto de partida
 * editável de fato, em vez de ser recalculada a cada leitura.
 */
export async function obterOuSemearLojasCadastro(): Promise<LojaCadastro[]> {
  const salvas = await lerLojasCadastro();
  if (salvas) return salvas;
  const semeadas = await semearLojasCadastro();
  await salvarLojasCadastro(semeadas);
  return semeadas;
}

export async function obterOuSemearDepartamentosCadastro(): Promise<DepartamentoCadastro[]> {
  const salvos = await lerDepartamentosCadastro();
  if (salvos) return salvos;
  const semeados = semearDepartamentosCadastro();
  await salvarDepartamentosCadastro(semeados);
  return semeados;
}
