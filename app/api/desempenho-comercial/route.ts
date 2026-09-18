import { NextResponse } from "next/server";
import { getDataProvider } from "@/lib/data-providers";
import { computarDesempenho, type ConsultaDesempenho } from "@/lib/desempenho/consulta";

// Numa instância "fria" (sem cache ainda), pode precisar rebaixar os arquivos
// do OneDrive de novo — 60s é o teto do plano Hobby.
export const maxDuration = 60;

export async function POST(request: Request) {
  let consulta: ConsultaDesempenho;
  try {
    consulta = await request.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido" }, { status: 400 });
  }

  const provider = getDataProvider();
  const [lojas, atual, comparacao] = await Promise.all([
    provider.getLojas(),
    provider.getDesempenhoAtual(),
    provider.getDesempenhoComparacao(),
  ]);

  const resultado = computarDesempenho(atual.registros, comparacao.registros, lojas, consulta);
  return NextResponse.json(resultado);
}
