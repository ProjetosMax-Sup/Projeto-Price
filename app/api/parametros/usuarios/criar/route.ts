import { NextRequest, NextResponse } from "next/server";
import { criarUsuarioClerk } from "@/lib/auth/clerk-admin";
import { obterGestorAtual } from "@/lib/auth/exigir-gestor";
import { lerUsuariosCadastro, salvarUsuariosCadastro } from "@/lib/parametros/store";
import type { UsuarioCadastro } from "@/lib/parametros/types";

export async function POST(request: NextRequest) {
  if (!(await obterGestorAtual())) return NextResponse.json({ erro: "Acesso restrito a Gestores." }, { status: 403 });

  const corpo = (await request.json()) as UsuarioCadastro & { senha: string };
  const { senha, ...usuario } = corpo;

  if (!usuario.usuario?.trim()) return NextResponse.json({ erro: "Nome de usuário obrigatório." }, { status: 400 });
  if (!senha || senha.length < 8) {
    return NextResponse.json({ erro: "Senha obrigatória (mínimo 8 caracteres)." }, { status: 400 });
  }
  if (usuario.perfil === "Comprador" && (!usuario.departamentos?.length || !usuario.lojas?.length)) {
    return NextResponse.json(
      { erro: "Sem Departamento e Loja, este comprador não acessa nenhum dado." },
      { status: 400 },
    );
  }

  const atuais = (await lerUsuariosCadastro()) ?? [];
  if (atuais.some((u) => u.usuario === usuario.usuario)) {
    return NextResponse.json({ erro: `Usuário já existe: ${usuario.usuario}.` }, { status: 400 });
  }

  try {
    await criarUsuarioClerk({ usuario: usuario.usuario, nome: usuario.nome, senha });
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro);
    return NextResponse.json({ erro: `Falha ao criar conta no Clerk: ${mensagem}` }, { status: 500 });
  }

  const atualizados = [...atuais, usuario];
  await salvarUsuariosCadastro(atualizados);
  return NextResponse.json(atualizados);
}
