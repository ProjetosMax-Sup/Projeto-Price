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
  cadastro: { nome: "bdCadastro.txt", encoding: "latin1" as const },
  lojas: { nome: "bdLojas.txt", encoding: "utf8" as const },
};

export const DELIMITADOR = "|" as const;

/**
 * Movimento (vendas, compras, perdas etc.) passou a vir num arquivo por mês
 * (`bd<Mês>.txt`, ex: `bdSetembro.txt`) — substitui os antigos
 * `bdDesempenhoComercialAtual.txt`/`...Comparação.txt` (ver docs/parametros.md
 * seção 1). Mesmo encoding/delimitador dos demais arquivos exportados do ERP.
 */
export const NOMES_MESES_ARQUIVO = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
] as const;

/** `{nome: "bdJaneiro.txt", encoding: "latin1"}`, etc. — um por mês do calendário. */
export function arquivoMensal(nomeMes: (typeof NOMES_MESES_ARQUIVO)[number]): { nome: string; encoding: BufferEncoding } {
  return { nome: `bd${nomeMes}.txt`, encoding: "latin1" };
}

/** "2026-09" → "bdSetembro.txt" — usado pelo Entradas e Saídas (`lib/entradas-saidas`), que
 * opera sempre num mês só por vez, pra selecionar direto o arquivo certo sem precisar ler
 * os outros meses. `null` se o mês (1-12) for inválido. */
export function nomeArquivoDoMesIso(mesIso: string): string | null {
  const mes = Number(mesIso.slice(5, 7));
  const nomeMes = NOMES_MESES_ARQUIVO[mes - 1];
  return nomeMes ? arquivoMensal(nomeMes).nome : null;
}

/**
 * Restrição temporária de quais meses processar (ex: "Julho,Agosto,Setembro") — só existe
 * porque o dataset completo (9+ meses, 4+ milhões de registros) estourou a memória do plano
 * atual do Redis (ver lib/desempenho/dataset-cache.ts). Sem essa variável, processa todos os
 * meses disponíveis normalmente. Remover assim que o Redis for resolvido (upgrade de plano ou
 * mudar pra um banco de verdade) — não é uma regra de negócio, é só um limite de infra atual.
 */
const MESES_HABILITADOS = process.env.MESES_HABILITADOS?.split(",")
  .map((m) => m.trim())
  .filter(Boolean);

/**
 * Filtra e ordena cronologicamente (Janeiro → Dezembro) quais arquivos mensais
 * de fato existem entre os `nomesNaPasta` informados (vindos de `fs.readdir`
 * local ou da listagem do OneDrive) — meses ausentes (ex: um mês ainda não
 * subido) são simplesmente ignorados, sem quebrar nada.
 */
export function arquivosMensaisDisponiveis(nomesNaPasta: string[]): { nome: string; encoding: BufferEncoding }[] {
  const presentes = new Set(nomesNaPasta);
  const meses = MESES_HABILITADOS ? NOMES_MESES_ARQUIVO.filter((mes) => MESES_HABILITADOS.includes(mes)) : NOMES_MESES_ARQUIVO;
  return meses.map((mes) => arquivoMensal(mes)).filter((arquivo) => presentes.has(arquivo.nome));
}

/**
 * As 83 colunas do arquivo mensal, cabeçalho combinado (linha 1 + linha 2),
 * na ordem exata em que aparecem no arquivo — validada campo a campo contra
 * `bdJaneiro.txt` até `bdJunho.txt`, `bdAgosto.txt` e `bdSetembro.txt` reais
 * (ver docs/parametros.md seção 1.1). Usada só pra VALIDAR o cabeçalho de
 * cada arquivo recebido antes de processar (nunca pra extrair campo por
 * posição — a extração continua por nome, ver `CAMPOS_MOVIMENTO` em
 * `lib/desempenho/normalizar-desempenho.ts`). Um cabeçalho que não bate
 * exatamente com esta lista é sinal de um arquivo fora do padrão (já
 * aconteceu uma vez, um bloco de Julho com 111 colunas em outra ordem) — o
 * parser recusa/alerta em vez de processar às cegas.
 */
