"use client";

import type { ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Renderiza `children` direto em `document.body` quando `ativo` — é o único jeito
 * de um painel `position: fixed` (modo Foco, ver `useFoco`) escapar de verdade de
 * `opacity`/`overflow`/`transform` de um ancestral. Achado na prática: o wrapper
 * que fica `opacity-60` enquanto uma busca está em voo (`carregando`, disparado
 * pelo próprio clique de drill-down) é ANCESTRAL do painel — e `opacity < 1` num
 * ancestral vira o container de qualquer descendente `fixed`, mesmo um com
 * `inset-0`. Resultado: no instante do clique, o Foco (que devia cobrir a tela
 * inteira, opaco) ficava translúcido e encolhido dentro do ancestral, deixando
 * nav/título/KPIs da página por trás aparecerem por cima dele. Portal pro
 * `<body>` tira o painel dessa árvore de vez — não tem ancestral pra herdar nada.
 */
export function PortalFoco({ ativo, children }: { ativo: boolean; children: ReactNode }) {
  if (!ativo || typeof document === "undefined") return <>{children}</>;
  return createPortal(children, document.body);
}
