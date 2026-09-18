import { gunzipSync, gzipSync } from "zlib";
import Redis from "ioredis";
import type { Loja, MovimentoVendas, PeriodoDesempenho, Produto, RegistroDesempenho } from "@/lib/types";

/**
 * Dataset processado (registros já normalizados/filtrados), guardado no Redis
 * pelo cron diário — assim as requisições normais nunca precisam ir no
 * OneDrive nem reprocessar os TXT gigantes, só ler daqui (rápido e estável,
 * sem depender de instância "quente" do servidor).
 *
 * Guardado em pedaços (chunks) gzipados, um valor por chunk, pra não esbarrar
 * em limite de tamanho por chave do Redis — os arquivos reais têm centenas de
 * milhares de linhas.
 */

const TAMANHO_CHUNK = 25_000;
const CHAVE_MANIFESTO = "dataset:manifesto";
const CHAVE_LOJAS = "dataset:lojas";
const CHAVE_PRODUTOS = "dataset:produtos";

type LinhaCompacta = [
  string, string, string, string, string, string, string, string, number, number, number, number, number, number,
];

interface Manifesto {
  geradoEm: string;
  chunksAtual: number;
  chunksComparacao: number;
  produtosDescartadosAtual: number;
  produtosDescartadosComparacao: number;
  produtosDescartadosCodigosAtual: string[];
  produtosDescartadosCodigosComparacao: string[];
}

export interface DatasetProcessado {
  geradoEm: string;
  lojas: Loja[];
  produtos: Produto[];
  registrosAtual: RegistroDesempenho[];
  registrosComparacao: RegistroDesempenho[];
  produtosDescartadosAtual: number;
  produtosDescartadosComparacao: number;
  produtosDescartadosCodigosAtual: string[];
  produtosDescartadosCodigosComparacao: string[];
}

function paraLinhaCompacta(m: MovimentoVendas): LinhaCompacta {
  return [
    m.codigo,
    m.descricao,
    m.complemento,
    m.marca,
    m.codigoBarras,
    m.unidadeCodigo,
    m.unidadeNome,
    m.data,
    m.qtdeVendasTotal,
    m.valorTotal,
    m.lucrosTotal,
    m.qtdeVendasOferta,
    m.vendasOferta,
    m.lucrosOferta,
  ];
}

function deLinhaCompacta(l: LinhaCompacta): MovimentoVendas {
  const [
    codigo, descricao, complemento, marca, codigoBarras, unidadeCodigo, unidadeNome, data,
    qtdeVendasTotal, valorTotal, lucrosTotal, qtdeVendasOferta, vendasOferta, lucrosOferta,
  ] = l;
  return {
    codigo, descricao, complemento, marca, codigoBarras, unidadeCodigo, unidadeNome, data,
    qtdeVendasTotal, valorTotal, lucrosTotal, qtdeVendasOferta, vendasOferta, lucrosOferta,
    qtdeVendasRegular: qtdeVendasTotal - qtdeVendasOferta,
    vendasRegular: valorTotal - vendasOferta,
    lucrosRegular: lucrosTotal - lucrosOferta,
  };
}

function emChunks<T>(itens: T[], tamanho: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < itens.length; i += tamanho) chunks.push(itens.slice(i, i + tamanho));
  return chunks.length > 0 ? chunks : [[]];
}

function comprimir(valor: unknown): Buffer {
  return gzipSync(Buffer.from(JSON.stringify(valor), "utf8"));
}

function descomprimir<T>(buffer: Buffer): T {
  return JSON.parse(gunzipSync(buffer).toString("utf8"));
}

function obterCliente(): Redis {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("Redis não configurado (REDIS_URL).");
  return new Redis(url);
}

