import type { UsuarioCadastro } from "@/lib/parametros/types";

/**
 * Identidade de quem acessa. Login individual via Clerk está pausado (voltou pra senha
 * única do site, ver proxy.ts — sem domínio próprio não dá pra rodar a instância de
 * Production do Clerk sem o loop de redirect pro Account Portal hospedado). Enquanto isso,
 * quem passa da senha do site tem acesso completo (perfil Gestor, sem restrição de
 * Departamento/Loja) — não dá pra saber "quem" é sem login individual, então não faz
 * sentido negar acesso a ninguém que já passou pela senha.
 *
 * Reativar login individual: reverter esta função pra voltar a resolver via Clerk
 * (`currentUser()` + `obterOuSemearUsuariosCadastro`) — todos os call sites (obterGestorAtual,
 * páginas/rotas de Desempenho Comercial e Parâmetros) continuam os mesmos.
 */
export async function obterUsuarioAtual(): Promise<UsuarioCadastro | null> {
  return {
    usuario: "acesso-compartilhado",
    nome: "Acesso Compartilhado",
    perfil: "Gestor",
    departamentos: [],
    lojas: [],
  };
}
