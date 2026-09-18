import { ONEDRIVE_BASES_FOLDER } from "@/config/onedrive";
import { obterAccessToken } from "./auth";

function caminhoGraph(nomeArquivo: string): string {
  const segmentos = `${ONEDRIVE_BASES_FOLDER}/${nomeArquivo}`.split("/").map(encodeURIComponent);
  return segmentos.join("/");
}

async function chamarGraph(caminhoRelativo: string): Promise<Response> {
  const accessToken = await obterAccessToken();
  const url = `https://graph.microsoft.com/v1.0/me/drive/root:/${caminhoRelativo}`;
  const resposta = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!resposta.ok) {
    const texto = await resposta.text().catch(() => "");
    throw new Error(`Falha ao acessar ${caminhoRelativo} no OneDrive (${resposta.status}): ${texto}`);
  }
  return resposta;
}

/** `eTag` do arquivo — usado como chave de cache (muda sempre que o conteúdo muda). */
export async function obterVersaoArquivo(nomeArquivo: string): Promise<string> {
  const resposta = await chamarGraph(caminhoGraph(nomeArquivo));
  const dados = await resposta.json();
  return dados.eTag ?? dados.lastModifiedDateTime ?? String(Date.now());
}

export async function baixarArquivo(nomeArquivo: string, encoding: BufferEncoding): Promise<string> {
  const resposta = await chamarGraph(`${caminhoGraph(nomeArquivo)}:/content`);
  const buffer = Buffer.from(await resposta.arrayBuffer());
  return buffer.toString(encoding);
}