export async function salvarDataset(dados: {
  lojas: Loja[];
  produtos: Produto[];
  atual: PeriodoDesempenho;
  comparacao: PeriodoDesempenho;
}): Promise<string> {
  const geradoEm = new Date().toISOString();
  const chunksAtual = emChunks(dados.atual.registros.map((r) => paraLinhaCompacta(r.movimento)), TAMANHO_CHUNK);
  const chunksComparacao = emChunks(
    dados.comparacao.registros.map((r) => paraLinhaCompacta(r.movimento)),
    TAMANHO_CHUNK,
  );

  const manifesto: Manifesto = {
    geradoEm,
    chunksAtual: chunksAtual.length,
    chunksComparacao: chunksComparacao.length,
    produtosDescartadosAtual: dados.atual.produtosDescartados,
    produtosDescartadosComparacao: dados.comparacao.produtosDescartados,
    produtosDescartadosCodigosAtual: dados.atual.produtosDescartadosCodigos,
    produtosDescartadosCodigosComparacao: dados.comparacao.produtosDescartadosCodigos,
  };

  const cliente = obterCliente();
  try {
    await Promise.all([
      cliente.set(CHAVE_LOJAS, comprimir(dados.lojas)),
      cliente.set(CHAVE_PRODUTOS, comprimir(dados.produtos)),
      ...chunksAtual.map((c, i) => cliente.set(`dataset:atual:${i}`, comprimir(c))),
      ...chunksComparacao.map((c, i) => cliente.set(`dataset:comparacao:${i}`, comprimir(c))),
    ]);
    // Manifesto por último: só vira "válido" pra leitura depois que os chunks já existem.
    await cliente.set(CHAVE_MANIFESTO, JSON.stringify(manifesto));
  } finally {
    cliente.disconnect();
  }
  return geradoEm;
}

export async function lerVersaoDataset(): Promise<string | null> {
  const cliente = obterCliente();
  try {
    const bruto = await cliente.get(CHAVE_MANIFESTO);
    return bruto ? (JSON.parse(bruto) as Manifesto).geradoEm : null;
  } finally {
    cliente.disconnect();
  }
}

export async function lerDataset(): Promise<DatasetProcessado | null> {
  const cliente = obterCliente();
  try {
    const brutoManifesto = await cliente.get(CHAVE_MANIFESTO);
    if (!brutoManifesto) return null;
    const manifesto: Manifesto = JSON.parse(brutoManifesto);

    const [bufLojas, bufProdutos, ...bufsChunks] = await Promise.all([
      cliente.getBuffer(CHAVE_LOJAS),
      cliente.getBuffer(CHAVE_PRODUTOS),
      ...Array.from({ length: manifesto.chunksAtual }, (_, i) => cliente.getBuffer(`dataset:atual:${i}`)),
      ...Array.from({ length: manifesto.chunksComparacao }, (_, i) => cliente.getBuffer(`dataset:comparacao:${i}`)),
    ]);
    if (!bufLojas || !bufProdutos) return null;

    const lojas = descomprimir<Loja[]>(bufLojas);
    const produtos = descomprimir<Produto[]>(bufProdutos);
    const bufsAtual = bufsChunks.slice(0, manifesto.chunksAtual);
    const bufsComparacao = bufsChunks.slice(manifesto.chunksAtual);

    const produtosPorCodigo = new Map(produtos.map((p) => [p.codigo, p]));
    const lojasPorCodigo = new Map(lojas.map((l) => [l.codUnid, l]));

    const reconstruir = (buffers: (Buffer | null)[]): RegistroDesempenho[] =>
      buffers
        .filter((b): b is Buffer => b !== null)
        .flatMap((b) => descomprimir<LinhaCompacta[]>(b))
        .map((l) => {
          const movimento = deLinhaCompacta(l);
          return {
            movimento,
            produto: produtosPorCodigo.get(movimento.codigo) ?? null,
            loja: movimento.unidadeCodigo ? (lojasPorCodigo.get(movimento.unidadeCodigo) ?? null) : null,
          };
        });

    return {
      geradoEm: manifesto.geradoEm,
      lojas,
      produtos,
      registrosAtual: reconstruir(bufsAtual),
      registrosComparacao: reconstruir(bufsComparacao),
      produtosDescartadosAtual: manifesto.produtosDescartadosAtual,
      produtosDescartadosComparacao: manifesto.produtosDescartadosComparacao,
      produtosDescartadosCodigosAtual: manifesto.produtosDescartadosCodigosAtual ?? [],
      produtosDescartadosCodigosComparacao: manifesto.produtosDescartadosCodigosComparacao ?? [],
    };
  } finally {
    cliente.disconnect();
  }
}
