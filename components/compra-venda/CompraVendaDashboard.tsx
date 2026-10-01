"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { HierarquiaPanel } from "@/components/entradas-saidas/HierarquiaPanel";
import { LojasInformativoPanel, type ColunaLojas } from "@/components/entradas-saidas/LojasInformativoPanel";
import { KpiCardsCompraVenda } from "@/components/compra-venda/KpiCardsCompraVenda";
import { MultiSelect } from "@/components/ui/MultiSelect";
import type { ColunaRenderizavel } from "@/lib/desempenho/colunas-configuradas";
import type { NivelHierarquia } from "@/lib/desempenho/aggregate";
import type { NoEntradasSaidas } from "@/lib/entradas-saidas/aggregate";
import type { ConsultaEntradasSaidas, NoSelecionadoES, ResultadoEntradasSaidas } from "@/lib/entradas-saidas/consulta";
import { avaliarColunas } from "@/lib/parametros/avaliador";
import type { ConfigRelatorio, LojaCadastro } from "@/lib/parametros/types";

const ALTURA_NAV = 52;

async function buscarResultado(
  consulta: ConsultaEntradasSaidas & { mes: string | null; formato: string },
  signal: AbortSignal,
): Promise<ResultadoEntradasSaidas> {
  const resposta = await fetch("/api/compra-venda", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(consulta),
    signal,
  });
  if (!resposta.ok) throw new Error(`Falha ao buscar dados (${resposta.status})`);
  return resposta.json();
}

/**
 * Espelho de EntradasSaidasDashboard.tsx (decisão de 2026-09-30: o layout
 * "flat" anterior não ficou bom — mesma UI de drill-down duplo do Entradas e
 * Saídas, com um seletor de Formato a mais, já que Compra e Venda é por
 * Formato e o outro relatório não distingue isso).
 */
