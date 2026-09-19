"use client";

import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from "react";
import { CadastroIncompletoBadge } from "@/components/desempenho/CadastroIncompletoBadge";
import { FilterBar } from "@/components/desempenho/FilterBar";
import { KpiCards } from "@/components/desempenho/KpiCards";
import { EstruturaPanel } from "@/components/desempenho/EstruturaPanel";
import { LojasPanel } from "@/components/desempenho/LojasPanel";
import { StatusBar } from "@/components/desempenho/StatusBar";
import { TopAltasQuedas } from "@/components/desempenho/TopAltasQuedas";
import { labelNivel, type EstruturaAgregada, type LojaAgregada, type NivelHierarquia } from "@/lib/desempenho/aggregate";
import {
  CONSULTA_PADRAO,
  type ConsultaDesempenho,
  type Filtros,
  type IntervaloData,
  type NoSelecionado,
  type ResultadoDesempenho,
} from "@/lib/desempenho/consulta";
import { exportarExcel, exportarPdf } from "@/lib/desempenho/export";
import type { Loja } from "@/lib/types";

/** Altura (px) do header fixo do site (`ModuleNav`) — soma-se à altura do bloco Filtros+KPIs pra formar o offset sticky das tabelas. */
const ALTURA_NAV = 52;

async function buscarResultado(consulta: ConsultaDesempenho, signal: AbortSignal): Promise<ResultadoDesempenho> {
  const resposta = await fetch("/api/desempenho-comercial", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(consulta),
    signal,
  });
  if (!resposta.ok) throw new Error(`Falha ao buscar dados (${resposta.status})`);
  return resposta.json();
}

