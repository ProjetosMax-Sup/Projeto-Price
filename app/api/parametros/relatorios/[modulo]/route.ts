import { NextRequest, NextResponse } from "next/server";
import { obterGestorAtual } from "@/lib/auth/exigir-gestor";
import { calculadaQuebrada, errosDaConfig, ordemAtivasEfetiva, podePublicar } from "@/lib/parametros/colunas-relatorio";
import { obterOuSemearConfigRelatorio, salvarConfigRelatorio } from "@/lib/parametros/store";
import type { ConfigRelatorio } from "@/lib/parametros/types";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ modulo: string }> }) {
  if (!(await obterGestorAtual())) return NextResponse.json({ erro: "Acesso restrito a Gestores." }, { status: 403 });
  const { modulo } = await params;
  const config = await obterOuSemearConfigRelatorio(modulo);
  return NextResponse.json(config);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ modulo: string }> }) {
  if (!(await obterGestorAtual())) return NextResponse.json({ erro: "Acesso restrito a Gestores." }, { status: 403 });
  const { modulo } = await params;

  const config = (await request.json()) as ConfigRelatorio;
  if (config.modulo !== modulo) return NextResponse.json({ erro: "Módulo não confere." }, { status: 400 });

  // Mesma validação que o editor roda na tela (nome, termos, e estágio de cálculo —
  // razão nunca pode ser termo de soma) — aqui é a checagem que vale de verdade.
  const erros = errosDaConfig(config);
  if (erros.length > 0) return NextResponse.json({ erro: erros[0], erros }, { status: 400 });

  if (config.status === "Publicado" && !podePublicar(config)) {
    const quebradas = config.calculadas.filter((c) => calculadaQuebrada(c, config)).map((c) => c.nome);
    return NextResponse.json(
      { erro: `Não é possível publicar com coluna(s) dependendo de coluna excluída: ${quebradas.join(", ")}.` },
      { status: 400 },
    );
  }

  const salvo: ConfigRelatorio = { ...config, ordemAtivas: ordemAtivasEfetiva(config) };
  await salvarConfigRelatorio(salvo);
  return NextResponse.json(salvo);
}
