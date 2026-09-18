"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { CadastroIncompletoBadge } from "@/components/desempenho/CadastroIncompletoBadge";
import { FilterBar } from "@/components/desempenho/FilterBar";
import { KpiCards } from "@/components/desempenho/KpiCards";
import { EstruturaPanel } from "@/components/desempenho/EstruturaPanel";
import { LojasPanel } from "@/components/desempenho/LojasPanel";
import { StatusBar } from "@/components/desempenho/StatusBar";
import { TopAltasQuedas } from "@/components/desempenho/TopAltasQuedas";
import type { EstruturaAgregada, LojaAgregada, NivelEstrutura } from "@/lib/desempenho/aggregate";
import {
  CONSULTA_PADRAO,
  type ConsultaDesempenho,
  type Filtros,
  type NoSelecionado,
  type ResultadoDesempenho,
} from "@/lib/desempenho/consulta";
import { exportarExcel, exportarPdf } from "@/lib/desempenho/export";
import type { Loja } from "@/lib/types";

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

export function DesempenhoDashboard({
  lojas,
  compradores,
  produtosDescartados,
  resultadoInicial,
}: {
  lojas: Loja[];
  compradores: { codigo: string; nome: string }[];
  produtosDescartados: number;
  resultadoInicial: ResultadoDesempenho;
}) {
  const [filtros, setFiltros] = useState<Filtros>(CONSULTA_PADRAO.filtros);
  const [estruturaNivel, setEstruturaNivel] = useState<NivelEstrutura>("departamento");
  const [departamentoAtivo, setDepartamentoAtivo] = useState<NoSelecionado | null>(null);
  const [estruturaSelecionada, setEstruturaSelecionada] = useState<NoSelecionado | null>(null);
  const [lojasSelecionadas, setLojasSelecionadas] = useState<string[]>([]);
  const [modoRanking, setModoRanking] = useState(false);
  const [nivelTopAltasQuedas, setNivelTopAltasQuedas] = useState<NivelEstrutura>("secao");
  const [exportando, setExportando] = useState<"excel" | "pdf" | null>(null);

  const [resultado, setResultado] = useState<ResultadoDesempenho>(resultadoInicial);
  const [carregando, setCarregando] = useState(false);
  const primeiraRenderizacao = useRef(true);

  useEffect(() => {
    // O resultado da renderização inicial (servidor) já cobre o estado padrão.
    if (primeiraRenderizacao.current) {
      primeiraRenderizacao.current = false;
      return;
    }
    const controller = new AbortController();
    setCarregando(true);
    const consulta: ConsultaDesempenho = {
      filtros,
      estruturaNivel,
      departamentoAtivo,
      estruturaSelecionada,
      lojasSelecionadas,
      nivelTopAltasQuedas,
    };
    buscarResultado(consulta, controller.signal)
      .then(setResultado)
      .catch((erro) => {
        if (erro.name !== "AbortError") console.error("Falha ao buscar dados", erro);
      })
      .finally(() => setCarregando(false));
    return () => controller.abort();
  }, [filtros, estruturaNivel, departamentoAtivo, estruturaSelecionada, lojasSelecionadas, nivelTopAltasQuedas]);

  function aoClicarEstrutura(linha: EstruturaAgregada) {
    if (estruturaNivel === "departamento") {
      const no: NoSelecionado = { nivel: "departamento", chave: linha.chave, nome: linha.nome };
      setDepartamentoAtivo(no);
      setEstruturaNivel("secao");
      setEstruturaSelecionada(no);
    } else if (estruturaSelecionada?.chave === linha.chave) {
      setEstruturaSelecionada(departamentoAtivo);
    } else {
      setEstruturaSelecionada({ nivel: "secao", chave: linha.chave, nome: linha.nome });
    }
  }

  function aoVoltarDepartamentos() {
    setEstruturaNivel("departamento");
    setDepartamentoAtivo(null);
    setEstruturaSelecionada(null);
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
    setEstruturaNivel("departamento");
    setDepartamentoAtivo(null);
    setEstruturaSelecionada(null);
    setLojasSelecionadas([]);
  }

  const nomesLojasSelecionadas = lojasSelecionadas
    .map((codigo) => lojas.find((l) => l.codUnid === codigo)?.nomeLoja)
    .filter((nome): nome is string => Boolean(nome));

  const partesRecorte: string[] = [];
  if (estruturaSelecionada) {
    partesRecorte.push(
      `${estruturaSelecionada.nivel === "departamento" ? "Departamento" : "Seção"} ${estruturaSelecionada.nome}`,
    );
  }
  if (nomesLojasSelecionadas.length === 1) {
    partesRecorte.push(`Loja ${nomesLojasSelecionadas[0]}`);
  } else if (nomesLojasSelecionadas.length > 1) {
    partesRecorte.push(`${nomesLojasSelecionadas.length} lojas (${nomesLojasSelecionadas.join(", ")})`);
  }

  const descricaoRecorte = partesRecorte.length > 0 ? partesRecorte.join(" × ") : "Toda a empresa × Todas as lojas";

  async function aoExportar(formato: "excel" | "pdf") {
    setExportando(formato);
    try {
      const dados = { descricaoRecorte, nivelEstrutura: estruturaNivel, ...resultado };
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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-zinc-900">Desempenho Comercial</h1>
          <p className="mt-0.5 text-sm text-zinc-500">Vendas, margem e desvio por categoria e loja.</p>
        </div>
        <div className="flex items-center gap-2">
          <CadastroIncompletoBadge quantidade={produtosDescartados} />
          <button
            type="button"
            disabled={exportando !== null}
            onClick={() => aoExportar("excel")}
            className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
          >
            {exportando === "excel" ? "Exportando…" : "Exportar Excel"}
          </button>
          <button
            type="button"
            disabled={exportando !== null}
            onClick={() => aoExportar("pdf")}
            className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
          >
            {exportando === "pdf" ? "Exportando…" : "Exportar PDF"}
          </button>
        </div>
      </div>

      <FilterBar lojas={lojas} compradores={compradores} filtros={filtros} onChange={setFiltros} />

      <KpiCards atual={resultado.kpiAtual} comparacao={resultado.kpiComparacao} />

      <StatusBar
        descricaoRecorte={descricaoRecorte}
        temSelecao={partesRecorte.length > 0}
        onLimpar={aoLimparSelecao}
      />

      <div
        className={`grid grid-cols-1 gap-4 lg:grid-cols-2 transition-opacity ${carregando ? "opacity-60" : ""}`}
      >
        <EstruturaPanel
          nivel={estruturaNivel}
          linhas={resultado.linhasEstrutura}
          departamentoAtivo={departamentoAtivo}
          selecionado={estruturaSelecionada}
          modoRanking={modoRanking}
          onToggleModo={() => setModoRanking((m) => !m)}
          onClickLinha={aoClicarEstrutura}
          onVoltar={aoVoltarDepartamentos}
        />
        <LojasPanel linhas={resultado.linhasLojas} selecionadas={lojasSelecionadas} onClickLinha={aoClicarLoja} />
      </div>

      <div className={`transition-opacity ${carregando ? "opacity-60" : ""}`}>
        <TopAltasQuedas nivel={nivelTopAltasQuedas} onNivelChange={setNivelTopAltasQuedas} linhas={resultado.linhasTop} />
      </div>
    </div>
  );
}
