import { NextRequest, NextResponse } from "next/server";
import { obterGestorAtual } from "@/lib/auth/exigir-gestor";
import { obterOuSemearUsuariosCadastro, salvarUsuariosCadastro } from "@/lib/parametros/store";
import type { UsuarioCadastro } from "@/lib/parametros/types";

export async function GET() {
  if (!(await obterGestorAtual())) return NextResponse.json({ erro: "Acesso restrito a Gestores." }, { status: 403 });
  const cadastro = await obterOuSemearUsuariosCadastro();
  return NextResponse.json(cadastro);
}

function validar(usuarios: UsuarioCadastro[]): string[] {
  const erros: string[] = [];
  const nomesDeUsuario = new Set<string>();
  for (const usuario of usuarios) {
    if (!usuario.usuario?.trim()) erros.push("Existe um usuário sem nome de usuário.");
    if (!usuario.nome?.trim()) erros.push(`Usuário ${usuario.usuario || "(sem usuário)"}: nome obrigatório.`);
    if (usuario.perfil === "Comprador") {
      if (!usuario.departamentos?.length) {
        erros.push(`Usuário ${usuario.usuario}: sem Departamento, este comprador não acessa nenhum dado.`);
      }
      if (!usuario.lojas?.length) {
        erros.push(`Usuário ${usuario.usuario}: sem Loja, este comprador não acessa nenhum dado.`);
      }
    }
    if (usuario.usuario) {
      if (nomesDeUsuario.has(usuario.usuario)) erros.push(`Usuário duplicado: ${usuario.usuario}.`);
      nomesDeUsuario.add(usuario.usuario);
    }
  }
  return erros;
}

export async function PUT(request: NextRequest) {
  if (!(await obterGestorAtual())) return NextResponse.json({ erro: "Acesso restrito a Gestores." }, { status: 403 });

  const usuarios = (await request.json()) as UsuarioCadastro[];
  const erros = validar(usuarios);
  if (erros.length > 0) return NextResponse.json({ erros }, { status: 400 });

  await salvarUsuariosCadastro(usuarios);
  return NextResponse.json({ ok: true });
}
