import { NextRequest, NextResponse } from "next/server";
import { obterGestorAtual } from "@/lib/auth/exigir-gestor";
import { obterOuSemearLojasCadastro, salvarLojasCadastro } from "@/lib/parametros/store";
import type { LojaCadastro } from "@/lib/parametros/types";

export async function GET() {
  if (!(await obterGestorAtual())) return NextResponse.json({ erro: "Acesso restrito a Gestores." }, { status: 403 });
  const cadastro = await obterOuSemearLojasCadastro();
  return NextResponse.json(cadastro);
}

function validar(lojas: LojaCadastro[]): string[] {
  const erros: string[] = [];
  const codigos = new Set<string>();
  for (const loja of lojas) {
    if (!loja.codigo?.trim()) erros.push("Existe uma loja sem código.");
    if (!loja.nomeCustomizado?.trim()) erros.push(`Loja ${loja.codigo || "(sem código)"}: nome customizado obrigatório.`);
    if (!loja.formato?.trim()) erros.push(`Loja ${loja.codigo || "(sem código)"}: formato obrigatório.`);
    if (loja.dataAbertura && !/^\d{4}-\d{2}-\d{2}$/.test(loja.dataAbertura)) {
      erros.push(`Loja ${loja.codigo || "(sem código)"}: data de abertura inválida.`);
    }
    if (loja.codigo) {
      if (codigos.has(loja.codigo)) erros.push(`Código de loja duplicado: ${loja.codigo}.`);
      codigos.add(loja.codigo);
    }
  }
  return erros;
}

export async function PUT(request: NextRequest) {
  if (!(await obterGestorAtual())) return NextResponse.json({ erro: "Acesso restrito a Gestores." }, { status: 403 });

  const lojas = (await request.json()) as LojaCadastro[];
  const erros = validar(lojas);
  if (erros.length > 0) return NextResponse.json({ erros }, { status: 400 });

  await salvarLojasCadastro(lojas);
  return NextResponse.json({ ok: true });
}
