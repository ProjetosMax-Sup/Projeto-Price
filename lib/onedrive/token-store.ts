import { Redis } from "@upstash/redis";

const CHAVE_REFRESH_TOKEN = "onedrive:refresh_token";

/**
 * Guarda o refresh token do OneDrive entre deploys/instâncias. Precisa de um
 * Redis (integração "Upstash" no marketplace da Vercel) linkado ao projeto —
 * a Vercel injeta KV_REST_API_URL/KV_REST_API_TOKEN (nome legado) ou
 * UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN automaticamente.
 */
function criarCliente(): Redis {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error(
      "Redis não configurado (KV_REST_API_URL/KV_REST_API_TOKEN). Conecte uma integração Redis (Upstash) ao projeto na Vercel.",
    );
  }
  return new Redis({ url, token });
}

let cliente: Redis | null = null;
function obterCliente(): Redis {
  return (cliente ??= criarCliente());
}

export async function lerRefreshToken(): Promise<string | null> {
  return obterCliente().get<string>(CHAVE_REFRESH_TOKEN);
}

export async function salvarRefreshToken(valor: string): Promise<void> {
  await obterCliente().set(CHAVE_REFRESH_TOKEN, valor);
}
