import {
  REF_ENTRADAS_COMPRAS,
  REF_ENTRADAS_SAIDAS_ESTOQUE,
  REF_ENTRADAS_SAIDAS_QTDE_VMD,
  REFS_ENTRADAS_OUTRAS,
  REFS_SAIDAS_OUTRAS,
} from "@/config/data-sources";
import { getDataProvider } from "@/lib/data-providers";
import { compradorPorDptoAtual } from "@/lib/desempenho/compradores";
import { entradasDepartamentos } from "@/lib/desempenho/departamentos";
import { novoIdCalculada, ordemAtivasEfetiva } from "@/lib/parametros/colunas-relatorio";
import type { ColunaCalculada, ConfigRelatorio, DepartamentoCadastro, LojaCadastro } from "@/lib/parametros/types";

/**
 * Ponto de partida editável do cadastro de Lojas/Departamentos, montado a
 * partir do que já existe hoje (bdLojas.txt e as tabelas fixas
 * compradores.ts/departamentos.ts) — só roda uma vez, na primeira vez que
 * /parametros carrega sem nenhum cadastro salvo (ver lib/parametros/store.ts).
 */

export async function semearLojasCadastro(): Promise<LojaCadastro[]> {
  const lojas = await getDataProvider().getLojas();
  return lojas.map((loja) => ({
    codigo: loja.codUnid,
    nomeCustomizado: loja.nomeLoja,
    formato: loja.formato,
  }));
}

/**
 * Refs do Dicionário de Colunas Nativas — o **nome** da coluna no arquivo mensal
 * (ver config/data-sources.ts > CABECALHO_REFERENCIA_MENSAL). O Desempenho
 * Comercial usa só os 4 campos numéricos que `normalizar-desempenho.ts` extrai
 * pra `MovimentoVendas`. "Qtde Vendas"/"Qtde Vendas Oferta" existem no
 * dicionário mas não alimentam nenhuma coluna visível hoje (Ticket Médio é
 * calculado mas nunca exibido em lugar nenhum da UI) — por isso ficam de fora.
 */
const REF_VALOR = "Valor";
const REF_LUCROS = "Lucros";
const REF_VENDAS_OFERTA = "Vendas Oferta";
const REF_LUCROS_OFERTA = "Lucros Oferta";

/**
 * Semente do `ConfigRelatorio` do Desempenho Comercial: reproduz **exatamente** as
 * 15 colunas da tabela, na mesma ordem. É contra esta config que
 * `/api/verificar-avaliador` confere, número a número, se o avaliador devolve o
 * mesmo que a definição antiga (`lib/desempenho/colunas-tabela.ts`, hoje só
 * oráculo de regressão).
 *
 * "Vendas Oferta"/"Lucros Oferta" alimentam fórmulas mas não são colunas da tela
 * — por isso ficam fora de `nativasVisiveis` (marcar ali é sobre exibir, não sobre
 * existir). "Vendas Regular"/"Lucros Regular" idem, como calculadas ocultas.
 */
