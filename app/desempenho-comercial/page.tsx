import { DesempenhoDashboard } from "@/components/desempenho/DesempenhoDashboard";
import { ModuleNav } from "@/components/ui/ModuleNav";
import { getDataProvider } from "@/lib/data-providers";
import { CONSULTA_PADRAO, computarDesempenho } from "@/lib/desempenho/consulta";

// Os arquivos-fonte mudam a cada atualização do time — nunca pré-renderizar
// com dados presos ao momento do build.
export const dynamic = "force-dynamic";
// Arquivos grandes vindos do OneDrive (dezenas de MB) podem demorar mais que
// o padrão de 10s em requisições "frias" — 60s é o teto do plano Hobby.
export const maxDuration = 60;

export default async function DesempenhoComercialPage() {
  const provider = getDataProvider();
  const [lojas, produtos, atual, comparacao] = await Promise.all([
    provider.getLojas(),
    provider.getProdutos(),
    provider.getDesempenhoAtual(),
    provider.getDesempenhoComparacao(),
  ]);

  const compradoresPorCodigo = new Map<string, string>();
  for (const produto of produtos) {
    compradoresPorCodigo.set(produto.comprador, produto.nomeComprador);
  }
  const compradores = Array.from(compradoresPorCodigo.entries())
    .map(([codigo, nome]) => ({ codigo, nome }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  // Só o resultado já agregado (KPIs + algumas dezenas/centenas de linhas) vai para o
  // cliente — os registros brutos (centenas de milhares de linhas) ficam no servidor.
  const resultadoInicial = computarDesempenho(atual.registros, comparacao.registros, lojas, CONSULTA_PADRAO);

  return (
    <div className="flex min-h-full flex-col">
      <ModuleNav active="desempenho-comercial" />
      <main className="mx-auto w-full max-w-[1800px] flex-1 px-6 py-6">
        <DesempenhoDashboard
          lojas={lojas}
          compradores={compradores}
          produtosDescartados={atual.produtosDescartados}
          resultadoInicial={resultadoInicial}
        />
      </main>
    </div>
  );
}
