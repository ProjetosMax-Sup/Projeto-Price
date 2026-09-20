import { DesempenhoDashboard } from "@/components/desempenho/DesempenhoDashboard";
import { ModuleNav } from "@/components/ui/ModuleNav";
import { getDataProvider } from "@/lib/data-providers";
import { obterUsuarioAtual } from "@/lib/auth/usuario-atual";
import { CONSULTA_PADRAO, computarDesempenho } from "@/lib/desempenho/consulta";
import { construirIndiceDepartamentos, listaCompradoresCadastro, listaDepartamentosCadastro } from "@/lib/desempenho/comprador-cadastro";
import { datasDisponiveis, deslocarMeses, periodoMesMaisRecente } from "@/lib/desempenho/datas";
import { lojasDoCadastro } from "@/lib/desempenho/loja-cadastro";
import { calcularLabelPeriodo } from "@/lib/desempenho/periodo";
import { obterOuSemearConfigRelatorio, obterOuSemearDepartamentosCadastro, obterOuSemearLojasCadastro } from "@/lib/parametros/store";
import type { RegistroDesempenho } from "@/lib/types";

// Os arquivos-fonte mudam a cada atualização do time — nunca pré-renderizar
// com dados presos ao momento do build.
export const dynamic = "force-dynamic";
// Arquivos grandes vindos do OneDrive (dezenas de MB) podem demorar mais que
// o padrão de 10s em requisições "frias" — 60s é o teto do plano Hobby.
export const maxDuration = 60;

function semAcesso() {
  return (
    <div className="flex min-h-full flex-col">
      <ModuleNav active="desempenho-comercial" />
      <main className="mx-auto flex w-full max-w-[1800px] flex-1 items-center justify-center px-6 py-6">
        <p className="text-sm text-zinc-500">
          Sem acesso a este relatório. Se você deveria ter acesso, peça pra um Gestor te cadastrar em Parâmetros.
        </p>
      </main>
    </div>
  );
}

export default async function DesempenhoComercialPage() {
  const [usuario, configRelatorio] = await Promise.all([
    obterUsuarioAtual(),
    obterOuSemearConfigRelatorio("desempenho-comercial"),
  ]);

  // Acesso ao relatório (seção 3.3): perfil precisa estar marcado E, se Comprador, ter
  // Departamento(s)+Loja(s) liberados em Usuários — as duas condições valem juntas (E lógico).
  const temAcesso =
    !!usuario &&
    (usuario.perfil === "Gestor"
      ? configRelatorio.acessoGestor
      : configRelatorio.acessoComprador && usuario.departamentos.length > 0 && usuario.lojas.length > 0);

  if (!temAcesso) return semAcesso();

  const provider = getDataProvider();
  const [lojasCadastro, departamentosCadastro, desempenho] = await Promise.all([
    obterOuSemearLojasCadastro(),
    obterOuSemearDepartamentosCadastro(),
    provider.getDesempenho(),
  ]);

  const lojas = lojasDoCadastro(lojasCadastro);
  const indiceComprador = construirIndiceDepartamentos(departamentosCadastro);
  const compradores = listaCompradoresCadastro(departamentosCadastro);
  const departamentos = listaDepartamentosCadastro(departamentosCadastro);

  // Comprador só vê os registros dos Departamentos/Lojas liberados pra ele (seção 3.2) — Gestor
  // vê tudo. Um único filtro sobre o pool inteiro, mesmo padrão de custo dos outros filtros que já
  // rodam aqui (ver aplicarFiltroIntervalo em consulta.ts) — não é operação nova em ordem de grandeza.
  const registros: RegistroDesempenho[] =
    usuario.perfil === "Comprador"
      ? desempenho.registros.filter(
          (r) => r.produto && usuario.departamentos.includes(r.produto.dpto) && r.loja && usuario.lojas.includes(r.loja.codUnid),
        )
      : desempenho.registros;

  const datasDisponiveisInicial = datasDisponiveis(registros);

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
  const resultadoInicial = computarDesempenho(
    registros,
    lojas,
    { ...CONSULTA_PADRAO, periodoAtual: periodoAtualPadrao, periodoComparacao: periodoComparacaoPadrao },
    indiceComprador,
  );

  // Fallback de rótulo (range completo disponível) — Atual e Comparação compartilham o mesmo
  // conjunto de meses, então é um único rótulo pros dois seletores.
  const labelPeriodoDisponivel = calcularLabelPeriodo(registros);

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
