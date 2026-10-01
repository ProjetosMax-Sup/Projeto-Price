import { NOMES_MESES_ARQUIVO } from "@/config/data-sources";
import { CompraVendaDashboard } from "@/components/compra-venda/CompraVendaDashboard";
import { ModuleNav } from "@/components/ui/ModuleNav";
import { filtrarPorFormato, injetarMetasNoResultado, pesosPorDepartamentoFormato } from "@/lib/compra-venda/aggregate";
import { getEntradasSaidasReduzido, getMesesDisponiveisEntradasSaidas } from "@/lib/data-providers/file-provider";
import { colunasDoRelatorio } from "@/lib/desempenho/colunas-configuradas";
import { construirIndiceDepartamentos } from "@/lib/desempenho/comprador-cadastro";
import { CONSULTA_ENTRADAS_SAIDAS_PADRAO, computarEntradasSaidas } from "@/lib/entradas-saidas/consulta";
import {
  obterOuSemearConfigRelatorio,
  obterOuSemearDepartamentosCadastro,
  obterOuSemearDicionarioColunas,
  obterOuSemearLojasCadastro,
} from "@/lib/parametros/store";

// Espelho de app/entradas-saidas/page.tsx: os arquivos-fonte mudam a cada
// atualização do time — nunca pré-renderizar preso ao momento do build.
export const dynamic = "force-dynamic";

function ordenarMeses(nomesArquivo: string[]): string[] {
  const presentes = new Set(nomesArquivo.map((n) => n.match(/^bd(\w+)\.txt$/)?.[1]).filter(Boolean));
  return NOMES_MESES_ARQUIVO.filter((m) => presentes.has(m));
}

export default async function CompraVendaPage() {
  const [nomesArquivo, departamentos, lojas, dicionario, config] = await Promise.all([
    getMesesDisponiveisEntradasSaidas(),
    obterOuSemearDepartamentosCadastro(),
    obterOuSemearLojasCadastro(),
    obterOuSemearDicionarioColunas(),
    obterOuSemearConfigRelatorio("compra-venda"),
  ]);

  const indiceComprador = construirIndiceDepartamentos(departamentos);
  const colunas = colunasDoRelatorio(config, dicionario);

  const formatosLoja = Array.from(new Set(lojas.map((l) => l.formato.trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, "pt-BR"),
  );
  // "Todos" sempre como opção (soma Varejo + Atacado, meta ponderada pela Venda
  // atual de cada um — pedido de 2026-09-30), mas o padrão continua sendo um
  // formato específico: "Varejo", ou o primeiro em ordem alfabética.
  const formatosDisponiveis = ["Todos", ...formatosLoja];
  const formatoPadrao = formatosLoja.includes("Varejo") ? "Varejo" : (formatosLoja[0] ?? null);

  const mesesDisponiveisInicial = ordenarMeses(nomesArquivo);
  const mesPadrao = mesesDisponiveisInicial.at(-1) ?? null;

  const linhasBrutas = await getEntradasSaidasReduzido(mesPadrao ? [`bd${mesPadrao}.txt`] : []);
  const linhasIniciais = formatoPadrao ? filtrarPorFormato(linhasBrutas, formatoPadrao) : [];
  const resultadoBase = computarEntradasSaidas(linhasIniciais, CONSULTA_ENTRADAS_SAIDAS_PADRAO, indiceComprador);
  const pesos = pesosPorDepartamentoFormato(linhasBrutas);
  const resultadoInicial = injetarMetasNoResultado(
    resultadoBase,
    CONSULTA_ENTRADAS_SAIDAS_PADRAO,
    linhasIniciais,
    pesos,
    config.metas ?? {},
    formatoPadrao ?? "",
    indiceComprador,
  );

  return (
    <div className="flex min-h-full flex-col">
      <ModuleNav active="compra-venda" />
      <main className="mx-auto w-full max-w-[1800px] flex-1 px-6 py-6">
        <CompraVendaDashboard
          config={config}
          colunas={colunas}
          resultadoInicial={resultadoInicial}
          mesPadrao={mesPadrao}
          mesesDisponiveisInicial={mesesDisponiveisInicial}
          formatoPadrao={formatoPadrao}
          formatosDisponiveis={formatosDisponiveis}
          lojasCadastro={lojas}
        />
      </main>
    </div>
  );
}
