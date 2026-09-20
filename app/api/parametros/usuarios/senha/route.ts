import { NextRequest, NextResponse } from "next/server";
import { trocarSenhaClerk } from "@/lib/auth/clerk-admin";
import { obterGestorAtual } from "@/lib/auth/exigir-gestor";

export async function POST(request: NextRequest) {
  if (!(await obterGestorAtual())) return NextResponse.json({ erro: "Acesso restrito a Gestores." }, { status: 403 });

  const { usuario, novaSenha } = (await request.json()) as { usuario: string; novaSenha: string };
  if (!novaSenha || novaSenha.length < 8) {
    return NextResponse.json({ erro: "Senha obrigatória (mínimo 8 caracteres)." }, { status: 400 });
  }

  try {
    await trocarSenhaClerk(usuario, novaSenha);
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro);
    return NextResponse.json({ erro: mensagem }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
