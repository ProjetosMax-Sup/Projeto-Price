"use client";

import { useEffect, useState } from "react";

/**
 * Estado do modo "Foco" (painel expandido pra tela cheia) — Esc fecha, e o
 * scroll da página por trás fica travado enquanto focado (senão dava pra
 * rolar o conteúdo escondido atrás do overlay). Qualquer painel com tabela
 * usa isto + `BotaoFoco` pra ganhar o botão, hoje e nos que vierem depois —
 * ver `EstruturaPanel`/`HierarquiaPanel` como referência de como plugar.
 */
export function useFoco() {
  const [focado, setFocado] = useState(false);

  useEffect(() => {
    if (!focado) return;
    const overflowOriginal = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") setFocado(false);
    }
    window.addEventListener("keydown", aoTeclar);
    return () => {
      document.body.style.overflow = overflowOriginal;
      window.removeEventListener("keydown", aoTeclar);
    };
  }, [focado]);

  return { focado, alternar: () => setFocado((f) => !f) };
}
