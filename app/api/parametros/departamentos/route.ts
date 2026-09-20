import { NextRequest, NextResponse } from "next/server";
import { obterOuSemearDepartamentosCadastro, salvarDepartamentosCadastro } from "@/lib/parametros/store";
import type { DepartamentoCadastro } from "@/lib/parametros/types";

export async function GET() {
  const cadastro = await obterOuSemearDepartamentosCadastro();
  return NextResponse.json(cadastro);
}

// formatos: lista de formatos em uso no momento (vem do estado de Lojas no cliente) — cada
// departamento precisa de um comprador preenchido por formato quando não usa comprador único.
function validar(departamentos: DepartamentoCadastro[], formatos: string[]): string[] {
  const erros: string[] = [];
  const codigos = new Set<string>();
  for (const dpto of departamentos) {
    if (!dpto.codigo?.trim()) erros.push("Existe um departamento sem código.");
    if (!dpto.nome?.trim()) erros.push(`Departamento ${dpto.codigo || "(sem código)"}: nome obrigatório.`);
    if (dpto.mesmoCompradorTodosFormatos) {
      if (!dpto.comprador?.trim()) erros.push(`Departamento ${dpto.codigo}: comprador obrigatório.`);
    } else {
      for (const formato of formatos) {
        if (!dpto.compradorPorFormato?.[formato]?.trim()) {
          erros.push(`Departamento ${dpto.codigo}: comprador do formato "${formato}" obrigatório.`);
        }
      }
    }
    if (dpto.codigo) {
      if (codigos.has(dpto.codigo)) erros.push(`Código de departamento duplicado: ${dpto.codigo}.`);
      codigos.add(dpto.codigo);
    }
  }
  return erros;
}

export async function PUT(request: NextRequest) {
  const { departamentos, formatos } = (await request.json()) as {
    departamentos: DepartamentoCadastro[];
    formatos: string[];
  };
  const erros = validar(departamentos, formatos);
  if (erros.length > 0) return NextResponse.json({ erros }, { status: 400 });

  await salvarDepartamentosCadastro(departamentos);
  return NextResponse.json({ ok: true });
}
