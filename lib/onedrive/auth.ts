import {
  MICROSOFT_CLIENT_ID,
  MICROSOFT_CLIENT_SECRET,
  MICROSOFT_SCOPE,
  MICROSOFT_TOKEN_URL,
} from "@/config/onedrive";
import { lerRefreshToken, salvarRefreshToken } from "./token-store";

interface RespostaToken {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

async function trocarToken(params: Record<string, string>): Promise<RespostaToken> {
  const resposta = await fetch(MICROSOFT_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: MICROSOFT_CLIENT_ID,
      client_secret: MICROSOFT_CLIENT_SECRET,
      ...params,
    }),
    // Sem timeout, uma Microsoft lenta trava toda leitura que depende de access token (inclusive o
    // fallback pro OneDrive direto) até o maxDuration da função.
    signal: AbortSignal.timeout(15_000),
  });
  if (!resposta.ok) {
    const texto = await resposta.text().catch(() => "");
    throw new Error(`Falha ao obter token da Microsoft (${resposta.status}): ${texto}`);
  }
  return resposta.json();
}

/** Primeira troca (fluxo interativo, uma única vez) — guarda o refresh token pro futuro. */
export async function trocarCodigoPorToken(codigo: string, redirectUri: string): Promise<void> {
  const dados = await trocarToken({
    grant_type: "authorization_code",
    code: codigo,
    redirect_uri: redirectUri,
    scope: MICROSOFT_SCOPE,
  });
  if (!dados.refresh_token) {
    throw new Error("Microsoft não retornou refresh_token — confirme se o escopo 'offline_access' foi concedido.");
  }
  await salvarRefreshToken(dados.refresh_token);
}

// access_token cacheado em memória do processo (válido por ~1h) pra não bater
// no endpoint de token a cada leitura de arquivo.
let cache: { accessToken: string; expiraEm: number } | null = null;

/** Access token válido — renova sozinho via refresh token quando necessário. */
export async function obterAccessToken(): Promise<string> {
  if (cache && Date.now() < cache.expiraEm) return cache.accessToken;

  const refreshToken = await lerRefreshToken();
  if (!refreshToken) {
    throw new Error(
      "OneDrive ainda não autorizado — acesse /api/auth/onedrive/login uma vez pra conectar a conta Microsoft.",
    );
  }

  const dados = await trocarToken({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    scope: MICROSOFT_SCOPE,
  });

  // A Microsoft normalmente devolve um refresh_token novo — precisa salvar
  // por cima, senão o antigo pode parar de funcionar mais adiante.
  if (dados.refresh_token && dados.refresh_token !== refreshToken) {
    await salvarRefreshToken(dados.refresh_token);
  }

  cache = {
    accessToken: dados.access_token,
    // Margem de segurança de 2 min antes do vencimento real.
    expiraEm: Date.now() + (dados.expires_in - 120) * 1000,
  };
  return cache.accessToken;
}
