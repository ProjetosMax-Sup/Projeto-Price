import { DesempenhoDashboard } from "@/components/desempenho/DesempenhoDashboard";
import { ModuleNav } from "@/components/ui/ModuleNav";
import { getDataProvider } from "@/lib/data-providers";
import { listaCompradores } from "@/lib/desempenho/compradores";
import { CONSULTA_PADRAO, computarDesempenho } from "@/lib/desempenho/consulta";
import { datasDisponiveis } from "@/lib/desempenho/datas";
import { calcularLabelPeriodo } from "@/lib/desempenho/periodo";

// Os arquivos-fonte mudam a cada atualização do time — nunca pré-renderizar
// com dados presos ao momento do build.
export const dynamic = "force-dynamic";
// Arquivos grandes vindos do OneDrive (dezenas de MB) podem demorar mais que
// o padrão de 10s em requisições "frias" — 60s é o teto do plano Hobby.
export const maxDuration = 60;

export default async function DesempenhoComercialPage() {
  const provider = getDataProvider();
  const [lojas, atual, comparacao] = await Promise.all([
    provider.getLojas(),
    provider.getDesempenhoAtual(),
    provider.getDesempenhoComparacao(),
  ]);

  const compradores = listaCompradores();

  // Só o resultado já agregado (KPIs + algumas dezenas/centenas de linhas) vai para o
  // cliente — os registros brutos (centenas de milhares de linhas) ficam no servidor.
  const resultadoInicial = computarDesempenho(atual.registros, comparacao.registros, lojas, CONSULTA_PADRAO);

  const periodoAtual = calcularLabelPeriodo(atual.registros) ?? "—";
  const periodoComparacao = calcularLabelPeriodo(comparacao.registros);

  const datasDisponiveisAtualInicial = datasDisponiveis(atual.registros);
  const datasDisponiveisComparacaoInicial = datasDisponiveis(comparacao.registros);

  return (
    <div className="flex min-h-full flex-col">
      <ModuleNav active="desempenho-comercial" />
      <main className="mx-auto w-full max-w-[1800px] flex-1 px-6 py-6">
        <DesempenhoDashboard
          lojas={lojas}
          compradores={compradores}
          produtosDescartados={atual.produtosDescartados}
          produtosDescartadosCodigos={atual.produtosDescartadosCodigos}
          resultadoInicial={resultadoInicial}
          periodoAtual={periodoAtual}
          periodoComparacaoInicial={periodoComparacao}
          datasDisponiveisAtualInicial={datasDisponiveisAtualInicial}
          datasDisponiveisComparacaoInicial={datasDisponiveisComparacaoInicial}
        />
      </main>
    </div>
  );
}
