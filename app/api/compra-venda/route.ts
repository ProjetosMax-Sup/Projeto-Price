import { NextResponse } from "next/server";
import { arquivoMensal, NOMES_MESES_ARQUIVO } from "@/config/data-sources";
import { getEntradasSaidasReduzido, getMesesDisponiveisEntradasSaidas } from "@/lib/data-providers/file-provider";
import { filtrarPorFormato, injetarMetasNoResultado, pesosPorDepartamentoFormato } from "@/lib/compra-venda/aggregate";
import { filtrarPorLojas } from "@/lib/entradas-saidas/aggregate";
import { construirIndiceDepartamentos } from "@/lib/desempenho/comprador-cadastro";
import { computarEntradasSaidas, departamentosExcluidosDoTotal, type ConsultaEntradasSaidas } from "@/lib/entradas-saidas/consulta";
import { obterOuSemearConfigRelatorio, obterOuSemearDepartamentosCadastro } from "@/lib/parametros/store";

/**
 * Espelho de app/api/entradas-saidas/route.ts — mesmíssima consulta (dois
 * drill-downs independentes, Departamento e Comprador, vários meses de uma vez
 * desde 2026-10-01), só com um filtro a mais antes de agregar (Formato, ou
 * "Todos") e a Meta injetada depois (ver `lib/compra-venda/aggregate.ts` —
 * ponderada pela Venda atual quando "Todos" mistura formatos, e também
 * repassada pro Comprador, ponderada pelos Departamentos que ele compra).
 */
export async function POST(request: Request) {
  let corpo: ConsultaEntradasSaidas & { meses: string[]; formato: string };
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido" }, { status: 400 });
  }

  const nomesArquivo = (corpo.meses ?? [])
    .filter((m): m is (typeof NOMES_MESES_ARQUIVO)[number] => (NOMES_MESES_ARQUIVO as readonly string[]).includes(m))
    .map((m) => arquivoMensal(m).nome);
  const [linhasBrutas, departamentosCadastro, config] = await Promise.all([
    getEntradasSaidasReduzido(nomesArquivo),
    obterOuSemearDepartamentosCadastro(),
    obterOuSemearConfigRelatorio("compra-venda"),
  ]);

  // Loja é recorte prévio, igual Formato (decisão de 2026-09-30) — aplicado antes de tudo,
  // inclusive do peso que pondera a Meta (senão "Todos" ponderaria com a Venda da rede
  // inteira mesmo depois de filtrar pra 2 lojas).
  const linhasDaLoja = filtrarPorLojas(linhasBrutas, corpo.lojas ?? []);
  const linhas = filtrarPorFormato(linhasDaLoja, corpo.formato);
  const indiceComprador = construirIndiceDepartamentos(departamentosCadastro);
  const excluidos = departamentosExcluidosDoTotal(departamentosCadastro);
  const resultado = computarEntradasSaidas(linhas, corpo, indiceComprador, excluidos);
  // Fora do peso que pondera a Meta do Total (card de KPI) pelo mesmo motivo que fica
  // fora da soma de Compras/Venda — "Apropriações" não é departamento de venda de
  // verdade. Não afeta a meta POR departamento (cada um só olha a própria chave).
  const pesos = pesosPorDepartamentoFormato(linhasDaLoja).filter((p) => !excluidos.has(p.dpto));
  const resultadoComMeta = injetarMetasNoResultado(resultado, corpo, linhas, pesos, config.metas ?? {}, corpo.formato, indiceComprador);

  return NextResponse.json(resultadoComMeta);
}

/** Nomes de mês (ex: "Setembro") com arquivo disponível agora — mesmo GET de
 * app/api/entradas-saidas/route.ts. */
export async function GET() {
  const arquivos = await getMesesDisponiveisEntradasSaidas();
  const meses = arquivos
    .map((nome) => nome.match(/^bd(\w+)\.txt$/)?.[1])
    .filter((n): n is string => n !== undefined);
  return NextResponse.json({ meses });
}
