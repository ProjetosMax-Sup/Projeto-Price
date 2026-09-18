import type { Formato, RegistroDesempenho } from "@/lib/types";

/**
 * Compradores padronizados por Departamento (confirmado pelo usuário — não vem
 * mais da coluna "Comprador" de bdCadastro, que não é confiável). Dois
 * departamentos (Açougue e Hortifruti) têm comprador diferente por Formato de
 * loja (Varejo × Atacado); os demais têm um único comprador para os dois.
 */
const COMPRADOR_POR_DPTO: Record<string, { varejo: string; atacado: string }> = {
  "001": { varejo: "Johathan", atacado: "Jairo" },
  "002": { varejo: "Johathan", atacado: "Johathan" },
  "003": { varejo: "Marrone", atacado: "Jairo" },
  "004": { varejo: "Nil", atacado: "Nil" },
  "005": { varejo: "Nil", atacado: "Nil" },
  "006": { varejo: "Johathan", atacado: "Johathan" },
  "007": { varejo: "Bruna", atacado: "Bruna" },
  "008": { varejo: "Divino", atacado: "Divino" },
  "009": { varejo: "Manoel", atacado: "Manoel" },
  "010": { varejo: "Bruna", atacado: "Bruna" },
  "011": { varejo: "Ricardo", atacado: "Ricardo" },
  "012": { varejo: "Bruna", atacado: "Bruna" },
  "013": { varejo: "Sandro", atacado: "Sandro" },
  "014": { varejo: "Manoel", atacado: "Manoel" },
  "015": { varejo: "Manoel", atacado: "Manoel" },
  "016": { varejo: "Edvaldo", atacado: "Edvaldo" },
  "017": { varejo: "Edvaldo", atacado: "Edvaldo" },
  "018": { varejo: "Bruna", atacado: "Bruna" },
  "099": { varejo: "S/ Comprador", atacado: "S/ Comprador" },
};

const SEM_COMPRADOR = "Sem comprador";

/** Nome do comprador padronizado para um Dpto + Formato de loja. */
export function nomeCompradorPorDpto(dpto: string, formato: Formato): string {
  const entrada = COMPRADOR_POR_DPTO[dpto];
  if (!entrada) return SEM_COMPRADOR;
  return formato === "Atacado" ? entrada.atacado : entrada.varejo;
}

/** Comprador do registro (null quando não dá pra determinar — falta produto/loja no join). */
export function nomeCompradorDoRegistro(registro: RegistroDesempenho): string | null {
  if (!registro.produto || !registro.loja) return null;
  return nomeCompradorPorDpto(registro.produto.dpto, registro.loja.formato);
}

/** Lista de compradores distintos (ordenada) pra popular o filtro. */
export function listaCompradores(): string[] {
  const nomes = new Set<string>();
  for (const entrada of Object.values(COMPRADOR_POR_DPTO)) {
    nomes.add(entrada.varejo);
    nomes.add(entrada.atacado);
  }
  return Array.from(nomes).sort((a, b) => a.localeCompare(b, "pt-BR"));
}
