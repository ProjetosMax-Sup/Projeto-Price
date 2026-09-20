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