export const CABECALHO_REFERENCIA_MENSAL = [
  "Código",
  "Descricao",
  "Complemento",
  "Marca",
  "Dpto",
  "Código Barras",
  "Unidade Código",
  "Unidade Nome",
  "Qtde Compras",
  "Qtde Outras Entradas",
  "Qtde Transf Entradas",
  "Qtde Devoluções Venda",
  "Qtde Trocas Entradas",
  "Qtde Bonif Entradas",
  "Qtde Consig Entradas",
  "Qtde Produção",
  "Qtde Sobras Estoque",
  "Qtde Simp Rem Entradas",
  "Qtde Reman Entradas",
  "Compras",
  "Compras Líquidas",
  "Compras Ct Empresa",
  "Compras Vl NFe",
  "Outras Entradas",
  "Transfer. Entradas",
  "Devoluções Venda",
  "Trocas Entradas",
  "Bonific Entradas",
  "Consig Entradas",
  "Produção",
  "Sobras Estoque",
  "Simp. Rem. Entradas",
  "Valor Reman Entradas",
  "Qtde Vendas",
  "Qtde Vendas Oferta",
  "Qtde Perdas Estoque",
  "Qtde Outras Saídas",
  "Qtde Transf Saídas",
  "Qtde Devoluções Compra",
  "Qtde Trocas Saídas",
  "Qtde Doaçoes",
  "Qtde Bonif Saídas",
  "Qtde Consig Saídas",
  "Qtde Consumos Internos",
  "Qtde Transf Mat. Prima",
  "Qtde Faltas Estoque",
  "Qtde Simp Rem Saías",
  "Qtde Reman Saídas",
  "Valor",
  "Lucros",
  "Vendas Oferta",
  "Lucros Oferta",
  "Perdas",
  "Outras Saídas",
  "Transfer. Saídas",
  "Devoluções Compra",
  "Trocas Saídas",
  "Doações",
  "Bonific Saídas",
  "Consig Saídas",
  "Consumos Internos",
  "Transf Mat. Prima",
  "Faltas Estoque",
  "Simp. Rem. Saídas",
  "Valor Reman Saídas",
  "Margem Contrib.",
  "Custo Total Vendas",
  "Vendas Ct Empresa",
  "Vendas Ct Compra",
  "Ct Médio Vendas",
  "Vl. ICMS Informado",
  "Ct Venda Vendas",
  "Vendas Líquidas",
  "Núm. Clientes Atendidos",
  "Estoques Preço Venda",
  "Qtde Venda Média Diária",
  "Estoque Disponível",
  "Valor Venda Média Diária",
  "Código do Fornecedor",
  "Nome Fornecedor",
  "Data",
  "Estoque Diário",
  "",
] as const;

/**
 * Refs nativos (nomes de coluna, sempre um item de `CABECALHO_REFERENCIA_MENSAL`)
 * usados por nome em fórmulas específicas de `lib/parametros/seed.ts` — mantidos
 * à parte mesmo depois de `REFS_NATIVOS_ENTRADAS_SAIDAS` virar "todas as colunas"
 * abaixo, porque o código ainda referencia ESTES por nome (ex.: "Compras" como
 * termo de "% Compra/Venda", Estoque/VMD como fotografia).
 */
export const REF_ENTRADAS_COMPRAS = "Compras";
export const REFS_ENTRADAS_OUTRAS = [
  "Outras Entradas",
  "Transfer. Entradas",
  "Devoluções Venda",
  "Trocas Entradas",
  "Bonific Entradas",
  "Consig Entradas",
  "Produção",
  "Sobras Estoque",
  "Simp. Rem. Entradas",
  "Valor Reman Entradas",
] as const;
export const REFS_SAIDAS_OUTRAS = [
  "Perdas",
  "Outras Saídas",
  "Transfer. Saídas",
  "Devoluções Compra",
  "Trocas Saídas",
  "Doações",
  "Bonific Saídas",
  "Consig Saídas",
  "Consumos Internos",
  "Transf Mat. Prima",
  "Faltas Estoque",
  "Simp. Rem. Saídas",
  "Valor Reman Saídas",
] as const;
export const REF_ENTRADAS_SAIDAS_QTDE_VMD = "Qtde Venda Média Diária";
export const REF_ENTRADAS_SAIDAS_ESTOQUE = "Estoque Disponível";

/** Colunas de `CABECALHO_REFERENCIA_MENSAL` que são identificador/texto, não
 * métrica — nunca fazem sentido num termo de fórmula (somar um "Nome Fornecedor"
 * não quer dizer nada). Ficam de fora de `REFS_NATIVOS_ENTRADAS_SAIDAS`. */
const REFS_ENTRADAS_SAIDAS_IDENTIFICADORES = new Set([
  "Código",
  "Descricao",
  "Complemento",
  "Marca",
  "Dpto",
  "Código Barras",
  "Unidade Código",
  "Unidade Nome",
  "Código do Fornecedor",
  "Nome Fornecedor",
  "Data",
]);

/** Colunas "foto" — já são um valor acumulado/médio do mês inteiro, repetido em
 * toda linha (confirmado no arquivo real pra Estoque/VMD em 2026-09-30, mesma
 * lógica se estende às demais "Médio"/Estoque daqui). Tomadas de UMA ocorrência
 * (a mais recente), nunca somadas — somar contaria o mesmo valor várias vezes. */
export const REFS_ENTRADAS_SAIDAS_SNAPSHOT = [
  REF_ENTRADAS_SAIDAS_QTDE_VMD,
  REF_ENTRADAS_SAIDAS_ESTOQUE,
  "Estoque Diário",
  "Estoques Preço Venda",
  "Ct Médio Vendas",
  "Valor Venda Média Diária",
] as const;

/** TODAS as colunas numéricas de `CABECALHO_REFERENCIA_MENSAL` (identificador
 * fora) — decisão de 2026-10-01: o Dicionário já promete as 83 colunas do
 * arquivo pra qualquer fórmula (ver docs/exemplos-motor-colunas/README.md), mas
 * só "Compras"/"Valor" chegavam a ser extraídas de verdade pro Entradas e
 * Saídas/Compra e Venda — qualquer outra resolvia sempre 0, silenciosamente
 * (bug real, achado com "Lucros" em "% Margem"). Seguro ampliar aqui porque
 * este parser é à parte do Desempenho Comercial (ver aviso em
 * `normalizar-desempenho.ts` > CAMPOS_MOVIMENTO) — não retém os registros
 * brutos, só o já reduzido por Produto×Loja. */
export const REFS_NATIVOS_ENTRADAS_SAIDAS = CABECALHO_REFERENCIA_MENSAL.filter(
  (ref) => ref !== "" && !REFS_ENTRADAS_SAIDAS_IDENTIFICADORES.has(ref),
);
