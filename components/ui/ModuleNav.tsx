import Link from "next/link";

type Modulo = {
  slug: string;
  label: string;
  implementado: boolean;
};

const MODULOS: Modulo[] = [
  { slug: "desempenho-comercial", label: "Desempenho Comercial", implementado: true },
  { slug: "entradas-saidas", label: "Entradas e Saídas", implementado: false },
  { slug: "compra-venda", label: "Compra e Venda", implementado: false },
  { slug: "perdas-quebras", label: "Perdas e Quebras", implementado: false },
  { slug: "raio-x-fornecedor", label: "Raio X Fornecedor", implementado: false },
];

export function ModuleNav({ active }: { active?: string }) {
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
      </div>
    </header>
  );
}
