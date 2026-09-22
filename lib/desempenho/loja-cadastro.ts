import type { LojaCadastro } from "@/lib/parametros/types";
import type { Loja } from "@/lib/types";

/**
 * Converte o cadastro editável de Lojas (Parâmetros, seção 2.2) pro shape
 * usado na computação do Desempenho Comercial — substitui bdLojas.txt como
 * fonte do nome/formato exibidos (o join com os registros continua sendo
 * por Código Unidade, que não muda). `codUnidReduzido`/`nomeSistema` não têm
 * mais equivalente (nunca foram consumidos fora do parser antigo).
 *
 * Formato é texto livre no cadastro (seção 2.3 prevê formatos novos no
 * futuro) — hoje só existem "Varejo"/"Atacado" na prática; qualquer outro
 * valor cai em "Varejo" por segurança, mesmo comportamento defensivo que já
 * existia no parser de bdLojas.txt.
 */
export function lojasDoCadastro(lojas: LojaCadastro[]): Loja[] {
  return lojas.map((l) => ({
    codUnid: l.codigo,
    codUnidReduzido: "",
    nomeSistema: "",
    nomeLoja: l.nomeCustomizado,
    formato: l.formato === "Atacado" ? "Atacado" : "Varejo",
    dataAbertura: l.dataAbertura || null,
  }));
}
