/**
 * Cache em memória do processo com duas garantias:
 * 1. Invalida sozinho quando `obterVersao()` muda (mtime local ou eTag remoto).
 * 2. "Single-flight": se várias chamadas concorrentes pedem o mesmo dado antes
 *    da primeira terminar, todas reaproveitam a MESMA promise em vez de disparar
 *    o carregamento (download + parse) várias vezes em paralelo — importante
 *    aqui porque produtos/lojas são pedidos por vários caminhos ao mesmo tempo
 *    (direto pela página + indiretamente pelos períodos Atual e Comparação).
 */
export function criarCacheVersionado<T>(obterVersao: () => Promise<string | number>, carregar: () => Promise<T>) {
  let cache: { versao: string | number; valor: T } | null = null;
  let emAndamento: Promise<T> | null = null;

  return function obter(): Promise<T> {
    if (emAndamento) return emAndamento;

    emAndamento = (async () => {
      const versao = await obterVersao();
      if (cache && cache.versao === versao) return cache.valor;
      const valor = await carregar();
      cache = { versao, valor };
      return valor;
    })().finally(() => {
      emAndamento = null;
    });

    return emAndamento;
  };
}