export function semearColunasDesempenhoComercial(): ConfigRelatorio {
  const idVendaRegular = novoIdCalculada();
  const idLucroRegular = novoIdCalculada();
  const idPercLucro = novoIdCalculada();
  const idPercPartOferta = novoIdCalculada();
  const idPercLucroOferta = novoIdCalculada();
  const idPercLucroRegular = novoIdCalculada();

  const comparacao = (nome: string, coluna: string, formato: "moeda" | "percentual"): ColunaCalculada => ({
    id: novoIdCalculada(),
    nome,
    tipo: "valorDoPeriodo",
    coluna,
    periodo: "comparacao",
    formato,
    oculta: false,
  });

  const calculadas: ColunaCalculada[] = [
    // --- insumos, não aparecem como coluna ---
    {
      id: idVendaRegular,
      nome: "Vendas Regular",
      tipo: "soma",
      termos: [
        { sinal: "+", colunaRef: REF_VALOR },
        { sinal: "-", colunaRef: REF_VENDAS_OFERTA },
      ],
      formato: "moeda",
      oculta: true,
    },
    {
      id: idLucroRegular,
      nome: "Lucros Regular",
      tipo: "soma",
      termos: [
        { sinal: "+", colunaRef: REF_LUCROS },
        { sinal: "-", colunaRef: REF_LUCROS_OFERTA },
      ],
      formato: "moeda",
      oculta: true,
    },

    // --- percentuais do período Atual ---
    {
      id: idPercLucro,
      nome: "% Lucro Total Atual",
      tipo: "razao",
      numerador: [{ sinal: "+", colunaRef: REF_LUCROS }],
      denominador: [{ sinal: "+", colunaRef: REF_VALOR }],
      formato: "percentual",
      oculta: false,
    },
    {
      id: idPercPartOferta,
      nome: "% Part. Of Atual",
      tipo: "razao",
      numerador: [{ sinal: "+", colunaRef: REF_VENDAS_OFERTA }],
      denominador: [{ sinal: "+", colunaRef: REF_VALOR }],
      formato: "percentual",
      oculta: false,
    },
    {
      id: idPercLucroOferta,
      nome: "% Lucro Of Atual",
      tipo: "razao",
      numerador: [{ sinal: "+", colunaRef: REF_LUCROS_OFERTA }],
      denominador: [{ sinal: "+", colunaRef: REF_VENDAS_OFERTA }],
      formato: "percentual",
      oculta: false,
    },
    {
      id: idPercLucroRegular,
      nome: "% Lucro Regular Atual",
      tipo: "razao",
      numerador: [{ sinal: "+", colunaRef: idLucroRegular }],
      denominador: [{ sinal: "+", colunaRef: idVendaRegular }],
      formato: "percentual",
      oculta: false,
    },

    // --- mesmas colunas, período de Comparação ---
    comparacao("R$ Valor Total Comparação", REF_VALOR, "moeda"),
    comparacao("R$ Lucro Total Comparação", REF_LUCROS, "moeda"),
    comparacao("% Lucro Total Comparação", idPercLucro, "percentual"),
    comparacao("% Part. Of Comparação", idPercPartOferta, "percentual"),
    comparacao("% Lucro Of Comparação", idPercLucroOferta, "percentual"),
    comparacao("% Lucro Regular Comparação", idPercLucroRegular, "percentual"),

    // --- variações entre os dois períodos ---
    { id: novoIdCalculada(), nome: "% Desv. Valor", tipo: "desvio", coluna: REF_VALOR, oculta: false },
    { id: novoIdCalculada(), nome: "% Desv. Lucro", tipo: "desvio", coluna: REF_LUCROS, oculta: false },
    { id: novoIdCalculada(), nome: "P.P Desv. Lucro", tipo: "difPP", coluna: idPercLucro, oculta: false },
  ];

  const porNome = (nome: string) => calculadas.find((c) => c.nome === nome)!.id;

  const config: ConfigRelatorio = {
    modulo: "desempenho-comercial",
    nativasVisiveis: [REF_VALOR, REF_LUCROS],
    // O Dicionário chama de "Valor"/"Lucros" (é como o ERP nomeia no arquivo); aqui
    // elas são o período Atual, e o nome precisa deixar isso claro ao lado das
    // colunas de Comparação.
    rotulos: {
      [REF_VALOR]: "R$ Valor Total Atual",
      [REF_LUCROS]: "R$ Lucros Total Atual",
    },
    calculadas,
    // Mesma ordem de COLUNAS_METRICAS — irregular de propósito (as 6 primeiras
    // agrupam por variante; da 7ª em diante, por coluna base).
    ordemAtivas: [
      REF_VALOR,
      REF_LUCROS,
      porNome("R$ Valor Total Comparação"),
      porNome("R$ Lucro Total Comparação"),
      porNome("% Desv. Valor"),
      porNome("% Desv. Lucro"),
      idPercLucro,
      porNome("% Lucro Total Comparação"),
      porNome("P.P Desv. Lucro"),
      idPercPartOferta,
      porNome("% Part. Of Comparação"),
      idPercLucroOferta,
      porNome("% Lucro Of Comparação"),
      idPercLucroRegular,
      porNome("% Lucro Regular Comparação"),
    ],
    // Venda é o número que manda neste relatório: é o KPI do topo, o eixo do Top
    // Altas/Quedas e a ordenação padrão das tabelas.
    papeis: { principal: REF_VALOR },
    acessoComprador: true,
    acessoGestor: true,
    status: "Publicado",
  };
  return { ...config, ordemAtivas: ordemAtivasEfetiva(config) };
}

/**
 * Refs (nome de coluna, ver CABECALHO_REFERENCIA_MENSAL) usadas pelo Entradas e
 * Saídas — desenhado a partir da planilha de referência do time ("02. Entradas
 * e Saídas.xlsx", aba "Entradas x Saídas": Compras, Outras Entradas, Entradas
 * Totais, Vendas, Outras Saídas, Saídas Totais, Saldo, Estoque, Qtde VMD, DDE
 * — por Departamento, mesmo eixo de drill-down do Desempenho Comercial).
 *
 * Os refs em si vêm de `config/data-sources.ts` (fonte única, compartilhada
 * com o parser dedicado que os extrai — ver
 * `lib/data-providers/normalizar-entradas-saidas.ts`, ainda não plugado em
 * nenhuma rota/cache; parser separado do Desempenho Comercial de propósito,
 * ver comentário no topo daquele arquivo).
 */
