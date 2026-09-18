import { NextResponse, type NextRequest } from "next/server";
import { MICROSOFT_AUTHORIZE_URL, MICROSOFT_CLIENT_ID, MICROSOFT_SCOPE, onedriveConfigurado } from "@/config/onedrive";

/**
 * Passo único e manual: acessar esta rota autenticado no site (protegido por
 * SITE_PASSWORD) inicia o login com a Microsoft. Depois de autorizar uma vez,
 * o refresh token fica salvo e a aplicação nunca mais precisa disso.
 */
export function GET(request: NextRequest) {
  if (!onedriveConfigurado()) {
    return NextResponse.json(
      { erro: "MICROSOFT_CLIENT_ID/MICROSOFT_CLIENT_SECRET não configurados." },
      { status: 500 },
    );
  }

  const redirectUri = new URL("/api/auth/onedrive/callback", request.nextUrl.origin).toString();
  const url = new URL(MICROSOFT_AUTHORIZE_URL);
  url.searchParams.set("client_id", MICROSOFT_CLIENT_ID);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_mode", "query");
  url.searchParams.set("scope", MICROSOFT_SCOPE);
  url.searchParams.set("prompt", "consent");

  return NextResponse.redirect(url);
}
