import { obterUsuarioAtual } from "@/lib/auth/usuario-atual";
import type { UsuarioCadastro } from "@/lib/parametros/types";

/**
 * `/parametros` e tudo em `/api/parametros/*` são só pra Gestor (config do
 * sistema inteiro, inclusive gestão de contas — nunca um Comprador). `null`
 * quando não logado ou logado mas não é Gestor.
 */
export async function obterGestorAtual(): Promise<UsuarioCadastro | null> {
  const usuario = await obterUsuarioAtual();
  return usuario?.perfil === "Gestor" ? usuario : null;
}
