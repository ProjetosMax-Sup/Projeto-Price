import { NextResponse } from "next/server";
import { getDataProvider } from "@/lib/data-providers";
import { construirIndiceDepartamentos } from "@/lib/desempenho/comprador-cadastro";
import { CONSULTA_PADRAO, computarDesempenho } from "@/lib/desempenho/consulta";
import { datasDisponiveis, periodoMesAnteriorDisponivel, periodoMesMaisRecente } from "@/lib/desempenho/datas";
import { lojasDoCadastro } from "@/lib/desempenho/loja-cadastro";
import { COLUNAS_METRICAS, valorColunaMetrica, type ColunaMetrica } from "@/lib/desempenho/colunas-tabela";
import type { Metricas } from "@/lib/desempenho/aggregate";
import { avaliarColunas, type ValoresNativos } from "@/lib/parametros/avaliador";
import { obterOuSemearConfigRelatorio, obterOuSemearDepartamentosCadastro, obterOuSemearLojasCadastro } from "@/lib/parametros/store";
import type { ConfigRelatorio } from "@/lib/parametros/types";

/**
 * Harness de verificação (só desenvolvimento): calcula as colunas do Desempenho
 * Comercial das DUAS formas — a lógica hardcoded de hoje (`colunas-tabela.ts`) e o
 * avaliador lendo a config de Parâmetros — e compara número a número, sobre os
 * dados reais da pasta local.
 *
 * Existe pra que a troca da renderização seja feita com prova, não com esperança.
 * Pode ser apagado depois que a migração estiver concluída e estável.
 */

/** As métricas agregadas já SÃO a soma das nativas — é só renomear pros refs do dicionário. */
function nativasDeMetricas(m: Metricas): ValoresNativos {
  return {
    Valor: m.venda,
    Lucros: m.lucro,
    "Vendas Oferta": m.vendaOferta,
    "Lucros Oferta": m.lucroOferta,
  };
}

/** Liga cada coluna hardcoded à calculada equivalente na config (casadas pelo nome). */
const EQUIVALENCIA: Record<ColunaMetrica, string> = {
  vAtual: "Valor",
  lAtual: "Lucros",
  vComp: "R$ Valor Total Comparação",
  lComp: "R$ Lucro Total Comparação",
  dVenda: "% Desv. Valor",
  dLucro: "% Desv. Lucro",
  percLucroAtual: "% Lucro Total Atual",
  percLucroComp: "% Lucro Total Comparação",
  ppDesvioLucro: "P.P Desv. Lucro",
  percPartOfAtual: "% Part. Of Atual",
  percPartOfComp: "% Part. Of Comparação",
  percLucroOfAtual: "% Lucro Of Atual",
  percLucroOfComp: "% Lucro Of Comparação",
  percLucroRegularAtual: "% Lucro Regular Atual",
  percLucroRegularComp: "% Lucro Regular Comparação",
};

function refDaColuna(chave: ColunaMetrica, config: ConfigRelatorio): string {
  const alvo = EQUIVALENCIA[chave];
  return config.calculadas.find((c) => c.nome === alvo)?.id ?? alvo;
}

/** Tolerância relativa — os dois caminhos fazem as mesmas contas em ordem diferente. */
function iguais(a: number | null, b: number | null): boolean {
  if (a === null || b === null) return a === b;
  const escala = Math.max(Math.abs(a), Math.abs(b), 1);
  return Math.abs(a - b) / escala < 1e-9;
}

export async function GET() {
  if (process.env.NODE_ENV === "production") return NextResponse.json({ erro: "Só em desenvolvimento." }, { status: 404 });

  const [config, lojasCadastro, departamentosCadastro, desempenho] = await Promise.all([
    obterOuSemearConfigRelatorio("desempenho-comercial"),
    obterOuSemearLojasCadastro(),
    obterOuSemearDepartamentosCadastro(),
    getDataProvider().getDesempenho(),
  ]);

  const datas = datasDisponiveis(desempenho.registros);
  const periodoAtual = periodoMesMaisRecente(datas);
  const periodoComparacao = periodoAtual ? periodoMesAnteriorDisponivel(datas, periodoAtual.inicio) : null;

  const resultado = computarDesempenho(
    desempenho.registros,
    lojasDoCadastro(lojasCadastro),
    { ...CONSULTA_PADRAO, periodoAtual, periodoComparacao },
    construirIndiceDepartamentos(departamentosCadastro),
  );

  const divergencias: { linha: string; coluna: string; hardcoded: number | null; avaliador: number | null }[] = [];
  let comparacoes = 0;
  let valoresNulos = 0;
  const amostra: { linha: string; coluna: string; hardcoded: number | null; avaliador: number | null }[] = [];

  const conferir = (rotuloLinha: string, atual: Metricas, comparacao: Metricas | null) => {
    const valores = avaliarColunas(config, {
      atual: nativasDeMetricas(atual),
      comparacao: comparacao ? nativasDeMetricas(comparacao) : null,
    });
    for (const coluna of COLUNAS_METRICAS) {
      const hardcoded = valorColunaMetrica(atual, comparacao, coluna.chave);
      const avaliador = valores[refDaColuna(coluna.chave, config)] ?? null;
      comparacoes++;
      if (hardcoded === null) valoresNulos++;
      if (amostra.length < COLUNAS_METRICAS.length) {
        amostra.push({ linha: rotuloLinha, coluna: coluna.rotulo, hardcoded, avaliador });
      }
      if (!iguais(hardcoded, avaliador)) {
        divergencias.push({ linha: rotuloLinha, coluna: coluna.rotulo, hardcoded, avaliador });
      }
    }
  };

  for (const linha of resultado.linhasEstrutura) conferir(`Estrutura: ${linha.nome}`, linha.atual, linha.comparacao);
  for (const linha of resultado.linhasLojas) conferir(`Loja: ${linha.loja.nomeLoja}`, linha.atual, linha.comparacao);
  conferir("KPI (total)", resultado.kpiAtual, resultado.kpiComparacao);

  return NextResponse.json({
    periodoAtual,
    periodoComparacao,
    linhasConferidas: resultado.linhasEstrutura.length + resultado.linhasLojas.length + 1,
    colunasPorLinha: COLUNAS_METRICAS.length,
    comparacoes,
    // Quantos valores são vazios dos dois lados — se fosse tudo vazio, "bater" não
    // provaria nada, então o número precisa ser baixo pra comparação ter valor.
    valoresVazios: valoresNulos,
    divergencias: divergencias.length,
    // Primeira linha inteira, lado a lado, pra conferir no olho que são números reais.
    amostraPrimeiraLinha: amostra,
    // Se algo estiver errado, o padrão aparece nas primeiras.
    amostraDivergencias: divergencias.slice(0, 20),
  });
}
