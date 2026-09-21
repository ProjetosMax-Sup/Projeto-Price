/**
 * Mapa das colunas de Entrada/Saída do arquivo mensal (`bd<Mês>.txt`) pra os
 * nomes das colunas na tabela `movimentos_entrada_saida` do Supabase — só as
 * ~57 necessárias pro relatório Entradas e Saídas (não as 83 do arquivo
 * inteiro; ver docs/parametros.md seção 1.1 pra referência do cabeçalho
 * completo em `config/data-sources.ts`).
 *
 * Se um dia "Compras muda de X pra Y" (nome de coluna no arquivo muda), é
 * só editar a linha correspondente aqui — não precisa mexer no resto do
 * pipeline.
 */
export const COLUNAS_ENTRADA_SAIDA: { nomeArquivo: string; coluna: string }[] = [
  // Entrada — quantidade
  { nomeArquivo: "Qtde Compras", coluna: "qtde_compras" },
  { nomeArquivo: "Qtde Outras Entradas", coluna: "qtde_outras_entradas" },
  { nomeArquivo: "Qtde Transf Entradas", coluna: "qtde_transf_entradas" },
  { nomeArquivo: "Qtde Devoluções Venda", coluna: "qtde_devolucoes_venda" },
  { nomeArquivo: "Qtde Trocas Entradas", coluna: "qtde_trocas_entradas" },
  { nomeArquivo: "Qtde Bonif Entradas", coluna: "qtde_bonif_entradas" },
  { nomeArquivo: "Qtde Consig Entradas", coluna: "qtde_consig_entradas" },
  { nomeArquivo: "Qtde Produção", coluna: "qtde_producao" },
  { nomeArquivo: "Qtde Sobras Estoque", coluna: "qtde_sobras_estoque" },
  { nomeArquivo: "Qtde Simp Rem Entradas", coluna: "qtde_simp_rem_entradas" },
  { nomeArquivo: "Qtde Reman Entradas", coluna: "qtde_reman_entradas" },

  // Entrada — valor
  { nomeArquivo: "Compras", coluna: "compras" },
  { nomeArquivo: "Compras Líquidas", coluna: "compras_liquidas" },
  { nomeArquivo: "Compras Ct Empresa", coluna: "compras_ct_empresa" },
  { nomeArquivo: "Compras Vl NFe", coluna: "compras_vl_nfe" },
  { nomeArquivo: "Outras Entradas", coluna: "outras_entradas" },
  { nomeArquivo: "Transfer. Entradas", coluna: "transf_entradas" },
  { nomeArquivo: "Devoluções Venda", coluna: "devolucoes_venda" },
  { nomeArquivo: "Trocas Entradas", coluna: "trocas_entradas" },
  { nomeArquivo: "Bonific Entradas", coluna: "bonif_entradas" },
  { nomeArquivo: "Consig Entradas", coluna: "consig_entradas" },
  { nomeArquivo: "Produção", coluna: "producao" },
  { nomeArquivo: "Sobras Estoque", coluna: "sobras_estoque" },
  { nomeArquivo: "Simp. Rem. Entradas", coluna: "simp_rem_entradas" },
  { nomeArquivo: "Valor Reman Entradas", coluna: "valor_reman_entradas" },

  // Saída — quantidade
  { nomeArquivo: "Qtde Vendas", coluna: "qtde_vendas" },
  { nomeArquivo: "Qtde Vendas Oferta", coluna: "qtde_vendas_oferta" },
  { nomeArquivo: "Qtde Perdas Estoque", coluna: "qtde_perdas_estoque" },
  { nomeArquivo: "Qtde Outras Saídas", coluna: "qtde_outras_saidas" },
  { nomeArquivo: "Qtde Transf Saídas", coluna: "qtde_transf_saidas" },
  { nomeArquivo: "Qtde Devoluções Compra", coluna: "qtde_devolucoes_compra" },
  { nomeArquivo: "Qtde Trocas Saídas", coluna: "qtde_trocas_saidas" },
  { nomeArquivo: "Qtde Doaçoes", coluna: "qtde_doacoes" },
  { nomeArquivo: "Qtde Bonif Saídas", coluna: "qtde_bonif_saidas" },
  { nomeArquivo: "Qtde Consig Saídas", coluna: "qtde_consig_saidas" },
  { nomeArquivo: "Qtde Consumos Internos", coluna: "qtde_consumos_internos" },
  { nomeArquivo: "Qtde Transf Mat. Prima", coluna: "qtde_transf_mat_prima" },
  { nomeArquivo: "Qtde Faltas Estoque", coluna: "qtde_faltas_estoque" },
  { nomeArquivo: "Qtde Simp Rem Saías", coluna: "qtde_simp_rem_saidas" }, // "Saías" é o nome real no arquivo (sem "d")
  { nomeArquivo: "Qtde Reman Saídas", coluna: "qtde_reman_saidas" },

  // Saída — valor
  { nomeArquivo: "Valor", coluna: "valor" },
  { nomeArquivo: "Lucros", coluna: "lucros" },
  { nomeArquivo: "Vendas Oferta", coluna: "vendas_oferta" },
  { nomeArquivo: "Lucros Oferta", coluna: "lucros_oferta" },
  { nomeArquivo: "Perdas", coluna: "perdas" },
  { nomeArquivo: "Outras Saídas", coluna: "outras_saidas" },
  { nomeArquivo: "Transfer. Saídas", coluna: "transf_saidas" },
  { nomeArquivo: "Devoluções Compra", coluna: "devolucoes_compra" },
  { nomeArquivo: "Trocas Saídas", coluna: "trocas_saidas" },
  { nomeArquivo: "Doações", coluna: "doacoes" },
  { nomeArquivo: "Bonific Saídas", coluna: "bonif_saidas" },
  { nomeArquivo: "Consig Saídas", coluna: "consig_saidas" },
  { nomeArquivo: "Consumos Internos", coluna: "consumos_internos" },
  { nomeArquivo: "Transf Mat. Prima", coluna: "transf_mat_prima" },
  { nomeArquivo: "Faltas Estoque", coluna: "faltas_estoque" },
  { nomeArquivo: "Simp. Rem. Saídas", coluna: "simp_rem_saidas" },
  { nomeArquivo: "Valor Reman Saídas", coluna: "valor_reman_saidas" },
];

export const CAMPOS_CHAVE = ["Código", "Dpto", "Unidade Código", "Data"] as const;
