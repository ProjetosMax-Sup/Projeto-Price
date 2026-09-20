import { currentUser } from "@clerk/nextjs/server";
import { lerUsuariosCadastro } from "@/lib/parametros/store";
import type { UsuarioCadastro } from "@/lib/parametros/types";

/**
 * Identidade do usuário logado (Clerk) cruzada com o cadastro de Usuários e
 * Acesso (docs/parametros.md, seção 2.4). `null` quando: ninguém logado, ou
 * logou no Clerk mas nenhum Gestor cadastrou esse usuário ainda — os dois
 * casos tratados como "sem acesso", nunca um acesso implícito.
 */
export async function obterUsuarioAtual(): Promise<UsuarioCadastro | null> {
  const usuarioClerk = await currentUser();
  const username = usuarioClerk?.username;
  if (!username) return null;

  const usuarios = await lerUsuariosCadastro();
  return usuarios?.find((u) => u.usuario.toLowerCase() === username.toLowerCase()) ?? null;
}
