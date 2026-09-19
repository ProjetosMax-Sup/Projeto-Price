import { NextResponse } from "next/server";
import { getDataProvider } from "@/lib/data-providers";
import { computarDesempenho, type ConsultaDesempenho } from "@/lib/desempenho/consulta";
import { datasDisponiveis } from "@/lib/desempenho/datas";

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

/**
 * Datas (ISO, distintas) existentes em cada arquivo de movimento — só isso, nunca os registros
 * brutos — pra validar no cliente os seletores de período sem round-trip a cada data digitada.
 */
export async function GET() {
  const provider = getDataProvider();
  const [atual, comparacao] = await Promise.all([provider.getDesempenhoAtual(), provider.getDesempenhoComparacao()]);

  return NextResponse.json({
    datasAtual: datasDisponiveis(atual.registros),
    datasComparacao: datasDisponiveis(comparacao.registros),
  });
}
