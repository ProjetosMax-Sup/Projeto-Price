import { NextResponse } from "next/server";
import { arquivoMensal, NOMES_MESES_ARQUIVO } from "@/config/data-sources";
import { getEntradasSaidasReduzido, getMesesDisponiveisEntradasSaidas } from "@/lib/data-providers/file-provider";
import { construirIndiceDepartamentos } from "@/lib/desempenho/comprador-cadastro";
import { computarEntradasSaidas, type ConsultaEntradasSaidas } from "@/lib/entradas-saidas/consulta";
import { obterOuSemearDepartamentosCadastro } from "@/lib/parametros/store";

/**
 * Espelho de app/api/desempenho-comercial/route.ts, mas pro Entradas e Saídas:
 * `mes` (nome do mês, ex: "Setembro" — os arquivos `bd<Mês>.txt` não carregam
 * ano, então o seletor de período aqui também não) seleciona diretamente o
 * arquivo a ler, nunca os outros meses. A redução (parte cara) fica cacheada
 * por arquivo em `file-provider.ts` — ver o comentário lá sobre por que isso
 * mudou de "todos os meses sempre em memória" pra "só o mês pedido".
 */
export async function POST(request: Request) {
  let corpo: ConsultaEntradasSaidas & { mes: string | null };
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido" }, { status: 400 });
  }

  const nomeArquivo = corpo.mes && (NOMES_MESES_ARQUIVO as readonly string[]).includes(corpo.mes)
    ? arquivoMensal(corpo.mes as (typeof NOMES_MESES_ARQUIVO)[number]).nome
    : null;
  const [linhas, departamentosCadastro] = await Promise.all([
    getEntradasSaidasReduzido(nomeArquivo ? [nomeArquivo] : undefined),
    obterOuSemearDepartamentosCadastro(),
  ]);
  const indiceComprador = construirIndiceDepartamentos(departamentosCadastro);
  const resultado = computarEntradasSaidas(linhas, corpo, indiceComprador);
  return NextResponse.json(resultado);
}

/** Nomes de mês (ex: "Setembro") com arquivo disponível agora — valida o seletor
 * de período no cliente. */
export async function GET() {
  const arquivos = await getMesesDisponiveisEntradasSaidas();
  const meses = arquivos
    .map((nome) => nome.match(/^bd(\w+)\.txt$/)?.[1])
    .filter((n): n is string => n !== undefined);
  return NextResponse.json({ meses });
}
