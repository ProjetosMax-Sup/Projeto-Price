import { NextRequest, NextResponse } from "next/server";
import { alternarBloqueioClerk } from "@/lib/auth/clerk-admin";
import { obterGestorAtual } from "@/lib/auth/exigir-gestor";

export async function POST(request: NextRequest) {
  const gestor = await obterGestorAtual();
  if (!gestor) return NextResponse.json({ erro: "Acesso restrito a Gestores." }, { status: 403 });

  const { usuario, bloquear } = (await request.json()) as { usuario: string; bloquear: boolean };
  if (usuario === gestor.usuario && bloquear) {
    return NextResponse.json({ erro: "Você não pode desativar sua própria conta." }, { status: 400 });
  }

  try {
    await alternarBloqueioClerk(usuario, bloquear);
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro);
    return NextResponse.json({ erro: mensagem }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
