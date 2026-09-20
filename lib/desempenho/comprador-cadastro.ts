import type { DepartamentoCadastro } from "@/lib/parametros/types";
import type { RegistroDesempenho } from "@/lib/types";

/**
 * Resolução de Comprador/Departamento a partir do cadastro editável em
 * Parâmetros (docs/parametros.md, seção 2.3) — substitui as tabelas fixas
 * compradores.ts/departamentos.ts na computação real do Desempenho
 * Comercial (só elas continuam sendo usadas pra SEMEAR o cadastro na
 * primeira vez, ver lib/parametros/seed.ts).
 *
 * Índice construído 1x por requisição (não por registro) — mesmo custo O(1)
 * por linha que a tabela estática de antes, então não pesa em nada a mais
 * mesmo nos milhões de registros do pool.
 */
export type IndiceDepartamentos = Map<string, DepartamentoCadastro>;

export function construirIndiceDepartamentos(departamentos: DepartamentoCadastro[]): IndiceDepartamentos {
  return new Map(departamentos.map((d) => [d.codigo, d]));
}

const SEM_COMPRADOR = "Sem comprador";

export function nomeCompradorPorDptoCadastro(indice: IndiceDepartamentos, dpto: string, formato: string): string {
  const departamento = indice.get(dpto);
  if (!departamento) return SEM_COMPRADOR;
  if (departamento.mesmoCompradorTodosFormatos) return departamento.comprador || SEM_COMPRADOR;
  return departamento.compradorPorFormato[formato] || SEM_COMPRADOR;
}

export function nomeCompradorDoRegistroCadastro(registro: RegistroDesempenho, indice: IndiceDepartamentos): string | null {
  if (!registro.produto || !registro.loja) return null;
  return nomeCompradorPorDptoCadastro(indice, registro.produto.dpto, registro.loja.formato);
}

export function listaCompradoresCadastro(departamentos: DepartamentoCadastro[]): string[] {
  const nomes = new Set<string>();
  for (const d of departamentos) {
    if (d.mesmoCompradorTodosFormatos) {
      if (d.comprador) nomes.add(d.comprador);
    } else {
      for (const nome of Object.values(d.compradorPorFormato)) if (nome) nomes.add(nome);
    }
  }
  return Array.from(nomes).sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export function listaDepartamentosCadastro(departamentos: DepartamentoCadastro[]): { value: string; label: string }[] {
  return departamentos
    .slice()
    .sort((a, b) => a.codigo.localeCompare(b.codigo))
    .map((d) => ({ value: d.codigo, label: `${d.codigo} - ${d.nome}` }));
}
