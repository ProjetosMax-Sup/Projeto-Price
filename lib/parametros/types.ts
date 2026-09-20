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
