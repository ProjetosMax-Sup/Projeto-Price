"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { HierarquiaPanel } from "@/components/entradas-saidas/HierarquiaPanel";
import { KpiCardsEntradasSaidas } from "@/components/entradas-saidas/KpiCardsEntradasSaidas";
import { LojasInformativoPanel, type ColunaLojas } from "@/components/entradas-saidas/LojasInformativoPanel";
import { MultiSelect } from "@/components/ui/MultiSelect";
import type { ColunaRenderizavel } from "@/lib/desempenho/colunas-configuradas";
import type { NoEntradasSaidas } from "@/lib/entradas-saidas/aggregate";
import type { ConsultaEntradasSaidas, NoSelecionadoES, ResultadoEntradasSaidas } from "@/lib/entradas-saidas/consulta";
import { avaliarColunas } from "@/lib/parametros/avaliador";
import type { ConfigRelatorio, LojaCadastro } from "@/lib/parametros/types";
import type { NivelHierarquia } from "@/lib/desempenho/aggregate";

const ALTURA_NAV = 52;

async function buscarResultado(
  consulta: ConsultaEntradasSaidas & { meses: string[] },
  signal: AbortSignal,
): Promise<ResultadoEntradasSaidas> {
  const resposta = await fetch("/api/entradas-saidas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(consulta),
    signal,
  });
  if (!resposta.ok) throw new Error(`Falha ao buscar dados (${resposta.status})`);
  return resposta.json();
}

/**
 * Dois drill-downs independentes (decisão de 2026-09-30): Departamento (raiz)
 * e Comprador→Departamento→... (raiz), sem tabela de Loja. Período aceita
 * vários meses de uma vez desde 2026-10-01 (os arquivos `bd<Mês>.txt` não
 * carregam ano, então o seletor aqui também não — mesma limitação que já
 * existia no nome dos arquivos). Como os meses somam entre si (ver
 * `mesclarMeses` em `lib/entradas-saidas/aggregate.ts`), nunca deixa a seleção
 * ficar vazia — zero mês escolhido não é "todos", é um estado sem sentido aqui.
 */
