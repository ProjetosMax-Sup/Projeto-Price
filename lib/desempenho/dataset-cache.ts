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
 * milhares de linhas por mês.
 */

const TAMANHO_CHUNK = 25_000;
const CHAVE_MANIFESTO = "dataset:manifesto";
// Chaves sem geração (formato anterior a esta versão) — só usadas como fallback de leitura
// pra um manifesto antigo que ainda não tem `geracao` (ver lerDataset).
const CHAVE_LOJAS_LEGADA = "dataset:lojas";
const CHAVE_PRODUTOS_LEGADA = "dataset:produtos";

type LinhaCompacta = [
  string, string, string, string, string, string, string, string, number, number, number, number, number, number,
];

interface Manifesto {
  geradoEm: string;
  /** Sufixo de geração das chaves `dataset:lojas:<geracao>`/`produtos`/`registros` desta escrita —
   * ausente só em manifesto gravado antes desta versão (chaves sem geração, ver CHAVE_LOJAS_LEGADA). */
  geracao?: string;
  chunksRegistros: number;
  produtosDescartados: number;
  produtosDescartadosCodigos: string[];
}

export interface DatasetProcessado {
  geradoEm: string;
  lojas: Loja[];
  produtos: Produto[];
  registros: RegistroDesempenho[];
  produtosDescartados: number;
  produtosDescartadosCodigos: string[];
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

// Client reaproveitado entre chamadas (mesmo padrão de lib/onedrive/token-store.ts) — uma conexão
// nova por leitura/escrita custaria um handshake TCP+auth a cada request, inclusive em
// lerVersaoDataset(), chamada em toda visita ao Desempenho Comercial só pra checar a versão do
// cache em memória.
let cliente: Redis | null = null;
function obterCliente(): Redis {
  if (cliente) return cliente;
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("Redis não configurado (REDIS_URL).");
  cliente = new Redis(url);
  return cliente;
}

export async function salvarDataset(dados: {
  lojas: Loja[];
  produtos: Produto[];
  desempenho: PeriodoDesempenho;
}): Promise<string> {
  const geradoEm = new Date().toISOString();
  // Sufixo único desta escrita — separa as chaves da geração nova das da geração anterior
  // enquanto ambas convivem no Redis (ver ordem escreve→troca→apaga abaixo).
  const geracao = geradoEm;
  const chunksRegistros = emChunks(dados.desempenho.registros.map((r) => paraLinhaCompacta(r.movimento)), TAMANHO_CHUNK);

  const manifesto: Manifesto = {
    geradoEm,
    geracao,
    chunksRegistros: chunksRegistros.length,
    produtosDescartados: dados.desempenho.produtosDescartados,
    produtosDescartadosCodigos: dados.desempenho.produtosDescartadosCodigos,
  };

  const cliente = obterCliente();
  // Escreve a geração nova em chaves próprias, SEM tocar na geração anterior — se isso falhar
  // no meio (ex: OOM do Redis), o manifesto continua intacto apontando pra geração anterior e a
  // app nunca fica servindo um dataset incompleto/misturado.
  await Promise.all([
    cliente.set(`dataset:lojas:${geracao}`, comprimir(dados.lojas)),
    cliente.set(`dataset:produtos:${geracao}`, comprimir(dados.produtos)),
    ...chunksRegistros.map((c, i) => cliente.set(`dataset:registros:${geracao}:${i}`, comprimir(c))),
  ]);
  // Só troca o ponteiro pra geração nova depois que ELA JÁ ESTÁ TODA gravada — esse é o único
  // instante em que a leitura passa a enxergar os dados novos.
  await cliente.set(CHAVE_MANIFESTO, JSON.stringify(manifesto));

  // Só agora limpa a geração anterior (best-effort: se essa parte falhar, sobra lixo órfão que a
  // própria próxima chamada de salvarDataset ainda limpa, já que o filtro abaixo pega qualquer
  // chave que não seja da geração atual).
  const chavesAntigas = (
    await Promise.all([
      cliente.keys("dataset:lojas:*"),
      cliente.keys("dataset:produtos:*"),
      cliente.keys("dataset:registros:*"),
    ])
  )
    .flat()
    .filter((chave) => !chave.endsWith(`:${geracao}`) && !chave.includes(`:${geracao}:`));
  if (chavesAntigas.length > 0) await cliente.del(...chavesAntigas);
  await cliente.del(CHAVE_LOJAS_LEGADA, CHAVE_PRODUTOS_LEGADA);

  return geradoEm;
}

export async function lerVersaoDataset(): Promise<string | null> {
  const cliente = obterCliente();
  const bruto = await cliente.get(CHAVE_MANIFESTO);
  return bruto ? (JSON.parse(bruto) as Manifesto).geradoEm : null;
}

export async function lerDataset(): Promise<DatasetProcessado | null> {
  const cliente = obterCliente();
  const brutoManifesto = await cliente.get(CHAVE_MANIFESTO);
  if (!brutoManifesto) return null;
  const manifesto: Manifesto = JSON.parse(brutoManifesto);
  // Manifesto de um formato anterior (ex: ainda com chunksAtual/chunksComparacao, de antes da
  // migração pros arquivos mensais) não tem chunksRegistros — tratar como "sem dataset" (null),
  // pra createResilientProvider cair pro OneDrive direto em vez de devolver um dataset "válido"
  // com zero registros silenciosamente. Corrige sozinho no próximo cron/"Atualizar dados".
  if (typeof manifesto.chunksRegistros !== "number") return null;

  // manifesto.geracao pode faltar num manifesto gravado antes desta versão — cai pras chaves
  // legadas (sem sufixo de geração) nesse caso.
  const chaveLojas = manifesto.geracao ? `dataset:lojas:${manifesto.geracao}` : CHAVE_LOJAS_LEGADA;
  const chaveProdutos = manifesto.geracao ? `dataset:produtos:${manifesto.geracao}` : CHAVE_PRODUTOS_LEGADA;
  const chaveRegistro = (i: number) =>
    manifesto.geracao ? `dataset:registros:${manifesto.geracao}:${i}` : `dataset:registros:${i}`;

  const [bufLojas, bufProdutos, ...bufsRegistros] = await Promise.all([
    cliente.getBuffer(chaveLojas),
    cliente.getBuffer(chaveProdutos),
    ...Array.from({ length: manifesto.chunksRegistros }, (_, i) => cliente.getBuffer(chaveRegistro(i))),
  ]);
  if (!bufLojas || !bufProdutos) return null;

  const lojas = descomprimir<Loja[]>(bufLojas);
  const produtos = descomprimir<Produto[]>(bufProdutos);

  const produtosPorCodigo = new Map(produtos.map((p) => [p.codigo, p]));
  const lojasPorCodigo = new Map(lojas.map((l) => [l.codUnid, l]));

  const registros: RegistroDesempenho[] = bufsRegistros
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
    registros,
    produtosDescartados: manifesto.produtosDescartados,
    produtosDescartadosCodigos: manifesto.produtosDescartadosCodigos ?? [],
  };
}