function formatarDataHora(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function DesempenhoDashboard({
  lojas,
  compradores,
  produtosDescartados,
  produtosDescartadosCodigos,
  resultadoInicial,
  periodoAtual: periodoAtualLabel,
  periodoComparacaoInicial: periodoComparacaoLabel,
  datasDisponiveisAtualInicial,
  datasDisponiveisComparacaoInicial,
}: {
  lojas: Loja[];
  compradores: string[];
  produtosDescartados: number;
  produtosDescartadosCodigos: string[];
  resultadoInicial: ResultadoDesempenho;
  periodoAtual: string;
  periodoComparacaoInicial: string | null;
  datasDisponiveisAtualInicial: string[];
  datasDisponiveisComparacaoInicial: string[];
}) {
  const [filtros, setFiltros] = useState<Filtros>(CONSULTA_PADRAO.filtros);
  const [periodoAtual, setPeriodoAtual] = useState<IntervaloData | null>(null);
  const [periodoComparacao, setPeriodoComparacao] = useState<IntervaloData | null>(null);
  const [datasDisponiveisAtual, setDatasDisponiveisAtual] = useState<string[]>(datasDisponiveisAtualInicial);
  const [datasDisponiveisComparacao, setDatasDisponiveisComparacao] = useState<string[]>(datasDisponiveisComparacaoInicial);
  // Breadcrumb do drill-down: Departamento → Seção → Categoria → Grupo → Sub
  // Grupo → Produto. O nível exibido é sempre o próximo depois do último nó.
  const [caminhoDrill, setCaminhoDrill] = useState<NoSelecionado[]>([]);
  // Produto escolhido dentro da lista de Produtos (folha do drill-down) — filtra
  // KPIs/Lojas por aquele SKU sem sair da lista de produtos irmãos.
  const [produtoSelecionado, setProdutoSelecionado] = useState<string | null>(null);
  const [lojasSelecionadas, setLojasSelecionadas] = useState<string[]>([]);
  const [modoRanking, setModoRanking] = useState(false);
  const [nivelTopAltasQuedas, setNivelTopAltasQuedas] = useState<NivelHierarquia>("secao");
  const [exportando, setExportando] = useState<"excel" | "pdf" | null>(null);
  const [atualizandoDados, setAtualizandoDados] = useState(false);
  const [dadosGeradoEm, setDadosGeradoEm] = useState<string | null>(null);

  const [resultado, setResultado] = useState<ResultadoDesempenho>(resultadoInicial);
  const [carregando, setCarregando] = useState(false);
  const primeiraRenderizacao = useRef(true);
  // Só o request mais recente pode atualizar a tela — evita que uma resposta
  // atrasada de um filtro antigo sobrescreva o resultado de um filtro mais novo.
  const idRequisicaoRef = useRef(0);

  // Altura real do bloco Filtros+KPIs (varia conforme os chips de filtro quebram linha) — soma-se
  // a ALTURA_NAV pra formar o offset sticky do cabeçalho da tabela "ativa" na viewport (ver JSX).
  const filtrosKpiRef = useRef<HTMLDivElement>(null);
  const [alturaFiltrosKpi, setAlturaFiltrosKpi] = useState(0);
  useLayoutEffect(() => {
    const elemento = filtrosKpiRef.current;
    if (!elemento) return;
    // `entrada.contentRect` mede só a content-box (sem padding/borda) — usar `offsetHeight` pra
    // pegar a altura total (border-box) que o bloco realmente ocupa na página, senão o offset dos
    // cabeçalhos das tabelas fica menor do que devia e eles ficam parcialmente atrás dos cards.
    const observer = new ResizeObserver(() => setAlturaFiltrosKpi(elemento.offsetHeight));
    observer.observe(elemento);
    return () => observer.disconnect();
  }, []);
  const stickyTop = ALTURA_NAV + alturaFiltrosKpi;

  useEffect(() => {
    fetch("/api/atualizar-dados")
      .then((r) => r.json())
      .then((d) => setDadosGeradoEm(d.geradoEm ?? null))
      .catch(() => {});
  }, []);

  useEffect(() => {
    // O resultado da renderização inicial (servidor) já cobre o estado padrão.
    if (primeiraRenderizacao.current) {
      primeiraRenderizacao.current = false;
      return;
    }
    const idDaRequisicao = ++idRequisicaoRef.current;
    const controller = new AbortController();
    setCarregando(true);
    const consulta: ConsultaDesempenho = {
      filtros,
      caminhoDrill,
      produtoSelecionado,
      lojasSelecionadas,
      nivelTopAltasQuedas,
      periodoAtual,
      periodoComparacao,
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
  }, [filtros, caminhoDrill, produtoSelecionado, lojasSelecionadas, nivelTopAltasQuedas, periodoAtual, periodoComparacao]);

  function aoClicarEstrutura(linha: EstruturaAgregada) {
    if (linha.nivel === "produto") {
      // Produto é a folha do drill-down: clicar seleciona (ou desmarca, se já
      // selecionado) pra ver a performance daquele SKU por loja + nos cards,
      // sem sair da lista de produtos irmãos.
      setProdutoSelecionado((atual) => (atual === linha.chave ? null : linha.chave));
      return;
    }
    setCaminhoDrill((atual) => [...atual, { nivel: linha.nivel, chave: linha.chave, nome: linha.nome }]);
    setProdutoSelecionado(null);
  }

  /** indice = -1 volta pra raiz (Departamentos); N volta pro nível do N-ésimo nó do caminho. */
  function aoVoltarPara(indice: number) {
    setCaminhoDrill((atual) => atual.slice(0, indice + 1));
    setProdutoSelecionado(null);
  }

  /**
   * Clique simples seleciona só aquela loja (clicar de novo na única selecionada
   * desmarca). Shift+clique adiciona/remove a loja à seleção atual (multi-seleção).
   */
  function aoClicarLoja(loja: LojaAgregada, evento: MouseEvent) {
    const codigo = loja.loja.codUnid;
    if (evento.shiftKey) {
      setLojasSelecionadas((atual) =>
        atual.includes(codigo) ? atual.filter((c) => c !== codigo) : [...atual, codigo],
      );
    } else {
      setLojasSelecionadas((atual) => (atual.length === 1 && atual[0] === codigo ? [] : [codigo]));
    }
  }

  function aoLimparSelecao() {
    setCaminhoDrill([]);
    setProdutoSelecionado(null);
    setLojasSelecionadas([]);
  }

  const nomesLojasSelecionadas = lojasSelecionadas
    .map((codigo) => lojas.find((l) => l.codUnid === codigo)?.nomeLoja)
    .filter((nome): nome is string => Boolean(nome));

  const noAtivo = caminhoDrill.at(-1) ?? null;
  const produtoSelecionadoLinha = produtoSelecionado
    ? (resultado.linhasEstrutura.find((l) => l.chave === produtoSelecionado) ?? null)
    : null;
  const partesRecorte: string[] = [];
  if (noAtivo) {
    partesRecorte.push(`${labelNivel(noAtivo.nivel)} ${noAtivo.nome}`);
  }
  if (produtoSelecionadoLinha) {
    partesRecorte.push(`Produto ${produtoSelecionadoLinha.nome}`);
  }
  if (nomesLojasSelecionadas.length === 1) {
    partesRecorte.push(`Loja ${nomesLojasSelecionadas[0]}`);
  } else if (nomesLojasSelecionadas.length > 1) {
    partesRecorte.push(`${nomesLojasSelecionadas.length} lojas (${nomesLojasSelecionadas.join(", ")})`);
  }

  const descricaoRecorte =
    partesRecorte.length > 0 ? partesRecorte.join(" × ") : "toda a empresa × todas as lojas";

  async function aoExportar(formato: "excel" | "pdf") {
    setExportando(formato);
    try {
      const dados = { descricaoRecorte, nivelEstrutura: resultado.estruturaNivel, ...resultado };
      if (formato === "excel") {
        await exportarExcel(dados);
      } else {
        await exportarPdf(dados);
      }
    } catch (erro) {
      console.error("Falha ao exportar", erro);
    } finally {
      setExportando(null);
    }
  }

  async function aoAtualizarDados() {
    setAtualizandoDados(true);
    try {
      const resposta = await fetch("/api/atualizar-dados", { method: "POST" });
      const dados = await resposta.json();
      if (dados.ok) {
        setDadosGeradoEm(dados.geradoEm);
        // Datas podem ter mudado de cobertura no arquivo novo — resincroniza a lista usada
        // pra validar os seletores de período.
        fetch("/api/desempenho-comercial")
          .then((r) => r.json())
          .then((d) => {
            setDatasDisponiveisAtual(d.datasAtual ?? []);
            setDatasDisponiveisComparacao(d.datasComparacao ?? []);
          })
          .catch(() => {});
        // Recarrega o recorte atual com os dados novos.
        idRequisicaoRef.current += 1;
        const idDaRequisicao = idRequisicaoRef.current;
        const consulta: ConsultaDesempenho = {
          filtros,
          caminhoDrill,
          produtoSelecionado,
          lojasSelecionadas,
          nivelTopAltasQuedas,
          periodoAtual,
          periodoComparacao,
        };
        const resultadoNovo = await buscarResultado(consulta, new AbortController().signal);
        if (idRequisicaoRef.current === idDaRequisicao) setResultado(resultadoNovo);
      } else {
        console.error("Falha ao atualizar dados:", dados.erro);
      }
    } catch (erro) {
      console.error("Falha ao atualizar dados", erro);
    } finally {
      setAtualizandoDados(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-zinc-900">Desempenho Comercial</h1>
          <p className="mt-0.5 text-sm text-zinc-500">Vendas, margem e desvio por categoria e loja.</p>
        </div>
        <div className="flex items-center gap-3">
          <CadastroIncompletoBadge quantidade={produtosDescartados} codigos={produtosDescartadosCodigos} />
          <span className="text-xs text-zinc-400">Última atualização: {formatarDataHora(dadosGeradoEm)}</span>
          <button
            type="button"
            onClick={aoAtualizarDados}
            disabled={atualizandoDados}
            title="Atualiza sozinho todo dia às 09h — clique pra forçar agora"
            className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
          >
            {atualizandoDados ? "Atualizando…" : "↻ Atualizar dados"}
          </button>
          <button
            type="button"
            disabled={exportando !== null}
            onClick={() => aoExportar("excel")}
            title="Exportar Excel"
            className="rounded-md border border-zinc-300 bg-white p-2 text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
          >
            ⬇ Excel
          </button>
          <button
            type="button"
            disabled={exportando !== null}
            onClick={() => aoExportar("pdf")}
            title="Exportar PDF"
            className="rounded-md border border-zinc-300 bg-white p-2 text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
          >
            ⬇ PDF
          </button>
        </div>
      </div>

      {/* Filtros+KPIs, StatusBar, Top Altas/Quedas e as duas tabelas vivem no MESMO
          wrapper flex-col: um elemento sticky só fica "grudado" enquanto o
          próprio wrapper que o contém ainda está passando pela tela. Como esse
          wrapper só termina depois da LojasPanel (a última coisa da página),
          o bloco Filtros+KPIs nunca solta enquanto houver tabela na tela — é
          exatamente esse bloco, sempre visível, que ocupa o espaço acima de
          cada cabeçalho de tabela (por isso as linhas nunca "vazam" por cima
          do cabeçalho: a região entre o nav e o cabeçalho da tabela está
          sempre coberta pelo bloco opaco de Filtros+KPIs).
          Cada tabela (EstruturaPanel/LojasPanel), por sua vez, tem seu próprio
          cabeçalho sticky (offset = stickyTop, calculado abaixo a partir da
          altura real do bloco Filtros+KPIs) — o cabeçalho de cada tabela é um
          `<table>` separado do corpo (ver comentário em EstruturaPanel.tsx)
          porque um `<thead>` sticky dentro do container de scroll horizontal
          do corpo não gruda (qualquer ancestral com overflow não-visível
          quebra `position: sticky` de um descendente, mesmo sem overflow
          real). Isso faz o cabeçalho de uma tabela grudar só enquanto ela
          está passando pela tela e soltar assim que a próxima tabela assume o
          mesmo offset — tudo via CSS puro, sem IntersectionObserver. */}
      <div className="flex flex-col gap-4">
        <div
          ref={filtrosKpiRef}
          className="sticky z-30 -mx-6 flex flex-col gap-4 border-b border-zinc-200 bg-zinc-50 px-6 pb-3 pt-3"
          style={{ top: ALTURA_NAV }}
        >
          <FilterBar
            lojas={lojas}
            compradores={compradores}
            filtros={filtros}
            onChange={setFiltros}
            periodoAtualLabel={periodoAtualLabel}
            periodoComparacaoLabel={periodoComparacaoLabel}
            periodoAtual={periodoAtual}
            onChangePeriodoAtual={setPeriodoAtual}
            periodoComparacao={periodoComparacao}
            onChangePeriodoComparacao={setPeriodoComparacao}
            datasDisponiveisAtual={datasDisponiveisAtual}
            datasDisponiveisComparacao={datasDisponiveisComparacao}
          />

          <KpiCards atual={resultado.kpiAtual} comparacao={resultado.kpiComparacao} />
        </div>

        <StatusBar
          descricaoRecorte={descricaoRecorte}
          temSelecao={partesRecorte.length > 0}
          onLimpar={aoLimparSelecao}
        />

        <div className={`transition-opacity ${carregando ? "pointer-events-none opacity-60" : ""}`}>
          <TopAltasQuedas nivel={nivelTopAltasQuedas} onNivelChange={setNivelTopAltasQuedas} linhas={resultado.linhasTop} />
        </div>

        <div className={`flex flex-col gap-4 transition-opacity ${carregando ? "pointer-events-none opacity-60" : ""}`}>
          <EstruturaPanel
            nivel={resultado.estruturaNivel}
            linhas={resultado.linhasEstrutura}
            caminho={caminhoDrill}
            produtoSelecionado={produtoSelecionado}
            modoRanking={modoRanking}
            onToggleModo={() => setModoRanking((m) => !m)}
            onClickLinha={aoClicarEstrutura}
            onVoltarPara={aoVoltarPara}
            stickyTop={stickyTop}
          />
          <LojasPanel
            linhas={resultado.linhasLojas}
            selecionadas={lojasSelecionadas}
            onClickLinha={aoClicarLoja}
            stickyTop={stickyTop}
          />
        </div>

        {/* Fica DENTRO do mesmo wrapper sticky-container (acima) — dá folga suficiente pro
            cabeçalho da Lojas (e o próprio bloco Filtros+KPIs) soltarem de forma limpa depois da
            última linha, em vez do wrapper terminar bem em cima da tabela (o que causava uma
            transição bagunçada bem no fim do scroll, com elementos soltando em momentos
            ligeiramente diferentes). */}
        <p className="pt-2 pb-2 text-center text-xs text-zinc-400" style={{ minHeight: stickyTop }}>
          Fonte: bdDesempenhoComercialAtual + bdDesempenhoComercialComparação + bdCadastro + bdLojas · Dados
          atualizados em {formatarDataHora(dadosGeradoEm)}
        </p>
      </div>
    </div>
  );
}
