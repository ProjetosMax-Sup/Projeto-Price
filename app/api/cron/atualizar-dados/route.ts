import { NextResponse, type NextRequest } from "next/server";
import { atualizarDataset } from "@/lib/desempenho/atualizar-dataset";

export const maxDuration = 60;

/** Chamado pelo Cron da Vercel (ver vercel.json) todo dia às 09:00 (America/Sao_Paulo). */
export async function GET(request: NextRequest) {
  const segredo = process.env.CRON_SECRET;
  if (segredo && request.headers.get("authorization") !== `Bearer ${segredo}`) {
    return NextResponse.json({ erro: "Não autorizado" }, { status: 401 });
  }

  try {
    const resultado = await atualizarDataset();
    return NextResponse.json({ ok: true, ...resultado });
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro);
    console.error("Falha ao atualizar dataset:", mensagem);
    return NextResponse.json({ ok: false, erro: mensagem }, { status: 500 });
  }
}
