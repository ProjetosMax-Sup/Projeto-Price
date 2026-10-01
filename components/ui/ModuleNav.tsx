import Link from "next/link";
import { obterGestorAtual } from "@/lib/auth/exigir-gestor";

type Modulo = {
  slug: string;
  label: string;
  implementado: boolean;
};

const MODULOS: Modulo[] = [
  { slug: "desempenho-comercial", label: "Desempenho Comercial", implementado: true },
  { slug: "entradas-saidas", label: "Entradas e Saídas", implementado: true },
  { slug: "compra-venda", label: "Compra e Venda", implementado: true },
  { slug: "perdas-quebras", label: "Perdas e Quebras", implementado: false },
  { slug: "raio-x-fornecedor", label: "Raio X Fornecedor", implementado: false },
];

export async function ModuleNav({ active }: { active?: string }) {
  const gestor = await obterGestorAtual();
  return (
    <header className="sticky top-0 z-30 bg-azul text-white">
      <div className="mx-auto flex max-w-[1800px] items-center gap-1 px-6 py-2.5">
        <span className="mr-6 flex items-center gap-2 font-display text-lg font-bold tracking-tight">
          MAX
          <span className="rounded bg-vermelho px-1.5 py-0.5 text-[11px] font-bold tracking-wide">
            SUPERMERCADOS
          </span>
        </span>
        <nav className="flex flex-1 gap-1">
          {MODULOS.map((modulo) => (
            <Link
              key={modulo.slug}
              href={`/${modulo.slug}`}
              aria-disabled={!modulo.implementado}
              className={[
                "rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors",
                active === modulo.slug ? "bg-white/15 text-white" : "text-white/70 hover:text-white",
                !modulo.implementado && "pointer-events-none opacity-40",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {modulo.label}
            </Link>
          ))}
        </nav>
        {gestor && (
          <Link
            href="/parametros"
            aria-label="Parâmetros"
            className="rounded-md p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
            </svg>
          </Link>
        )}
      </div>
    </header>
  );
}
