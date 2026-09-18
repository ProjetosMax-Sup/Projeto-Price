import Redis from "ioredis";

const CHAVE_REFRESH_TOKEN = "onedrive:refresh_token";

/**
 * Guarda o refresh token do OneDrive entre deploys/instâncias. Precisa de um
 * Redis (integração "Upstash" no marketplace da Vercel) linkado ao projeto —
 * a Vercel injeta REDIS_URL automaticamente (connection string padrão, não é
 * REST API — por isso usamos ioredis em vez do SDK REST do Upstash).
 */
function criarCliente(): Redis {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error(
      "Redis não configurado (REDIS_URL). Conecte uma integração Redis (Upstash) ao projeto na Vercel.",
    );
  }
  return new Redis(url);
}

let cliente: Redis | null = null;
function obterCliente(): Redis {
  return (cliente ??= criarCliente());
}

export async function lerRefreshToken(): Promise<string | null> {
  return obterCliente().get(CHAVE_REFRESH_TOKEN);
}

export async function salvarRefreshToken(valor: string): Promise<void> {
  await obterCliente().set(CHAVE_REFRESH_TOKEN, valor);
}
