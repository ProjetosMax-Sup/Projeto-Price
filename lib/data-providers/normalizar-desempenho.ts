import { CABECALHO_REFERENCIA_MENSAL, REFS_NATIVOS_ENTRADAS_SAIDAS } from "@/config/data-sources";
import { parseTabela, validarCabecalhoOuFalhar } from "./parse-tabela";
import type { Loja, MovimentoVendas, PeriodoDesempenho, Produto } from "@/lib/types";

/** Números do arquivo usam vírgula decimal (padrão BR). */
function parseNumeroBr(valor: string | undefined): number {
  if (!valor) return 0;
  const normalizado = valor.replace(/\./g, "").replace(",", ".");
  const numero = Number(normalizado);
  return Number.isFinite(numero) ? numero : 0;
}

/** Hierarquia mercadológica incompleta (ex: cai em "Verificar Dpto") — ver regra de negócio no CLAUDE.md. */
function isCadastroIncompleto(hierarquiaGrupos: string): boolean {
  const niveis = hierarquiaGrupos.split(",").map((n) => n.trim()).filter(Boolean);
  return niveis.length < 5 || hierarquiaGrupos.toLowerCase().includes("verificar");
}

const CAMPOS_LOJA = ["Cód Unid", "Cód Unid Reduzido", "Nome Sistema", "Nome Loja", "Formato"] as const;

export function normalizarLojas(conteudo: string): Loja[] {
  const linhas = parseTabela(conteudo, CAMPOS_LOJA, false);
  return linhas.map((l) => ({
    codUnid: l["Cód Unid"],
    codUnidReduzido: l["Cód Unid Reduzido"],
    nomeSistema: l["Nome Sistema"],
    nomeLoja: l["Nome Loja"],
    formato: l["Formato"] === "Atacado" ? "Atacado" : "Varejo",
    dataAbertura: null,
  }));
}

const CAMPOS_PRODUTO = ["Código", "Dpto", "Grupo", "Nome Grupo", "Hierarquia de Grupos", "Compr", "Nome Comprador"] as const;

export function normalizarProdutos(conteudo: string): Produto[] {
  const linhas = parseTabela(conteudo, CAMPOS_PRODUTO, true);
  return linhas.map((l) => {
    const hierarquiaGrupos = l["Hierarquia de Grupos"];
    return {
      codigo: l["Código"],
      dpto: l["Dpto"],
      grupo: l["Grupo"],
      nomeGrupo: l["Nome Grupo"],
      hierarquiaGrupos,
      comprador: l["Compr"],
      nomeComprador: l["Nome Comprador"],
      cadastroIncompleto: isCadastroIncompleto(hierarquiaGrupos),
    };
  });
}

// "Descricao" sem acento. Cada um destes nomes combinados (linha1+linha2) é único
// entre as 83 colunas do arquivo mensal (bd<Mês>.txt) — confirmado campo a campo
// contra os arquivos reais (ver docs/parametros.md seção 1) — então a extração por
// nome (parseTabela) continua funcionando sem precisar de posição fixa.
//
// REFS_NATIVOS_ENTRADAS_SAIDAS entrou aqui pra alimentar `movimento.nativos` (ver
// lib/types/index.ts) — são os campos que o Entradas e Saídas usa nas fórmulas de
// `lib/parametros/seed.ts`, e essa é a fonte única dos dois (config/data-sources.ts).
// Nunca peça um campo numa fórmula sem também listá-lo aqui, senão a coluna
// existe na config mas não tem dado de verdade.
const CAMPOS_MOVIMENTO = [
  "Código",
  "Descricao",
  "Complemento",
  "Marca",
  "Código Barras",
  "Unidade Código",
  "Unidade Nome",
  "Qtde Vendas",
  "Valor",
  "Lucros",
  "Qtde Vendas Oferta",
  "Vendas Oferta",
  "Lucros Oferta",
  "Data",
  ...REFS_NATIVOS_ENTRADAS_SAIDAS,
] as const;

