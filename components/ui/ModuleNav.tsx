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
    <header className="bg-azul text-white">
      <div className="mx-auto flex max-w-[1800px] items-center gap-1 px-6">
        <span className="mr-6 font-display text-lg font-bold tracking-tight py-4">
          MAX <span className="text-vermelho">Supermercados</span>
        </span>
        <nav className="flex flex-1 gap-1">
          {MODULOS.map((modulo) => (
            <Link
              key={modulo.slug}
              href={`/${modulo.slug}`}
              aria-disabled={!modulo.implementado}
              className={[
                "px-4 py-4 text-sm font-medium transition-colors border-b-2",
                active === modulo.slug
                  ? "border-white text-white"
                  : "border-transparent text-white/70 hover:text-white",
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