export function CompraVendaDashboard({
  config,
  colunas,
  resultadoInicial,
  mesPadrao,
  mesesDisponiveisInicial,
  formatoPadrao,
  formatosDisponiveis,
  lojasCadastro,
}: {
  config: ConfigRelatorio;
  colunas: ColunaRenderizavel[];
  resultadoInicial: ResultadoEntradasSaidas;
  mesPadrao: string | null;
  mesesDisponiveisInicial: string[];
  formatoPadrao: string | null;
  formatosDisponiveis: string[];
  lojasCadastro: LojaCadastro[];
}) {
  const [mes, setMes] = useState<string | null>(mesPadrao);
  const [formato, setFormato] = useState<string | null>(formatoPadrao);
  const [lojasSelecionadas, setLojasSelecionadas] = useState<string[]>([]);
  const [focoLojas, setFocoLojas] = useState<"departamento" | "comprador">("departamento");
  const [caminhoDepartamento, setCaminhoDepartamento] = useState<NoSelecionadoES[]>([]);
  const [compradorSelecionado, setCompradorSelecionado] = useState<string | null>(null);
  const [caminhoDentroComprador, setCaminhoDentroComprador] = useState<NoSelecionadoES[]>([]);
  const [resultado, setResultado] = useState<ResultadoEntradasSaidas>(resultadoInicial);
  const [carregando, setCarregando] = useState(false);
  const primeiraRenderizacao = useRef(true);
  const idRequisicaoRef = useRef(0);

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
    if (!formato) return;
    const idDaRequisicao = ++idRequisicaoRef.current;
    const controller = new AbortController();
    setCarregando(true);
    const consulta: ConsultaEntradasSaidas & { mes: string | null; formato: string } = {
      mes,
      formato,
      lojas: lojasSelecionadas,
      focoLojas,
      caminhoDepartamento,
      compradorSelecionado,
      caminhoDentroComprador,
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
  }, [mes, formato, lojasSelecionadas, focoLojas, caminhoDepartamento, compradorSelecionado, caminhoDentroComprador]);

  function aoClicarDepartamento(linha: NoEntradasSaidas) {
    setFocoLojas("departamento");
    if (linha.nivel === "produto") return;
    setCaminhoDepartamento((atual) => [...atual, { nivel: linha.nivel as NivelHierarquia, chave: linha.chave, nome: linha.nome }]);
  }

  function aoClicarComprador(linha: NoEntradasSaidas) {
    setFocoLojas("comprador");
    if (linha.nivel === "comprador") {
      setCompradorSelecionado(linha.nome);
      setCaminhoDentroComprador([]);
      return;
    }
    if (linha.nivel === "produto") return;
    setCaminhoDentroComprador((atual) => [...atual, { nivel: linha.nivel as NivelHierarquia, chave: linha.chave, nome: linha.nome }]);
  }

  function aoVoltarDepartamento(indice: number) {
    setFocoLojas("departamento");
    setCaminhoDepartamento((atual) => atual.slice(0, indice + 1));
  }

  function aoVoltarComprador(indice: number) {
    setFocoLojas("comprador");
    if (indice === -1 && caminhoDentroComprador.length === 0) {
      setCompradorSelecionado(null);
      return;
    }
    setCaminhoDentroComprador((atual) => atual.slice(0, indice + 1));
  }

  const kpiAvaliado = avaliarColunas(config, { atual: resultado.kpi, comparacao: null });

  // Compra/Venda em R$ + % Compra/Venda — pedido de 2026-09-30 (só a % sozinha
  // não dava pra ler direito o tamanho da loja, uma tabela pequena com as três
  // ajuda). "% Compra/Venda" não tem papel próprio — achada pelo nome, igual
  // DDE no Entradas e Saídas (a ordem das colunas é editável em Parâmetros).
  const colunasLojas: ColunaLojas[] = (() => {
    const percCompraVenda = config.calculadas.find((c) => c.nome === "% Compra/Venda");
    const base: ColunaLojas[] = [
      { ref: "Compras", rotulo: config.rotulos?.Compras ?? "Compra", formato: "moeda", pivotZero: false, semHeatmap: true },
      { ref: "Valor", rotulo: config.rotulos?.Valor ?? "Venda", formato: "moeda", pivotZero: false, semHeatmap: true },
    ];
    return percCompraVenda
      ? [...base, { ref: percCompraVenda.id, rotulo: "% Compra/Venda", formato: "percentual", pivotZero: false }]
      : base;
  })();

  const breadcrumbDepartamento = caminhoDepartamento.map((n) => ({ nome: n.nome }));
  const breadcrumbComprador = compradorSelecionado
    ? [{ nome: compradorSelecionado }, ...caminhoDentroComprador.map((n) => ({ nome: n.nome }))]
    : [];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-2xl font-bold text-zinc-900">Compra e Venda</h1>
        <p className="mt-0.5 text-sm text-zinc-500">% Compra/Venda, Margem e Meta por Departamento e por Comprador.</p>
      </div>

      {/* Filtros grudados junto com os KPIs (pedido de 2026-09-30) — sem isso eles
          somem ao rolar a página, e ficam inacessíveis exatamente quando dá mais
          vontade de trocar Loja/Formato pra comparar outro recorte. */}
      <div
        ref={kpiRef}
        className="sticky z-30 -mx-6 flex flex-col gap-3 border-b border-zinc-200 bg-zinc-50 px-6 pb-3 pt-3"
        style={{ top: ALTURA_NAV }}
      >
        <div className="flex flex-wrap items-center justify-end gap-3">
          <MultiSelect
            rotulo="Loja"
            rotuloTodos="Todas"
            opcoes={lojasCadastro.map((l) => ({ value: l.codigo, label: `${l.codigo} - ${l.nomeCustomizado}` }))}
            selecionados={lojasSelecionadas}
            onChange={setLojasSelecionadas}
          />
          <label className="flex items-center gap-2 text-sm text-zinc-600">
            Formato:
            <select
              value={formato ?? ""}
              onChange={(e) => setFormato(e.target.value || null)}
              className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm"
            >
              {formatosDisponiveis.length === 0 && <option value="">Sem formato cadastrado</option>}
              {formatosDisponiveis.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-zinc-600">
            Período:
            <select
              value={mes ?? ""}
              onChange={(e) => setMes(e.target.value || null)}
              className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm"
            >
              {mesesDisponiveisInicial.length === 0 && <option value="">Sem dados</option>}
              {mesesDisponiveisInicial.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
        </div>
        <KpiCardsCompraVenda kpi={kpiAvaliado} config={config} colunas={colunas} />
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
