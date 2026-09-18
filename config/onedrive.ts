/**
 * Credenciais do app registrado no Microsoft Entra (portal.azure.com > App
 * registrations) usado pra ler os arquivos direto do OneDrive em produção,
 * sem precisar da pasta local sincronizada. Conta pessoal → tenant "consumers".
 */
export const MICROSOFT_CLIENT_ID = process.env.MICROSOFT_CLIENT_ID ?? "";
export const MICROSOFT_CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET ?? "";

export const MICROSOFT_TENANT = "consumers";
export const MICROSOFT_AUTHORIZE_URL = `https://login.microsoftonline.com/${MICROSOFT_TENANT}/oauth2/v2.0/authorize`;
export const MICROSOFT_TOKEN_URL = `https://login.microsoftonline.com/${MICROSOFT_TENANT}/oauth2/v2.0/token`;
export const MICROSOFT_SCOPE = "offline_access Files.Read";

/** Pasta no OneDrive (relativa à raiz) com os 4 arquivos-fonte. */
export const ONEDRIVE_BASES_FOLDER = process.env.ONEDRIVE_BASES_FOLDER ?? "05 - Bases";

export function onedriveConfigurado(): boolean {
  return Boolean(MICROSOFT_CLIENT_ID && MICROSOFT_CLIENT_SECRET);
}
