import { NextRequest, NextResponse } from "next/server";
import { obterGestorAtual } from "@/lib/auth/exigir-gestor";
import { calculadaQuebrada, ordemAtivasEfetiva, podePublicar } from "@/lib/parametros/colunas-relatorio";
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

  const nomes = new Set<string>();
  for (const c of config.calculadas) {
    if (!c.nome?.trim()) return NextResponse.json({ erro: "Toda coluna calculada precisa de um nome." }, { status: 400 });
    if (nomes.has(c.nome)) return NextResponse.json({ erro: `Nome de coluna calculada duplicado: ${c.nome}.` }, { status: 400 });
    nomes.add(c.nome);
    const semTermos = c.tipo === "soma" ? c.termos.length === 0 : c.numerador.length === 0 || c.denominador.length === 0;
    if (semTermos) return NextResponse.json({ erro: `Coluna "${c.nome}": adicione ao menos 1 termo.` }, { status: 400 });
  }

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
