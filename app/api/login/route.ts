import { NextResponse } from "next/server";
import { hashSenha } from "@/proxy";

export async function POST(request: Request) {
  const senhaConfigurada = process.env.SITE_PASSWORD;
  if (!senhaConfigurada) {
    return NextResponse.json({ erro: "SITE_PASSWORD não configurada" }, { status: 500 });
  }

  const { senha } = await request.json().catch(() => ({ senha: "" }));
  if (senha !== senhaConfigurada) {
    return NextResponse.json({ erro: "Senha incorreta" }, { status: 401 });
  }

  const resposta = NextResponse.json({ ok: true });
  resposta.cookies.set("max_auth", hashSenha(senhaConfigurada), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 dias
  });
  return resposta;
}
