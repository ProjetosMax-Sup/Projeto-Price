import { NOMES_MESES_ARQUIVO } from "@/config/data-sources";
import { EntradasSaidasDashboard } from "@/components/entradas-saidas/EntradasSaidasDashboard";
import { ModuleNav } from "@/components/ui/ModuleNav";
import { getEntradasSaidasReduzido, getMesesDisponiveisEntradasSaidas } from "@/lib/data-providers/file-provider";
import { colunasDoRelatorio } from "@/lib/desempenho/colunas-configuradas";
import { construirIndiceDepartamentos } from "@/lib/desempenho/comprador-cadastro";
import { CONSULTA_ENTRADAS_SAIDAS_PADRAO, computarEntradasSaidas, departamentosExcluidosDoTotal } from "@/lib/entradas-saidas/consulta";
import {
  obterOuSemearConfigRelatorio,
  obterOuSemearDepartamentosCadastro,
  obterOuSemearDicionarioColunas,
  obterOuSemearLojasCadastro,
} from "@/lib/parametros/store";

// Os arquivos-fonte mudam a cada atualização do time — nunca pré-renderizar
// com dados presos ao momento do build.
export const dynamic = "force-dynamic";

/** Nomes de arquivo (`bd<Mês>.txt`) → nomes de mês, na ordem do calendário —
 * pra saber qual é "o mês mais recente" sem precisar ler conteúdo nenhum. */
function ordenarMeses(nomesArquivo: string[]): string[] {
  const presentes = new Set(nomesArquivo.map((n) => n.match(/^bd(\w+)\.txt$/)?.[1]).filter(Boolean));
  return NOMES_MESES_ARQUIVO.filter((m) => presentes.has(m));
}

export default async function EntradasSaidasPage() {
  const [nomesArquivo, departamentosCadastro, lojasCadastro, dicionario, config] = await Promise.all([
    getMesesDisponiveisEntradasSaidas(),
    obterOuSemearDepartamentosCadastro(),
    obterOuSemearLojasCadastro(),
    obterOuSemearDicionarioColunas(),
    obterOuSemearConfigRelatorio("entradas-saidas"),
  ]);

  const indiceComprador = construirIndiceDepartamentos(departamentosCadastro);
  const colunas = colunasDoRelatorio(config, dicionario);

  // Padrão: o mês mais recente disponível — arquivos não carregam ano, então
  // "mais recente" aqui é só o último na ordem do calendário (Jan→Dez) entre
  // os que existem, mesma limitação que já existia no nome dos arquivos.
  const mesesDisponiveisInicial = ordenarMeses(nomesArquivo);
  const mesPadrao = mesesDisponiveisInicial.at(-1) ?? null;

  const linhasIniciais = await getEntradasSaidasReduzido(mesPadrao ? [`bd${mesPadrao}.txt`] : []);
  const resultadoInicial = computarEntradasSaidas(
    linhasIniciais,
    CONSULTA_ENTRADAS_SAIDAS_PADRAO,
    indiceComprador,
    departamentosExcluidosDoTotal(departamentosCadastro),
  );

  return (
    <div className="flex min-h-full flex-col">
      <ModuleNav active="entradas-saidas" />
      <main className="mx-auto w-full max-w-[1800px] flex-1 px-6 py-6">
        <EntradasSaidasDashboard
          config={config}
          colunas={colunas}
          resultadoInicial={resultadoInicial}
          mesPadrao={mesPadrao}
          mesesDisponiveisInicial={mesesDisponiveisInicial}
          lojasCadastro={lojasCadastro}
        />
      </main>
    </div>
  );
}
