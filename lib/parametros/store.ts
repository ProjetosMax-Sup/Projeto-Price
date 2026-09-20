import Redis from "ioredis";
import { semearDicionarioColunas } from "@/lib/parametros/dicionario";
import { semearDepartamentosCadastro, semearLojasCadastro, semearUsuariosCadastro } from "@/lib/parametros/seed";
import type { ColunaNativa, ConfigRelatorio, DepartamentoCadastro, LojaCadastro, UsuarioCadastro } from "@/lib/parametros/types";

/**
 * Cadastro de Lojas e Departamentos, editável pela tela /parametros.
 * Mesmo padrão de client do lib/desempenho/dataset-cache.ts (client novo por
 * chamada, disconnect() no finally) — sem chunk/gzip, porque aqui são
 * dezenas de linhas, não milhões.
 */

const CHAVE_LOJAS = "parametros:lojas";
const CHAVE_DEPARTAMENTOS = "parametros:departamentos";
const CHAVE_USUARIOS = "parametros:usuarios";
const CHAVE_DICIONARIO = "parametros:dicionario-colunas";
const chaveConfigRelatorio = (modulo: string) => `parametros:relatorio:${modulo}`;

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

export async function lerUsuariosCadastro(): Promise<UsuarioCadastro[] | null> {
  const cliente = obterCliente();
  try {
    const bruto = await cliente.get(CHAVE_USUARIOS);
    return bruto ? (JSON.parse(bruto) as UsuarioCadastro[]) : null;
  } finally {
    cliente.disconnect();
  }
}

export async function salvarUsuariosCadastro(usuarios: UsuarioCadastro[]): Promise<void> {
  const cliente = obterCliente();
  try {
    await cliente.set(CHAVE_USUARIOS, JSON.stringify(usuarios));
  } finally {
    cliente.disconnect();
  }
}

export async function obterOuSemearUsuariosCadastro(): Promise<UsuarioCadastro[]> {
  const salvos = await lerUsuariosCadastro();
  if (salvos) return salvos;
  const semeados = semearUsuariosCadastro();
  await salvarUsuariosCadastro(semeados);
  return semeados;
}

export async function lerDicionarioColunas(): Promise<ColunaNativa[] | null> {
  const cliente = obterCliente();
  try {
    const bruto = await cliente.get(CHAVE_DICIONARIO);
    return bruto ? (JSON.parse(bruto) as ColunaNativa[]) : null;
  } finally {
    cliente.disconnect();
  }
}

export async function salvarDicionarioColunas(colunas: ColunaNativa[]): Promise<void> {
  const cliente = obterCliente();
  try {
    await cliente.set(CHAVE_DICIONARIO, JSON.stringify(colunas));
  } finally {
    cliente.disconnect();
  }
}

export async function obterOuSemearDicionarioColunas(): Promise<ColunaNativa[]> {
  const salvo = await lerDicionarioColunas();
  if (salvo) return salvo;
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

export async function lerConfigRelatorio(modulo: string): Promise<ConfigRelatorio | null> {
  const cliente = obterCliente();
  try {
    const bruto = await cliente.get(chaveConfigRelatorio(modulo));
    return bruto ? (JSON.parse(bruto) as ConfigRelatorio) : null;
  } finally {
    cliente.disconnect();
  }
}

export async function salvarConfigRelatorio(config: ConfigRelatorio): Promise<void> {
  const cliente = obterCliente();
  try {
    await cliente.set(chaveConfigRelatorio(config.modulo), JSON.stringify(config));
  } finally {
    cliente.disconnect();
  }
}

export async function obterOuSemearConfigRelatorio(modulo: string): Promise<ConfigRelatorio> {
  const salva = await lerConfigRelatorio(modulo);
  if (salva) return salva;
  const vazia = configRelatorioVazia(modulo);
  await salvarConfigRelatorio(vazia);
  return vazia;
}
