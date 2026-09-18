import { ModuleNav } from "@/components/ui/ModuleNav";

export default function EntradasSaidasPage() {
  return (
    <div className="flex min-h-full flex-col">
      <ModuleNav active="entradas-saidas" />
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col items-center justify-center px-6 py-8 text-center">
        <h1 className="font-display text-2xl font-bold text-zinc-900">Entradas e Saídas</h1>
        <p className="mt-2 text-sm text-zinc-500">Módulo ainda não implementado.</p>
      </main>
    </div>
  );
}
