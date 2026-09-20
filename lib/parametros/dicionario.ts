import { CABECALHO_REFERENCIA_MENSAL } from "@/config/data-sources";
import type { ColunaNativa } from "@/lib/parametros/types";

/** SKU, Código Unidade e Data são chaves automáticas — nunca selecionáveis num relatório (seção 3.1). */
const CHAVES_AUTOMATICAS = new Set(["Código", "Unidade Código", "Data"]);

function adivinharTipo(nome: string): ColunaNativa["tipoDado"] {
  if (nome === "Data") return "Data";
  const pareceTexto = /^(Descricao|Complemento|Marca|Unidade Nome|Código|Código Barras|Nome Fornecedor|Código do Fornecedor|Dpto)$/;
  return pareceTexto.test(nome) ? "Texto" : "Número";
}

/**
 * Ponto de partida do dicionário — importa o cabeçalho real (83 colunas,
 * ver docs/parametros.md seção 1.1) automaticamente. Editável depois (só
 * tradução/movimento/tipo — nome do arquivo e posição não mudam).
 */
export function semearDicionarioColunas(): ColunaNativa[] {
  return CABECALHO_REFERENCIA_MENSAL.map((nome, posicao) => ({ nome, posicao }))
    .filter(({ nome }) => nome.trim() !== "")
    .map(({ nome, posicao }) => ({
      ref: String(posicao),
      posicao,
      nomeArquivo: nome,
      movimento: "",
      traducao: nome,
      tipoDado: adivinharTipo(nome),
      chaveAutomatica: CHAVES_AUTOMATICAS.has(nome),
    }));
}
