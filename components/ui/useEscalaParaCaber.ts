"use client";

import { useLayoutEffect, useRef, useState } from "react";

/** Nunca deixa uma tabela de poucas linhas/colunas virar texto gigante preenchendo a
 * tela — acima disso o ganho de leitura já não compensa o exagero visual. */
const ESCALA_MAXIMA = 2.5;

/** Nem no sentido contrário: uma lista de dezenas de Produtos não pode virar um
 * "trem" de texto minúsculo só pra caber tudo sem rolar (pedido de 2026-10-01) —
 * abaixo disso o ganho de "ver tudo de uma vez" já não compensa a ilegibilidade.
 * Com o piso em vigor, uma lista grande o bastante simplesmente passa a rolar
 * dentro do Foco (ver `overflow-auto` no container) em vez de encolher sem fim. */
const ESCALA_MINIMA = 0.7;

/**
 * Escala (zoom out/in) um bloco de conteúdo pra caber inteiro no container
 * disponível, sem scroll sempre que der — é o motor do modo Foco (ver
 * `BotaoFoco`/`useFoco`). Quando não der (lista grande demais mesmo no piso de
 * `ESCALA_MINIMA`), o container rola normalmente em vez de espremer o texto até
 * ficar ilegível.
 *
 * Usa a propriedade CSS `zoom`, não `transform: scale()`: `transform` desenha o
 * texto no tamanho normal e depois estica a IMAGEM já pronta — a fonte sai borrada/
 * com peso estranho. `zoom` manda o navegador redesenhar o texto de verdade no
 * tamanho final (mesmo caminho de um Ctrl+/Ctrl- de verdade) — nítido, sem
 * distorcer. A troca é `zoom` não aceitar X/Y independentes (só um fator), então o
 * conteúdo fica centralizado no container (`containerRef` com flex +
 * items/justify-center) em vez de esticado até a borda.
 *
 * `larguraConteudo` é passado pelo chamador (`larguraMinimaTabela(colunas)`), NÃO
 * medido do DOM — motivo: a tabela usa `width: 100%` (ver `EstruturaPanel`/
 * `HierarquiaPanel`), e medir `scrollWidth` de um `display: inline-block` cujo
 * filho tem `width: 100%` é circular — o navegador resolve o 100% contra a
 * largura TOTAL disponível (a da tela), não contra o tamanho natural da tabela,
 * inflando a largura "natural" medida pro tamanho da tela inteira. Isso travava a
 * escala sempre perto de 1× (confirmado na prática: `scrollWidth` relatando 1920px
 * pra uma tabela de 892px) mesmo sobrando bastante espaço — e, como consequência,
 * deixava uma faixa em branco "fantasma" centralizada que parecia um bug de
 * `position: sticky`, mas era só a escala nunca crescendo de verdade. Altura não
 * tem esse problema (nenhum elemento usa `height: 100%`), por isso só ela ainda
 * vem de `scrollHeight`.
 */
export function useEscalaParaCaber(ativo: boolean, larguraConteudo: number) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [escala, setEscala] = useState(1);

  useLayoutEffect(() => {
    // Sem reset explícito pra inativo: `escala` só é lida quando `ativo` (focado) é
    // true, e o próximo `recalcular()` roda síncrono (useLayoutEffect, antes do
    // paint) assim que ativar de novo — nunca aparece um frame com valor velho.
    if (!ativo) return;
    function recalcular() {
      const container = containerRef.current;
      const content = contentRef.current;
      if (!container || !content || larguraConteudo === 0) return;
      // `zoom` (ao contrário de `transform`) muda o layout de verdade — scrollHeight
      // já viria multiplicado pelo zoom em vigor. Zera pra 1 antes de medir (direto
      // no DOM, sem passar por render) pra pegar sempre o tamanho SEM zoom, e
      // restaura em seguida — o navegador nunca chega a pintar esse estado
      // intermediário, tudo acontece antes do próximo paint.
      const zoomAnterior = content.style.zoom;
      content.style.zoom = "1";
      const alturaNatural = content.scrollHeight;
      content.style.zoom = zoomAnterior;
      const larguraDisponivel = container.clientWidth;
      const alturaDisponivel = container.clientHeight;
      if (alturaNatural === 0 || larguraDisponivel === 0 || alturaDisponivel === 0) return;
      const fator = Math.min(larguraDisponivel / larguraConteudo, alturaDisponivel / alturaNatural);
      setEscala(fator > 0 ? Math.min(Math.max(fator, ESCALA_MINIMA), ESCALA_MAXIMA) : 1);
    }
    recalcular();
    // Reage tanto a mudar o tamanho da janela/painel quanto a mudar a quantidade
    // de linhas do conteúdo (drill-down, ordenação, troca de período) — largura não
    // precisa de observer porque já vem pronta em `larguraConteudo`.
    const observer = new ResizeObserver(recalcular);
    observer.observe(containerRef.current!);
    observer.observe(contentRef.current!);
    return () => observer.disconnect();
  }, [ativo, larguraConteudo]);

  return { containerRef, contentRef, escala };
}