const REF_COMPRAS = REF_ENTRADAS_COMPRAS;
const REFS_OUTRAS_ENTRADAS = REFS_ENTRADAS_OUTRAS;
const REF_VENDAS = "Valor";
const REFS_OUTRAS_SAIDAS = REFS_SAIDAS_OUTRAS;
const REF_QTDE_VMD = REF_ENTRADAS_SAIDAS_QTDE_VMD;
const REF_ESTOQUE = REF_ENTRADAS_SAIDAS_ESTOQUE;

/** Soma de refs via fórmula de texto — `[ref1] + [ref2] + ...`. */
const somaRefs = (refs: readonly string[]) => refs.map((ref) => `[${ref}]`).join(" + ");

export function semearColunasEntradasSaidas(): ConfigRelatorio {
  const idOutrasEntradas = novoIdCalculada();
  const idOutrasSaidas = novoIdCalculada();
  const idEntradasTotais = novoIdCalculada();
  const idSaidasTotais = novoIdCalculada();

  const idSaldo = novoIdCalculada();

  // Nome da calculada nunca repete o de uma nativa: existe a coluna "Outras Entradas"
  // no arquivo (uma linha específica) e existe a soma de todas as entradas que não são
  // compra — são coisas diferentes, e ver as duas com o mesmo nome no dropdown confunde.
  const calculadas: ColunaCalculada[] = [
    {
      id: idOutrasEntradas,
      nome: "(+) Outras Entradas",
      tipo: "formula",
      expressao: somaRefs(REFS_OUTRAS_ENTRADAS),
      oculta: false,
    },
    {
      id: idEntradasTotais,
      nome: "(+) Entradas Totais",
      tipo: "formula",
      expressao: `[${REF_COMPRAS}] + [(+) Outras Entradas]`,
      oculta: false,
    },
    {
      id: idOutrasSaidas,
      nome: "(-) Outras Saídas",
      tipo: "formula",
      expressao: somaRefs(REFS_OUTRAS_SAIDAS),
      oculta: false,
    },
    {
      id: idSaidasTotais,
      nome: "(-) Saídas Totais",
      tipo: "formula",
      expressao: `[${REF_VENDAS}] + [(-) Outras Saídas]`,
      oculta: false,
    },
    {
      id: idSaldo,
      nome: "(=) Entradas Totais - Saídas Totais",
      tipo: "formula",
      expressao: `[(+) Entradas Totais] - [(-) Saídas Totais]`,
      oculta: false,
    },
    {
      id: novoIdCalculada(),
      nome: "DDE (Dias de Estoque)",
      tipo: "formula",
      // Sem isso, cairia no padrão "moeda" de `formatoDaCalculada` — DDE é dias de
      // estoque, um número puro, não dinheiro. Divisão por zero aqui já dá 0 (regra
      // do próprio `avaliarFormula`), equivalente à regra antiga de razão.
      formato: "numero",
      expressao: `[${REF_ESTOQUE}] / [${REF_QTDE_VMD}]`,
      oculta: false,
    },
  ];

  const config: ConfigRelatorio = {
    modulo: "entradas-saidas",
    nativasVisiveis: [REF_COMPRAS, REF_VENDAS, REF_ESTOQUE, REF_QTDE_VMD],
    // Nomes da planilha de referência do time — a mesma coluna "Valor" que no
    // Desempenho Comercial é "R$ Valor Total Atual" aqui é a saída por venda.
    rotulos: {
      [REF_COMPRAS]: "(+) Compras",
      [REF_VENDAS]: "(-) Vendas",
      [REF_ESTOQUE]: "Estoque",
      [REF_QTDE_VMD]: "Qtde VMD",
    },
    calculadas,
    ordemAtivas: [],
    // O número que este relatório existe pra responder: sobrou ou faltou estoque no
    // período (é a coluna de destaque da planilha de referência do time).
    papeis: { principal: idSaldo },
    destaquesKpi: [idEntradasTotais, idSaidasTotais, idSaldo],
    acessoComprador: true,
    acessoGestor: true,
    status: "Rascunho",
  };
  return { ...config, ordemAtivas: ordemAtivasEfetiva(config) };
}

