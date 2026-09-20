/**
 * Cadastro de Lojas e Departamentos (docs/parametros.md, seções 2.2 e 2.3) —
 * substitui bdLojas.txt e as tabelas fixas compradores.ts/departamentos.ts
 * como fonte editável pela própria plataforma.
 */

export interface LojaCadastro {
  codigo: string;
  nomeCustomizado: string;
  formato: string;
}

export interface DepartamentoCadastro {
  codigo: string;
  nome: string;
  mesmoCompradorTodosFormatos: boolean;
  comprador: string;
  compradorPorFormato: Record<string, string>;
}

/**
 * Seção 2.4 — chave é o usuário (username, mesmo da conta Clerk; sem e-mail —
 * contas são criadas manualmente pelo Gestor no painel do Clerk, ninguém se
 * cadastra sozinho).
 */
export interface UsuarioCadastro {
  usuario: string;
  nome: string;
  perfil: "Comprador" | "Gestor";
  /** Só relevante/obrigatório (≥1) quando perfil = Comprador. */
  departamentos: string[];
  /** Só relevante/obrigatório (≥1) quando perfil = Comprador. */
  lojas: string[];
}

/**
 * Dicionário de Colunas Nativas (seção 2.1) — catálogo documental de todas as
 * colunas do arquivo mensal (bd<Mês>.txt), auto-importado do cabeçalho real
 * (config/data-sources.ts > CABECALHO_REFERENCIA_MENSAL). Puramente
 * informativo: não decide o que aparece num relatório (isso é ColunaRelatorio,
 * seção 3.1) — só documenta nome/tradução/tipo de cada coluna existente.
 */
export interface ColunaNativa {
  /** Posição no arquivo (string p/ servir de chave estável em refs). */
  ref: string;
  posicao: number;
  /** Nome bruto combinado (as duas linhas do cabeçalho). */
  nomeArquivo: string;
  /** A que movimento se aplica (ex.: "Vendas", "Compras", "Estoque") — editável, texto livre. */
  movimento: string;
  /** Tradução/significado amigável — editável. */
  traducao: string;
  tipoDado: "Texto" | "Número" | "Data";
  /** SKU/Código Unidade/Data — nunca aparecem como coluna selecionável num relatório (seção 3.1). */
  chaveAutomatica: boolean;
}

export type SinalTermo = "+" | "-";

/** Um termo de fórmula: um sinal + uma coluna (nativa ou calculada) já existente no relatório. */
export interface TermoFormula {
  sinal: SinalTermo;
  colunaRef: string;
}

export type ColunaCalculada =
  | { id: string; nome: string; tipo: "soma"; termos: TermoFormula[]; oculta: boolean }
  | { id: string; nome: string; tipo: "razao"; numerador: TermoFormula[]; denominador: TermoFormula[]; oculta: boolean };

/**
 * Configuração "Por Relatório" (seção 3) — uma por módulo (slug), 100%
 * independente das demais mesmo quando duas colunas calculadas de módulos
 * diferentes têm o mesmo nome.
 */
export interface ConfigRelatorio {
  modulo: string;
  /** Refs de ColunaNativa marcadas como visíveis (checklist da aba Nativas). */
  nativasVisiveis: string[];
  calculadas: ColunaCalculada[];
  /** Ordem final de exibição (refs de nativa ou id de calculada) — só a aba Ativas decide isso. */
  ordemAtivas: string[];
  /** "Quem acessa este relatório" (seção 3.3) — condição 1 das duas que precisam valer juntas. */
  acessoComprador: boolean;
  acessoGestor: boolean;
  status: "Rascunho" | "Publicado";
}
