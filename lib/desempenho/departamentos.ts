/**
 * Nome de cada Departamento por código (ver "Códigos de Departamento (Dpto) confirmados" em
 * docs/regras-de-negocio.md) — mesma fonte usada pra padronizar comprador em compradores.ts.
 * Estático (não vem do cadastro em tempo real) igual à lista de compradores, pra manter o mesmo
 * padrão já usado no filtro de Comprador.
 */
const NOME_DEPARTAMENTO_POR_DPTO: Record<string, string> = {
  "001": "Acougue",
  "002": "Peixaria",
  "003": "Hortifruti",
  "004": "Padaria Propria",
  "005": "Padaria Industria",
  "006": "Pereciveis Frios e Congelados",
  "007": "Pereciveis Lacteos",
  "008": "Mercearia Basica",
  "009": "Mercearia Leite",
  "010": "Mercearia Doce",
  "011": "Mercearia Salgada",
  "012": "Mercearia Saudavel",
  "013": "Bebidas",
  "014": "Limpeza",
  "015": "Perfumaria",
  "016": "Bazar",
  "017": "Eletro",
  "018": "Sazonais",
  "099": "Apropriacoes",
};

/** Lista {value: código, label: "código - Nome"} pra popular o filtro de Departamento. */
export function listaDepartamentos(): { value: string; label: string }[] {
  return Object.entries(NOME_DEPARTAMENTO_POR_DPTO)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([codigo, nome]) => ({ value: codigo, label: `${codigo} - ${nome}` }));
}