/**
 * Compra e Venda (decisão de 2026-09-30, a partir da planilha de referência do
 * time): mesmos dois refs nativos que o Entradas e Saídas já usa (Compras,
 * Valor) — reaproveita o MESMO pipeline de parser/redução por arquivo
 * (`lib/entradas-saidas/aggregate.ts`), só com agregação própria (por
 * Departamento, filtrada por Formato — ver `lib/compra-venda/aggregate.ts`).
 * "Meta" é ref sintético (não vem do arquivo): injetado na agregação a partir
 * de `ConfigRelatorio.metas`, cadastrado na aba Metas de /parametros.
 */
const REF_META = "Meta";

export function semearColunasCompraVenda(): ConfigRelatorio {
  const idPercCompraVenda = novoIdCalculada();
  const idMeta = novoIdCalculada();
  const idMargem = novoIdCalculada();
  const idMetaRealizado = novoIdCalculada();
  const idGapReais = novoIdCalculada();

  const calculadas: ColunaCalculada[] = [
    {
      id: idPercCompraVenda,
      nome: "% Compra/Venda",
      tipo: "formula",
      // "* 100" explícito — fórmula de texto não multiplica automaticamente pra
      // percentual como "razao" fazia; aqui quem decide é a própria expressão.
      expressao: `[${REF_COMPRAS}] / [${REF_VENDAS}] * 100`,
      formato: "percentual",
      oculta: false,
    },
    // Meta em si, como coluna visível ao lado de "% Compra/Venda" — sem isso só dava
    // pra ver o resultado dela dentro de "Meta - Realizado", nunca o valor cadastrado.
    // "valorDoPeriodo" (período "atual") é só um jeito de expor o ref sintético "Meta"
    // como coluna própria, com o formato certo (percentual) — não lê nada do arquivo,
    // não é aritmética pura, por isso continua fora do formato de fórmula de texto.
    {
      id: idMeta,
      nome: "Meta",
      tipo: "valorDoPeriodo",
      coluna: REF_META,
      periodo: "atual",
      formato: "percentual",
      oculta: false,
    },
    {
      id: idMargem,
      nome: "% Margem",
      tipo: "formula",
      expressao: `([${REF_VENDAS}] - [${REF_COMPRAS}]) / [${REF_VENDAS}] * 100`,
      formato: "percentual",
      oculta: false,
    },
    {
      id: idMetaRealizado,
      nome: "Meta - Realizado",
      tipo: "formula",
      expressao: `[Meta] - [% Compra/Venda]`,
      formato: "pontosPercentuais",
      heatmap: true,
      oculta: false,
    },
    // GAP R$ — mesmo conceito do PDF por Comprador (Compra − Meta% × Venda, ver
    // CLAUDE.md > "PDF por Comprador"), agora também como coluna ao vivo na tela.
    // "Meta" aqui já está na escala 0–100 (79 = 79%, ver ConfigRelatorio.metas),
    // por isso o "/ 100" explícito — diferente de `lib/compra-venda/priorizacao.ts`
    // (motor exclusivo do PDF), que trabalha com fração 0–1 internamente.
    {
      id: idGapReais,
      nome: "GAP R$",
      tipo: "formula",
      expressao: `[${REF_COMPRAS}] - [Meta] / 100 * [${REF_VENDAS}]`,
      formato: "moeda",
      oculta: false,
    },
  ];

  const config: ConfigRelatorio = {
    modulo: "compra-venda",
    nativasVisiveis: [REF_COMPRAS, REF_VENDAS],
    rotulos: {
      [REF_COMPRAS]: "Compra",
      [REF_VENDAS]: "Venda",
      [REF_META]: "Meta",
    },
    calculadas,
    ordemAtivas: [],
    papeis: { principal: REF_VENDAS },
    destaquesKpi: [REF_COMPRAS, REF_VENDAS, idPercCompraVenda],
    acessoComprador: true,
    acessoGestor: true,
    status: "Rascunho",
  };
  return { ...config, ordemAtivas: ordemAtivasEfetiva(config) };
}

export function semearDepartamentosCadastro(): DepartamentoCadastro[] {
  return entradasDepartamentos().map(({ codigo, nome }) => {
    const comprador = compradorPorDptoAtual(codigo);
    const mesmoCompradorTodosFormatos = !comprador || comprador.varejo === comprador.atacado;
    return {
      codigo,
      nome,
      mesmoCompradorTodosFormatos,
      comprador: mesmoCompradorTodosFormatos ? (comprador?.varejo ?? "") : "",
      compradorPorFormato: mesmoCompradorTodosFormatos
        ? {}
        : ({ Varejo: comprador?.varejo ?? "", Atacado: comprador?.atacado ?? "" } as Record<string, string>),
    };
  });
}
