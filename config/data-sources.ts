/**
 * Caminho da pasta OneDrive com os arquivos-fonte. Difere entre computador
 * pessoal e notebook corporativo — nunca hardcodear, sempre via env var.
 * Configurar em .env.local: DESEMPENHO_COMERCIAL_DATA_DIR=C:\caminho\...
 */
export const DESEMPENHO_COMERCIAL_DATA_DIR = process.env.DESEMPENHO_COMERCIAL_DATA_DIR ?? "";

/**
 * Encoding confirmado por arquivo: bdLojas.txt é UTF-8 (mantido à parte,
 * provavelmente editado manualmente); os demais (exportados do ERP) são
 * Latin-1/ISO-8859-1. Não presumir que todos os arquivos usam o mesmo encoding.
 */
export const ARQUIVOS_DESEMPENHO_COMERCIAL = {
  atual: { nome: "bdDesempenhoComercialAtual.txt", encoding: "latin1" as const },
  comparacao: { nome: "bdDesempenhoComercialComparação.txt", encoding: "latin1" as const },
  cadastro: { nome: "bdCadastro.txt", encoding: "latin1" as const },
  lojas: { nome: "bdLojas.txt", encoding: "utf8" as const },
};

export const DELIMITADOR = "|" as const;
