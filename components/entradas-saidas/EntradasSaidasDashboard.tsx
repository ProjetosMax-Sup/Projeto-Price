"use client";

import { useEffect, useRef, useState } from "react";
import { HierarquiaPanel } from "@/components/entradas-saidas/HierarquiaPanel";
import { KpiCardsEntradasSaidas } from "@/components/entradas-saidas/KpiCardsEntradasSaidas";
import type { ColunaRenderizavel } from "@/lib/desempenho/colunas-configuradas";
import type { NoEntradasSaidas } from "@/lib/entradas-saidas/aggregate";
import type { ConsultaEntradasSaidas, NoSelecionadoES, ResultadoEntradasSaidas } from "@/lib/entradas-saidas/consulta";
import { avaliarColunas } from "@/lib/parametros/avaliador";
import type { ConfigRelatorio } from "@/lib/parametros/types";
import type { NivelHierarquia } from "@/lib/desempenho/aggregate";

const ALTURA_NAV = 52;

async function buscarResultado(
  consulta: ConsultaEntradasSaidas & { mes: string | null },
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
 * e Comprador→Departamento→... (raiz), sem tabela de Loja. Período é um mês
 * só por vez — os arquivos `bd<Mês>.txt` não carregam ano, então o seletor
 * aqui também não (mesma limitação que já existia no nome dos arquivos).
 */
export function EntradasSaidasDashboard({
  config,
  colunas,
  resultadoInicial,
  mesPadrao,
  mesesDisponiveisInicial,
}: {
  config: ConfigRelatorio;
  colunas: ColunaRenderizavel[];
  resultadoInicial: ResultadoEntradasSaidas;
  mesPadrao: string | null;
  mesesDisponiveisInicial: string[];
}) {
  const [mes, setMes] = useState<string | null>(mesPadrao);
  const [caminhoDepartamento, setCaminhoDepartamento] = useState<NoSelecionadoES[]>([]);
  const [compradorSelecionado, setCompradorSelecionado] = useState<string | null>(null);
  const [caminhoDentroComprador, setCaminhoDentroComprador] = useState<NoSelecionadoES[]>([]);
  const [resultado, setResultado] = useState<ResultadoEntradasSaidas>(resultadoInicial);
  const [carregando, setCarregando] = useState(false);
  const primeiraRenderizacao = useRef(true);
  const idRequisicaoRef = useRef(0);

  useEffect(() => {
    if (primeiraRenderizacao.current) {
      primeiraRenderizacao.current = false;
      return;
    }
    const idDaRequisicao = ++idRequisicaoRef.current;
    const controller = new AbortController();
    setCarregando(true);
    const consulta: ConsultaEntradasSaidas & { mes: string | null } = {
      mes,
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
  }, [mes, caminhoDepartamento, compradorSelecionado, caminhoDentroComprador]);

  function aoClicarDepartamento(linha: NoEntradasSaidas) {
    if (linha.nivel === "produto") return;
    setCaminhoDepartamento((atual) => [...atual, { nivel: linha.nivel as NivelHierarquia, chave: linha.chave, nome: linha.nome }]);
  }

  function aoClicarComprador(linha: NoEntradasSaidas) {
    if (linha.nivel === "comprador") {
      setCompradorSelecionado(linha.nome);
      setCaminhoDentroComprador([]);
      return;
    }
    if (linha.nivel === "produto") return;
    setCaminhoDentroComprador((atual) => [...atual, { nivel: linha.nivel as NivelHierarquia, chave: linha.chave, nome: linha.nome }]);
  }

  function aoVoltarDepartamento(indice: number) {
    setCaminhoDepartamento((atual) => atual.slice(0, indice + 1));
  }

  function aoVoltarComprador(indice: number) {
    // -1 com a trilha dentro do comprador já vazia volta pra lista de Compradores
    // (o título "Comprador" clicado no topo do próprio nível de comprador).
    if (indice === -1 && caminhoDentroComprador.length === 0) {
      setCompradorSelecionado(null);
      return;
    }
    setCaminhoDentroComprador((atual) => atual.slice(0, indice + 1));
  }

  const kpiAvaliado = avaliarColunas(config, { atual: resultado.kpi, comparacao: null });

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

      <div
        className="sticky z-30 -mx-6 flex flex-col gap-4 border-b border-zinc-200 bg-zinc-50 px-6 pb-3 pt-3"
        style={{ top: ALTURA_NAV }}
      >
        <KpiCardsEntradasSaidas kpi={kpiAvaliado} config={config} colunas={colunas} />
      </div>

      <div className={`flex flex-col gap-4 transition-opacity ${carregando ? "pointer-events-none opacity-60" : ""}`}>
        <HierarquiaPanel
          titulo="Departamento"
          linhas={resultado.linhasDepartamento}
          breadcrumb={breadcrumbDepartamento}
          config={config}
          colunas={colunas}
          onClickLinha={aoClicarDepartamento}
          onVoltarPara={aoVoltarDepartamento}
          stickyTop={ALTURA_NAV + 88}
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
          stickyTop={ALTURA_NAV + 88}
          ordenacaoPadrao="principal"
        />
      </div>
    </div>
  );
}
