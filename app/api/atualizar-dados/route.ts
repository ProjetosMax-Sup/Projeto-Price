import { NextResponse } from "next/server";
import { atualizarDataset } from "@/lib/desempenho/atualizar-dataset";
import { lerVersaoDataset } from "@/lib/desempenho/dataset-cache";

export const maxDuration = 60;

/** Botão "Atualizar agora" do header — protegido pelo login do site (proxy.ts). */
export async function POST() {
  try {
    const resultado = await atualizarDataset();
    return NextResponse.json({ ok: true, ...resultado });
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro);
    console.error("Falha ao atualizar dataset:", mensagem);
    return NextResponse.json({ ok: false, erro: mensagem }, { status: 500 });
  }
}

export async function GET() {
  const geradoEm = await lerVersaoDataset().catch(() => null);
  return NextResponse.json({ geradoEm });
}
