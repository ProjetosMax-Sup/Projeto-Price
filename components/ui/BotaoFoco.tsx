"use client";

/** Botão do modo Foco (ver `useFoco`) — mesmo visual em qualquer painel de tabela,
 * pra ficar óbvio que é a mesma função em todo lugar que aparece. */
export function BotaoFoco({ focado, onClick }: { focado: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={focado ? "Sair do modo Foco (Esc)" : "Expandir pra tela cheia"}
      className="flex items-center gap-1 rounded-md border border-white/30 px-2.5 py-1.5 text-xs font-medium text-white/80 hover:bg-white/10 hover:text-white"
    >
      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
        {focado ? (
          <path d="M9 3H5a2 2 0 0 0-2 2v4m18 0V5a2 2 0 0 0-2-2h-4M3 15v4a2 2 0 0 0 2 2h4m10-6v4a2 2 0 0 1-2 2h-4" />
        ) : (
          <path d="M3 9V5a2 2 0 0 1 2-2h4M15 3h4a2 2 0 0 1 2 2v4M21 15v4a2 2 0 0 1-2 2h-4M9 21H5a2 2 0 0 1-2-2v-4" />
        )}
      </svg>
      {focado ? "Sair" : "Foco"}
    </button>
  );
}
