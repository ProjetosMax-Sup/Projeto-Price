// Tipos do módulo Desempenho Comercial (ver CLAUDE.md > Colunas confirmadas)

export type Formato = "Varejo" | "Atacado";

export interface Loja {
  codUnid: string;
  codUnidReduzido: string;
  nomeSistema: string;
  nomeLoja: string;
  formato: Formato;
}

export interface Produto {
  codigo: string; // SKU
  dpto: string; // código do departamento, 3 dígitos
  grupo: string; // código do Sub Grupo
  nomeGrupo: string;
  /** Níveis separados por vírgula: "Departamento, Seção, Categoria, Grupo, Sub Grupo". Nem sempre tem os 5 níveis. */
  hierarquiaGrupos: string;
  comprador: string;
  nomeComprador: string;
  /** true quando a hierarquia está incompleta (ex: "Verificar Dpto") */
  cadastroIncompleto: boolean;
}

export interface MovimentoVendas {
  codigo: string; // SKU, join com Produto.codigo
  descricao: string;
  complemento: string;
  marca: string;
  codigoBarras: string;
  unidadeCodigo: string; // join com Loja.codUnid
  unidadeNome: string;
  /** "DD/MM/AA" — presente nos dois arquivos de movimento (Atual e Comparação), grão diário. */
  data: string;

  qtdeVendasTotal: number;
  valorTotal: number;
  lucrosTotal: number;

  qtdeVendasOferta: number;
  vendasOferta: number;
  lucrosOferta: number;

  // Calculado: Total − Oferta (não vem do arquivo)
  qtdeVendasRegular: number;
  vendasRegular: number;
  lucrosRegular: number;
}

export interface RegistroDesempenho {
  movimento: MovimentoVendas;
  produto: Produto | null; // null quando não há match no cadastro
  loja: Loja | null; // null quando não há match em bdLojas
}

export interface PeriodoDesempenho {
  registros: RegistroDesempenho[];
  produtosDescartados: number; // cadastro incompleto + movimentação > 0 (ver regra de negócio)
  produtosDescartadosCodigos: string[]; // códigos (SKU) únicos dos produtos descartados
}
