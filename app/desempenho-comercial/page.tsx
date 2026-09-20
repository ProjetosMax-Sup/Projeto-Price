import { DesempenhoDashboard } from "@/components/desempenho/DesempenhoDashboard";
import { ModuleNav } from "@/components/ui/ModuleNav";
import { getDataProvider } from "@/lib/data-providers";
import { listaCompradores } from "@/lib/desempenho/compradores";
import { CONSULTA_PADRAO, computarDesempenho } from "@/lib/desempenho/consulta";
import { datasDisponiveis, deslocarMeses, periodoMesMaisRecente } from "@/lib/desempenho/datas";
import { listaDepartamentos } from "@/lib/desempenho/departamentos";
import { calcularLabelPeriodo } from "@/lib/desempenho/periodo";

// Os arquivos-fonte mudam a cada atualização do time — nunca pré-renderizar
// com dados presos ao momento do build.
export const dynamic = "force-dynamic";
// Arquivos grandes vindos do OneDrive (dezenas de MB) podem demorar mais que
// o padrão de 10s em requisições "frias" — 60s é o teto do plano Hobby.
export const maxDuration = 60;

export default async function DesempenhoComercialPage() {
  const provider = getDataProvider();
  const [lojas, desempenho] = await Promise.all([provider.getLojas(), provider.getDesempenho()]);

  const compradores = listaCompradores();
  const departamentos = listaDepartamentos();

  const datasDisponiveisInicial = datasDisponiveis(desempenho.registros);

  // Padrão (nada escolhido pelo usuário ainda): mês mais recente com dado + o mês anterior a
  // ele — nunca mais o range inteiro do conjunto disponível. Isso é decidido aqui (servidor) e
  // repassado como estado inicial pro client, pra a 1ª renderização (SSR) já bater com o 1º
  // render do client e não precisar de um refetch imediato assim que a página carrega.
  const periodoAtualPadrao = periodoMesMaisRecente(datasDisponiveisInicial);
  const periodoComparacaoPadrao = periodoAtualPadrao
    ? { inicio: deslocarMeses(periodoAtualPadrao.inicio, -1), fim: deslocarMeses(periodoAtualPadrao.fim, -1) }
    : null;

  // Só o resultado já agregado (KPIs + algumas dezenas/centenas de linhas) vai para o
  // cliente — os registros brutos (milhões de linhas, somando todos os meses) ficam no servidor.
  const resultadoInicial = computarDesempenho(desempenho.registros, lojas, {
    ...CONSULTA_PADRAO,
    periodoAtual: periodoAtualPadrao,
    periodoComparacao: periodoComparacaoPadrao,
  });

  // Fallback de rótulo (range completo disponível) — Atual e Comparação compartilham o mesmo
  // conjunto de meses, então é um único rótulo pros dois seletores.
  const labelPeriodoDisponivel = calcularLabelPeriodo(desempenho.registros);

  return (
    <div className="flex min-h-full flex-col">
      <ModuleNav active="desempenho-comercial" />
      <main className="mx-auto w-full max-w-[1800px] flex-1 px-6 py-6">
        <DesempenhoDashboard
          lojas={lojas}
          compradores={compradores}
          departamentos={departamentos}
          produtosDescartados={desempenho.produtosDescartados}
          produtosDescartadosCodigos={desempenho.produtosDescartadosCodigos}
          resultadoInicial={resultadoInicial}
          labelPeriodoDisponivel={labelPeriodoDisponivel}
          periodoAtualPadrao={periodoAtualPadrao}
          periodoComparacaoPadrao={periodoComparacaoPadrao}
          datasDisponiveisInicial={datasDisponiveisInicial}
        />
      </main>
    </div>
  );
}