function linhaParaMovimento(l: Record<(typeof CAMPOS_MOVIMENTO)[number], string>): MovimentoVendas {
  const qtdeVendasTotal = parseNumeroBr(l["Qtde Vendas"]);
  const valorTotal = parseNumeroBr(l["Valor"]);
  const lucrosTotal = parseNumeroBr(l["Lucros"]);
  const qtdeVendasOferta = parseNumeroBr(l["Qtde Vendas Oferta"]);
  const vendasOferta = parseNumeroBr(l["Vendas Oferta"]);
  const lucrosOferta = parseNumeroBr(l["Lucros Oferta"]);

  // Array, não objeto — ver o porquê no comentário de `MovimentoVendas.nativos`
  // (lib/types/index.ts). Posição = índice em REFS_NATIVOS_ENTRADAS_SAIDAS; ler
  // por nome com `valorNativo()` abaixo, nunca indexando na mão.
  const nativos = REFS_NATIVOS_ENTRADAS_SAIDAS.map((ref) => parseNumeroBr(l[ref]));

  return {
    codigo: l["Código"],
    descricao: l["Descricao"],
    complemento: l["Complemento"],
    marca: l["Marca"],
    codigoBarras: l["Código Barras"],
    unidadeCodigo: l["Unidade Código"],
    unidadeNome: l["Unidade Nome"],
    data: l["Data"],
    qtdeVendasTotal,
    valorTotal,
    lucrosTotal,
    qtdeVendasOferta,
    vendasOferta,
    lucrosOferta,
    // Regular = Total − Oferta (calculado, não vem do arquivo)
    qtdeVendasRegular: qtdeVendasTotal - qtdeVendasOferta,
    vendasRegular: valorTotal - vendasOferta,
    lucrosRegular: lucrosTotal - lucrosOferta,
    nativos,
  };
}

/**
 * Normaliza um arquivo mensal de movimento (`bd<Mês>.txt`) — valida o cabeçalho contra
 * a referência conhecida antes de confiar em qualquer coluna (nunca processa um
 * arquivo fora do padrão silenciosamente, ver `validarCabecalhoOuFalhar`).
 */
export function normalizarMovimentos(
  conteudo: string,
  produtosPorCodigo: Map<string, Produto>,
  lojasPorCodigo: Map<string, Loja>,
  nomeArquivo: string,
): PeriodoDesempenho {
  validarCabecalhoOuFalhar(conteudo, CABECALHO_REFERENCIA_MENSAL, nomeArquivo);
  const linhas = parseTabela(conteudo, CAMPOS_MOVIMENTO, true);
  // Conta produtos (SKU) únicos descartados, não linhas — o mesmo produto pode
  // aparecer em várias linhas (uma por loja/dia), o que inflava a contagem.
  const codigosDescartados = new Set<string>();

  const registros = linhas
    .map((l) => {
      const movimento = linhaParaMovimento(l);
      const produto = produtosPorCodigo.get(movimento.codigo) ?? null;
      const loja = movimento.unidadeCodigo ? (lojasPorCodigo.get(movimento.unidadeCodigo) ?? null) : null;
      return { movimento, produto, loja };
    })
    .filter(({ movimento, produto }) => {
      const descartar = (produto?.cadastroIncompleto ?? false) && movimento.qtdeVendasTotal > 0;
      if (descartar) codigosDescartados.add(movimento.codigo);
      return !descartar;
    });

  return {
    registros,
    produtosDescartados: codigosDescartados.size,
    produtosDescartadosCodigos: Array.from(codigosDescartados),
  };
}

// Construído uma vez (não por registro) — é o que permite ler `movimento.nativos`
// por NOME sem pagar o custo de um objeto por registro (ver MovimentoVendas.nativos).
const INDICE_NATIVOS = new Map<string, number>(REFS_NATIVOS_ENTRADAS_SAIDAS.map((ref, i) => [ref, i]));

/** Valor de um campo nativo adicional (Compras/Outras Entradas/Estoque/...) pelo
 * nome da coluna — `0` se o ref não existir na lista extraída ou o registro vier
 * do cache de produção (`nativos` ausente, ver dataset-cache.ts). */
export function valorNativo(movimento: MovimentoVendas, ref: string): number {
  const indice = INDICE_NATIVOS.get(ref);
  if (indice === undefined || !movimento.nativos) return 0;
  return movimento.nativos[indice] ?? 0;
}

/**
 * Junta o `PeriodoDesempenho` de cada arquivo mensal num só conjunto unificado
 * — usada por `file-provider.ts` e `onedrive-provider.ts` (mesma lógica nos
 * dois, só muda como cada um lê o arquivo). Descartados deduplicados por SKU
 * (Set): o mesmo produto com cadastro incompleto pode aparecer em vários meses.
 */
export function unirMovimentos(periodos: PeriodoDesempenho[]): PeriodoDesempenho {
  const codigosDescartados = new Set<string>();
  const registros = periodos.flatMap((p) => {
    for (const codigo of p.produtosDescartadosCodigos) codigosDescartados.add(codigo);
    return p.registros;
  });
  return {
    registros,
    produtosDescartados: codigosDescartados.size,
    produtosDescartadosCodigos: Array.from(codigosDescartados),
  };
}
