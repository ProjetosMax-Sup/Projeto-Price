import { ParametrosDashboard } from "@/components/parametros/ParametrosDashboard";
import { ModuleNav } from "@/components/ui/ModuleNav";
import { obterGestorAtual } from "@/lib/auth/exigir-gestor";
import {
  obterOuSemearDepartamentosCadastro,
  obterOuSemearDicionarioColunas,
  obterOuSemearLojasCadastro,
} from "@/lib/parametros/store";

// Cadastro é editado por fora do build — nunca pré-renderizar com dados presos ao momento do build.
export const dynamic = "force-dynamic";

export default async function ParametrosPage() {
  const gestor = await obterGestorAtual();
  if (!gestor) {
    return (
      <div className="flex min-h-full flex-col">
        <ModuleNav />
        <main className="mx-auto flex w-full max-w-[1800px] flex-1 items-center justify-center px-6 py-6">
          <p className="text-sm text-zinc-500">Acesso restrito a Gestores.</p>
        </main>
      </div>
    );
  }

  const [lojas, departamentos, dicionario] = await Promise.all([
    obterOuSemearLojasCadastro(),
    obterOuSemearDepartamentosCadastro(),
    obterOuSemearDicionarioColunas(),
  ]);

  return (
    <div className="flex min-h-full flex-col">
      <ModuleNav />
      <main className="mx-auto w-full max-w-[1800px] flex-1 px-6 py-6">
        <ParametrosDashboard lojasIniciais={lojas} departamentosIniciais={departamentos} dicionarioInicial={dicionario} />
      </main>
    </div>
  );
}
