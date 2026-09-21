import { ONEDRIVE_BASES_FOLDER } from "@/config/onedrive";
import { obterAccessToken } from "./auth";

function caminhoGraph(nomeArquivo: string): string {
  const segmentos = `${ONEDRIVE_BASES_FOLDER}/${nomeArquivo}`.split("/").map(encodeURIComponent);
  return segmentos.join("/");
}

function caminhoGraphPasta(): string {
  return ONEDRIVE_BASES_FOLDER.split("/").map(encodeURIComponent).join("/");
}

// Sem isso, uma Graph API lenta/instável trava a requisição até o maxDuration da função (60s no
// plano Hobby) em vez de falhar rápido e deixar o resilient-provider decidir o que fazer. Metadado
// (versão/listagem) é rápido por natureza — 15s já é folgado; conteúdo (download dos TXT, que
// passam de 200MB) precisa de mais margem, por isso timeout maior e configurável por chamada.
const TIMEOUT_GRAPH_METADADO_MS = 15_000;
const TIMEOUT_GRAPH_CONTEUDO_MS = 45_000;

async function chamarGraph(caminhoRelativo: string, timeoutMs: number): Promise<Response> {
  const accessToken = await obterAccessToken();
  const url = `https://graph.microsoft.com/v1.0/me/drive/root:/${caminhoRelativo}`;
  const resposta = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!resposta.ok) {
    const texto = await resposta.text().catch(() => "");
    throw new Error(`Falha ao acessar ${caminhoRelativo} no OneDrive (${resposta.status}): ${texto}`);
  }
  return resposta;
}

/** `eTag` do arquivo — usado como chave de cache (muda sempre que o conteúdo muda). */
export async function obterVersaoArquivo(nomeArquivo: string): Promise<string> {
  const resposta = await chamarGraph(caminhoGraph(nomeArquivo), TIMEOUT_GRAPH_METADADO_MS);
  const dados = await resposta.json();
  return dados.eTag ?? dados.lastModifiedDateTime ?? String(Date.now());
}

export async function baixarArquivo(nomeArquivo: string, encoding: BufferEncoding): Promise<string> {
  const resposta = await chamarGraph(`${caminhoGraph(nomeArquivo)}:/content`, TIMEOUT_GRAPH_CONTEUDO_MS);
  const buffer = Buffer.from(await resposta.arrayBuffer());
  return buffer.toString(encoding);
}

/**
 * Nomes dos arquivos na pasta configurada — usado pra descobrir dinamicamente
 * quais arquivos mensais (`bd<Mês>.txt`) já foram subidos, sem precisar saber
 * a lista de antemão (ver `arquivosMensaisDisponiveis` em config/data-sources.ts).
 */
export async function listarNomesArquivos(): Promise<string[]> {
  const resposta = await chamarGraph(`${caminhoGraphPasta()}:/children?$select=name&$top=200`, TIMEOUT_GRAPH_METADADO_MS);
  const dados = await resposta.json();
  return (dados.value ?? []).map((item: { name: string }) => item.name);
}
