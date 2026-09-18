import { NextResponse } from "next/server";
import { lerLabelPeriodoComparacao, salvarLabelPeriodoComparacao } from "@/lib/desempenho/periodo";

export async function GET() {
  const label = await lerLabelPeriodoComparacao().catch(() => null);
  return NextResponse.json({ label });
}

export async function POST(request: Request) {
  const { label } = await request.json().catch(() => ({ label: "" }));
  if (typeof label !== "string" || label.trim().length === 0) {
    return NextResponse.json({ erro: "Informe um rótulo válido" }, { status: 400 });
  }
  await salvarLabelPeriodoComparacao(label.trim());
  return NextResponse.json({ ok: true });
}
