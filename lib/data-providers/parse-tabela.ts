import { DELIMITADOR } from "@/config/data-sources";

/**
 * Lê um TXT pipe-delimited com cabeçalho de 2 linhas (nome + complemento, unidos
 * como "{linha1} {linha2}"). Quando `duasLinhasHeader` é false, a primeira linha
 * já é o cabeçalho final (caso do bdLojas).
 *
 * Extrai só os `campos` pedidos (por nome, resolvido pela primeira ocorrência no
 * cabeçalho) em vez de montar um objeto com todas as colunas — os arquivos reais
 * têm dezenas/centenas de colunas que não usamos (ex: bdCadastro tem ~130) e
 * podem ter nomes repetidos (que a junção com a linha 2 normalmente desambigua).
 * Um campo pedido que não existir no arquivo (ex: "Unidade Código" em
 * bdDesempenhoComercialAtual.txt, que não tem esse recorte) vira sempre "".
 *
 * Função pura (recebe o conteúdo já decodificado) — não importa se o arquivo
 * veio do disco local ou de uma API remota (ver `file-provider.ts` vs
 * `onedrive-provider.ts`).
 */
export function parseTabela<T extends string>(
  conteudo: string,
  campos: readonly T[],
  duasLinhasHeader = true,
): Record<T, string>[] {
  const linhas = conteudo.split(/\r\n|\n/).filter((linha) => linha.length > 0);

  let colunas: string[];
  let primeiraLinhaDados: number;

  if (duasLinhasHeader) {
    const linha1 = linhas[0]?.split(DELIMITADOR) ?? [];
    const linha2 = linhas[1]?.split(DELIMITADOR) ?? [];
    colunas = linha1.map((nome, i) => {
      const complemento = linha2[i]?.trim();
      return complemento ? `${nome.trim()} ${complemento}` : nome.trim();
    });
    primeiraLinhaDados = 2;
  } else {
    colunas = (linhas[0]?.split(DELIMITADOR) ?? []).map((nome) => nome.trim());
    primeiraLinhaDados = 1;
  }

  // Primeira ocorrência de cada campo pedido — evita colisão se algum nome se repetir.
  const indices = campos.map((campo) => colunas.indexOf(campo));

  const linhasDados = linhas.slice(primeiraLinhaDados);
  const resultado: Record<T, string>[] = new Array(linhasDados.length);

  for (let i = 0; i < linhasDados.length; i++) {
    const valores = linhasDados[i].split(DELIMITADOR);
    const registro = {} as Record<T, string>;
    for (let c = 0; c < campos.length; c++) {
      const idx = indices[c];
      registro[campos[c]] = idx === -1 ? "" : (valores[idx]?.trim() ?? "");
    }
    resultado[i] = registro;
  }

  return resultado;
}
