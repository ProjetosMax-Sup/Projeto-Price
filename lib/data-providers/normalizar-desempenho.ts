import { parseTabela } from "./parse-tabela";
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

// "Descricao" sem acento e sem "Unidade Código/Nome" em bdDesempenhoComercialAtual.txt
// (esse recorte não tem quebra por loja — ver aviso em CLAUDE.md). Campos ausentes no
// arquivo voltam como "" pelo parseTabela, então funciona para os dois arquivos.
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
] as const;

function linhaParaMovimento(l: Record<(typeof CAMPOS_MOVIMENTO)[number], string>): MovimentoVendas {
  const qtdeVendasTotal = parseNumeroBr(l["Qtde Vendas"]);
  const valorTotal = parseNumeroBr(l["Valor"]);
  const lucrosTotal = parseNumeroBr(l["Lucros"]);
  const qtdeVendasOferta = parseNumeroBr(l["Qtde Vendas Oferta"]);
  const vendasOferta = parseNumeroBr(l["Vendas Oferta"]);
  const lucrosOferta = parseNumeroBr(l["Lucros Oferta"]);

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
  };
}

export function normalizarPeriodo(
  conteudo: string,
  produtosPorCodigo: Map<string, Produto>,
  lojasPorCodigo: Map<string, Loja>,
): PeriodoDesempenho {
  const linhas = parseTabela(conteudo, CAMPOS_MOVIMENTO, true);
  let produtosDescartados = 0;
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
      if (descartar) {
        produtosDescartados += 1;
        codigosDescartados.add(movimento.codigo);
      }
      return !descartar;
    });

  return { registros, produtosDescartados, produtosDescartadosCodigos: Array.from(codigosDescartados) };
}
