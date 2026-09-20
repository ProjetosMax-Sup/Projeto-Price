import { ParametrosDashboard } from "@/components/parametros/ParametrosDashboard";
import { ModuleNav } from "@/components/ui/ModuleNav";
import { obterGestorAtual } from "@/lib/auth/exigir-gestor";
import { statusClerkPorUsuario } from "@/lib/auth/clerk-admin";
import {
  obterOuSemearDepartamentosCadastro,
  obterOuSemearDicionarioColunas,
  obterOuSemearLojasCadastro,
  obterOuSemearUsuariosCadastro,
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
          <p className="text-sm text-zinc-500">
            Acesso restrito a Gestores. Se você deveria ter acesso, peça pra um Gestor te cadastrar em Parâmetros.
          </p>
        </main>
      </div>
    );
  }

  const [lojas, departamentos, usuarios, dicionario] = await Promise.all([
    obterOuSemearLojasCadastro(),
    obterOuSemearDepartamentosCadastro(),
    obterOuSemearUsuariosCadastro(),
    obterOuSemearDicionarioColunas(),
  ]);
  const statusContas = await statusClerkPorUsuario(usuarios.map((u) => u.usuario));

  return (
    <div className="flex min-h-full flex-col">
      <ModuleNav />
      <main className="mx-auto w-full max-w-[1800px] flex-1 px-6 py-6">
        <ParametrosDashboard
          lojasIniciais={lojas}
          departamentosIniciais={departamentos}
          usuariosIniciais={usuarios}
          statusContasIniciais={statusContas}
          dicionarioInicial={dicionario}
        />
      </main>
    </div>
  );
}
