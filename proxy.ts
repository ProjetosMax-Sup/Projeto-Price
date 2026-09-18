import { NextResponse, type NextRequest } from "next/server";

const COOKIE = "max_auth";

export function proxy(request: NextRequest) {
  const senha = process.env.SITE_PASSWORD;

  // Sem senha configurada (ex: ambiente local de desenvolvimento) — não bloqueia.
  if (!senha) return NextResponse.next();

  const { pathname } = request.nextUrl;
  if (
    pathname === "/login" ||
    pathname === "/api/login" ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const autenticado = request.cookies.get(COOKIE)?.value === hashSenha(senha);
  if (autenticado) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("proximo", pathname);
  return NextResponse.redirect(url);
}

// Não guarda a senha em texto puro no cookie do navegador.
export function hashSenha(senha: string): string {
  let hash = 0;
  for (let i = 0; i < senha.length; i++) {
    hash = (hash * 31 + senha.charCodeAt(i)) | 0;
  }
  return hash.toString(16);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