export function EntradasSaidasDashboard({
  config,
  colunas,
  resultadoInicial,
  mesPadrao,
  mesesDisponiveisInicial,
  lojasCadastro,
}: {
  config: ConfigRelatorio;
  colunas: ColunaRenderizavel[];
  resultadoInicial: ResultadoEntradasSaidas;
  mesPadrao: string | null;
  mesesDisponiveisInicial: string[];
  lojasCadastro: LojaCadastro[];
}) {
  const [meses, setMeses] = useState<string[]>(mesPadrao ? [mesPadrao] : []);
  const [lojasSelecionadas, setLojasSelecionadas] = useState<string[]>([]);
  const [focoLojas, setFocoLojas] = useState<"departamento" | "comprador">("departamento");
  const [caminhoDepartamento, setCaminhoDepartamento] = useState<NoSelecionadoES[]>([]);
  const [compradorSelecionado, setCompradorSelecionado] = useState<string | null>(null);
  const [caminhoDentroComprador, setCaminhoDentroComprador] = useState<NoSelecionadoES[]>([]);
  const [produtoFoco, setProdutoFoco] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoEntradasSaidas>(resultadoInicial);
  const [carregando, setCarregando] = useState(false);
  const primeiraRenderizacao = useRef(true);
  const idRequisicaoRef = useRef(0);

  // Altura real do bloco de KPIs (varia com o tamanho da tela / wrap dos cards) — sem medir de
  // verdade, um valor cravado corta o cabeçalho sticky das tabelas por baixo dele (mesma técnica
  // de `DesempenhoDashboard.tsx`, ali já correta desde o início).
  const kpiRef = useRef<HTMLDivElement>(null);
  const [alturaKpi, setAlturaKpi] = useState(0);
  useLayoutEffect(() => {
    const elemento = kpiRef.current;
    if (!elemento) return;
    const observer = new ResizeObserver(() => setAlturaKpi(elemento.offsetHeight));
    observer.observe(elemento);
    return () => observer.disconnect();
  }, []);
  const stickyTop = ALTURA_NAV + alturaKpi;

  useEffect(() => {
    if (primeiraRenderizacao.current) {
      primeiraRenderizacao.current = false;
      return;
    }
    const idDaRequisicao = ++idRequisicaoRef.current;
    const controller = new AbortController();
    setCarregando(true);
    const consulta: ConsultaEntradasSaidas & { meses: string[] } = {
      meses,
      lojas: lojasSelecionadas,
      focoLojas,
      caminhoDepartamento,
      compradorSelecionado,
      caminhoDentroComprador,
      produtoFoco,
    };
    buscarResultado(consulta, controller.signal)
      .then((dados) => {
        if (idRequisicaoRef.current === idDaRequisicao) setResultado(dados);
      })
      .catch((erro) => {
        if (erro.name !== "AbortError") console.error("Falha ao buscar dados", erro);
      })
      .finally(() => {
        if (idRequisicaoRef.current === idDaRequisicao) setCarregando(false);
      });
    return () => controller.abort();
  }, [meses, lojasSelecionadas, focoLojas, caminhoDepartamento, compradorSelecionado, caminhoDentroComprador, produtoFoco]);

  function aoClicarDepartamento(linha: NoEntradasSaidas) {
    setFocoLojas("departamento");
    // Produto é a folha (sem pra onde descer) — a tabela Departamento continua
    // mostrando a mesma lista, mas o painel Lojas estreita pra esse produto só.
    if (linha.nivel === "produto") {
      setProdutoFoco(linha.codigo ?? linha.chave);
      return;
    }
    setProdutoFoco(null);
    setCaminhoDepartamento((atual) => [...atual, { nivel: linha.nivel as NivelHierarquia, chave: linha.chave, nome: linha.nome }]);
  }

  function aoClicarComprador(linha: NoEntradasSaidas) {
    setFocoLojas("comprador");
    if (linha.nivel === "comprador") {
      setProdutoFoco(null);
      setCompradorSelecionado(linha.nome);
      setCaminhoDentroComprador([]);
      return;
    }
    if (linha.nivel === "produto") {
      setProdutoFoco(linha.codigo ?? linha.chave);
      return;
    }
    setProdutoFoco(null);
    setCaminhoDentroComprador((atual) => [...atual, { nivel: linha.nivel as NivelHierarquia, chave: linha.chave, nome: linha.nome }]);
  }

  function aoVoltarDepartamento(indice: number) {
    setFocoLojas("departamento");
    setProdutoFoco(null);
    setCaminhoDepartamento((atual) => atual.slice(0, indice + 1));
  }

  function aoVoltarComprador(indice: number) {
    setFocoLojas("comprador");
    setProdutoFoco(null);
    // -1 com a trilha dentro do comprador já vazia volta pra lista de Compradores
    // (o título "Comprador" clicado no topo do próprio nível de comprador).
    if (indice === -1 && caminhoDentroComprador.length === 0) {
      setCompradorSelecionado(null);
      return;
    }
    setCaminhoDentroComprador((atual) => atual.slice(0, indice + 1));
  }

  const kpiAvaliado = avaliarColunas(config, { atual: resultado.kpi, comparacao: null });

  // Saldo é a coluna principal do relatório (ver seed.ts); DDE é achada pelo nome
  // porque não tem papel próprio — não dá pra apontar as duas por posição fixa,
  // a ordem das colunas é editável em Parâmetros.
  const dde = config.calculadas.find((c) => c.nome.includes("DDE"));
  const candidatasColunasLojas: (ColunaLojas | undefined)[] = [
    config.papeis?.principal
      ? { ref: config.papeis.principal, rotulo: "Saldo", formato: "moeda", pivotZero: true }
      : undefined,
    dde ? { ref: dde.id, rotulo: "DDE", formato: "numero", pivotZero: false } : undefined,
  ];
  const colunasLojas = candidatasColunasLojas.filter((c): c is ColunaLojas => c !== undefined);

  const breadcrumbDepartamento = caminhoDepartamento.map((n) => ({ nome: n.nome }));
  const breadcrumbComprador = compradorSelecionado
    ? [{ nome: compradorSelecionado }, ...caminhoDentroComprador.map((n) => ({ nome: n.nome }))]
    : [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-zinc-900">Entradas e Saídas</h1>
          <p className="mt-0.5 text-sm text-zinc-500">Compras, saídas e saldo por Departamento e por Comprador.</p>
        </div>
        <div className="flex items-center gap-2">
          <MultiSelect
            rotulo="Loja"
            rotuloTodos="Todas"
            opcoes={lojasCadastro.map((l) => ({ value: l.codigo, label: `${l.codigo} - ${l.nomeCustomizado}` }))}
            selecionados={lojasSelecionadas}
            onChange={setLojasSelecionadas}
          />
          <MultiSelect
            rotulo="Período"
            rotuloTodos="Nenhum mês"
            opcoes={mesesDisponiveisInicial.map((m) => ({ value: m, label: m }))}
            selecionados={meses}
            // Nunca deixa esvaziar — "nenhum mês" não tem leitura aqui (ao contrário de
            // Loja, onde vazio = "todas"), então ignora a mudança que zeraria a seleção.
            onChange={(novos) => setMeses(novos.length > 0 ? novos : meses)}
          />
        </div>
      </div>

      <div
        ref={kpiRef}
        className="sticky z-30 -mx-6 flex flex-col gap-4 border-b border-zinc-200 bg-zinc-50 px-6 pb-3 pt-3"
        style={{ top: ALTURA_NAV }}
      >
        <KpiCardsEntradasSaidas kpi={kpiAvaliado} config={config} colunas={colunas} />
      </div>

      <div className={`flex flex-col gap-4 transition-opacity xl:flex-row ${carregando ? "pointer-events-none opacity-60" : ""}`}>
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <HierarquiaPanel
            titulo="Departamento"
            linhas={resultado.linhasDepartamento}
            breadcrumb={breadcrumbDepartamento}
            config={config}
            colunas={colunas}
            onClickLinha={aoClicarDepartamento}
            onVoltarPara={aoVoltarDepartamento}
            stickyTop={stickyTop}
            ordenacaoPadrao="nome"
          />
          <HierarquiaPanel
            titulo="Comprador"
            linhas={resultado.linhasComprador}
            breadcrumb={breadcrumbComprador}
            config={config}
            colunas={colunas}
            onClickLinha={aoClicarComprador}
            onVoltarPara={aoVoltarComprador}
            stickyTop={stickyTop}
            ordenacaoPadrao="principal"
          />
        </div>
        <div className="xl:w-96 xl:flex-shrink-0">
          <LojasInformativoPanel
            linhas={resultado.linhasLoja}
            lojasCadastro={lojasCadastro}
            config={config}
            colunas={colunasLojas}
            stickyTop={stickyTop}
          />
        </div>
      </div>
    </div>
  );
}
