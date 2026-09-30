import { CABECALHO_REFERENCIA_MENSAL } from "@/config/data-sources";
import type { ColunaNativa } from "@/lib/parametros/types";

/** SKU, Código Unidade e Data são chaves automáticas — nunca selecionáveis num relatório (seção 3.1). */
const CHAVES_AUTOMATICAS = new Set(["Código", "Unidade Código", "Data"]);

function adivinharTipo(nome: string): ColunaNativa["tipoDado"] {
  if (nome === "Data") return "Data";
  const pareceTexto = /^(Descricao|Complemento|Marca|Unidade Nome|Código|Código Barras|Nome Fornecedor|Código do Fornecedor|Dpto)$/;
  return pareceTexto.test(nome) ? "Texto" : "Número";
}

/** Contagem (Qtde/Núm./Estoque) sai sem R$; o resto dos números do arquivo é valor
 * monetário. Palpite inicial — editável no Dicionário depois. Exportada pra
 * `migracao-refs.ts` conseguir recalcular em cadastros salvos antes desta função existir. */
export function adivinharFormato(nome: string, tipo: ColunaNativa["tipoDado"]): ColunaNativa["formato"] {
  if (tipo !== "Número") return undefined;
  return /^(Qtde|Núm\.|Estoque Disponível|Estoque Diário)/.test(nome) ? "numero" : "moeda";
}

/**
 * Ponto de partida do dicionário — importa o cabeçalho real (83 colunas,
 * ver docs/parametros.md seção 1.1) automaticamente. Editável depois (só
 * tradução/movimento/tipo — nome do arquivo e posição não mudam).
 *
 * `ref` é o NOME da coluna, não a posição: é ele que as configurações de
 * relatório guardam, e nome sobrevive a mudança de layout do arquivo (ver
 * `ColunaNativa.ref` em types.ts).
 */
export function semearDicionarioColunas(): ColunaNativa[] {
  return CABECALHO_REFERENCIA_MENSAL.map((nome, posicao) => ({ nome, posicao }))
    .filter(({ nome }) => nome.trim() !== "")
    .map(({ nome, posicao }) => {
      const tipoDado = adivinharTipo(nome);
      return {
        ref: nome,
        posicao,
        nomeArquivo: nome,
        formato: adivinharFormato(nome, tipoDado),
        movimento: "",
        traducao: nome,
        tipoDado,
        chaveAutomatica: CHAVES_AUTOMATICAS.has(nome),
      };
    });
}
