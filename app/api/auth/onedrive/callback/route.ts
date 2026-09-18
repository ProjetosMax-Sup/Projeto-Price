import { NextResponse, type NextRequest } from "next/server";
import { trocarCodigoPorToken } from "@/lib/onedrive/auth";

export async function GET(request: NextRequest) {
  const erroMicrosoft = request.nextUrl.searchParams.get("error_description");
  if (erroMicrosoft) {
    return new NextResponse(`Microsoft recusou a autorização: ${erroMicrosoft}`, { status: 400 });
  }

  const codigo = request.nextUrl.searchParams.get("code");
  if (!codigo) {
    return new NextResponse("Código de autorização ausente.", { status: 400 });
  }

  try {
    const redirectUri = new URL("/api/auth/onedrive/callback", request.nextUrl.origin).toString();
    await trocarCodigoPorToken(codigo, redirectUri);
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro);
    return new NextResponse(`Falha ao conectar com o OneDrive: ${mensagem}`, { status: 500 });
  }

  return new NextResponse(
    "OneDrive conectado com sucesso! Pode fechar esta aba — a aplicação já vai buscar os arquivos direto de lá.",
    { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8" } },
  );
}
