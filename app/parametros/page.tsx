import { ParametrosDashboard } from "@/components/parametros/ParametrosDashboard";
import { ModuleNav } from "@/components/ui/ModuleNav";
import { obterOuSemearDepartamentosCadastro, obterOuSemearLojasCadastro } from "@/lib/parametros/store";

// Cadastro é editado por fora do build — nunca pré-renderizar com dados presos ao momento do build.
export const dynamic = "force-dynamic";

export default async function ParametrosPage() {
  const [lojas, departamentos] = await Promise.all([
    obterOuSemearLojasCadastro(),
    obterOuSemearDepartamentosCadastro(),
  ]);

  return (
    <div className="flex min-h-full flex-col">
      <ModuleNav />
      <main className="mx-auto w-full max-w-[1800px] flex-1 px-6 py-6">
        <ParametrosDashboard lojasIniciais={lojas} departamentosIniciais={departamentos} />
      </main>
    </div>
  );
}
