import { NextRequest, NextResponse } from "next/server";
import { obterGestorAtual } from "@/lib/auth/exigir-gestor";
import { obterOuSemearDicionarioColunas, salvarDicionarioColunas } from "@/lib/parametros/store";
import type { ColunaNativa } from "@/lib/parametros/types";

export async function GET() {
  if (!(await obterGestorAtual())) return NextResponse.json({ erro: "Acesso restrito a Gestores." }, { status: 403 });
  const colunas = await obterOuSemearDicionarioColunas();
  return NextResponse.json(colunas);
}

export async function PUT(request: NextRequest) {
  if (!(await obterGestorAtual())) return NextResponse.json({ erro: "Acesso restrito a Gestores." }, { status: 403 });

  const colunas = (await request.json()) as ColunaNativa[];
  // Nome do arquivo/posição/chave automática nunca mudam por aqui — só tradução/movimento/tipo.
  const atuais = await obterOuSemearDicionarioColunas();
  const porRef = new Map(atuais.map((c) => [c.ref, c]));
  const atualizadas = colunas.map((c) => {
    const original = porRef.get(c.ref);
    return original ? { ...original, movimento: c.movimento, traducao: c.traducao, tipoDado: c.tipoDado } : original;
  });
  if (atualizadas.some((c) => !c)) return NextResponse.json({ erro: "Coluna nativa inválida." }, { status: 400 });

  await salvarDicionarioColunas(atualizadas as ColunaNativa[]);
  return NextResponse.json(atualizadas);
}
