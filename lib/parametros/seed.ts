import { getDataProvider } from "@/lib/data-providers";
import { compradorPorDptoAtual } from "@/lib/desempenho/compradores";
import { entradasDepartamentos } from "@/lib/desempenho/departamentos";
import type { DepartamentoCadastro, LojaCadastro, UsuarioCadastro } from "@/lib/parametros/types";

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

/**
 * Ponto de partida do cadastro de Usuários: o dono da conta, já como Gestor
 * (acesso total, sem precisar preencher Departamentos/Lojas) — assim o login
 * via Clerk já nasce funcional assim que a conta Clerk usar o mesmo username.
 */
export function semearUsuariosCadastro(): UsuarioCadastro[] {
  return [
    {
      usuario: "gabrieldivino",
      nome: "Gabriel Divino",
      perfil: "Gestor",
      departamentos: [],
      lojas: [],
    },
  ];
}
