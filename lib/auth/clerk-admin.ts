import { clerkClient } from "@clerk/nextjs/server";
import { isClerkAPIResponseError } from "@clerk/shared/error";

/**
 * Gestão de contas Clerk direto da plataforma (criar, trocar senha,
 * ativar/desativar) — usa a Backend API do Clerk, nunca o painel deles.
 * Só quem chama isso já passou pelo checkpoint de Gestor (ver
 * lib/auth/exigir-gestor.ts) — estas funções não checam permissão de novo.
 */

// A mensagem "genérica" de erro HTTP (ex.: "Unprocessable Entity") não diz nada útil — o Clerk
// sempre manda o motivo real (senha fraca/vazada, username inválido etc.) em error.errors[].
// Rejogamos com essa mensagem detalhada pra aparecer certo na tela.
function comMensagemClerk(erro: unknown): Error {
  if (isClerkAPIResponseError(erro)) {
    const detalhe = erro.errors.map((e) => e.longMessage || e.message).join(" ");
    return new Error(detalhe || erro.message);
  }
  return erro instanceof Error ? erro : new Error(String(erro));
}

async function resolverIdPorUsuario(usuario: string): Promise<string> {
  const client = await clerkClient();
  const { data } = await client.users.getUserList({ username: [usuario] });
  const encontrado = data[0];
  if (!encontrado) throw new Error(`Usuário "${usuario}" não encontrado no Clerk.`);
  return encontrado.id;
}

export async function criarUsuarioClerk(dados: { usuario: string; nome: string; senha: string }): Promise<void> {
  const [firstName, ...resto] = dados.nome.trim().split(/\s+/);
  const client = await clerkClient();
  try {
    await client.users.createUser({
      username: dados.usuario,
      password: dados.senha,
      firstName,
      lastName: resto.join(" ") || undefined,
    });
  } catch (erro) {
    throw comMensagemClerk(erro);
  }
}

export async function trocarSenhaClerk(usuario: string, novaSenha: string): Promise<void> {
  const id = await resolverIdPorUsuario(usuario);
  const client = await clerkClient();
  try {
    await client.users.updateUser(id, { password: novaSenha, signOutOfOtherSessions: true });
  } catch (erro) {
    throw comMensagemClerk(erro);
  }
}

export async function alternarBloqueioClerk(usuario: string, bloquear: boolean): Promise<void> {
  const id = await resolverIdPorUsuario(usuario);
  const client = await clerkClient();
  try {
    if (bloquear) await client.users.banUser(id);
    else await client.users.unbanUser(id);
  } catch (erro) {
    throw comMensagemClerk(erro);
  }
}

/** {usuario: banido?} pra pintar o status na tabela — busca em lote, até 100 usernames por chamada. */
export async function statusClerkPorUsuario(usuarios: string[]): Promise<Record<string, boolean>> {
  if (usuarios.length === 0) return {};
  const client = await clerkClient();
  const { data } = await client.users.getUserList({ username: usuarios, limit: 100 });
  const status: Record<string, boolean> = {};
  for (const u of data) {
    if (u.username) status[u.username] = u.banned;
  }
  return status;
}
