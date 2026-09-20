import { NextResponse } from "next/server";
import { getDataProvider } from "@/lib/data-providers";
import { obterUsuarioAtual } from "@/lib/auth/usuario-atual";
import { computarDesempenho, type ConsultaDesempenho } from "@/lib/desempenho/consulta";
import { construirIndiceDepartamentos } from "@/lib/desempenho/comprador-cadastro";
import { datasDisponiveis } from "@/lib/desempenho/datas";
import { lojasDoCadastro } from "@/lib/desempenho/loja-cadastro";
import {
  obterOuSemearConfigRelatorio,
  obterOuSemearDepartamentosCadastro,
  obterOuSemearLojasCadastro,
} from "@/lib/parametros/store";
import type { RegistroDesempenho } from "@/lib/types";

// Numa instância "fria" (sem cache ainda), pode precisar rebaixar os arquivos
// do OneDrive de novo — 60s é o teto do plano Hobby.
export const maxDuration = 60;

// Mesmo checkpoint de acesso da página (seção 3.3) — refeito aqui porque o client re-consulta
// esta rota a cada mudança de filtro/drill-down, não só na 1ª carga.
async function obterAcesso() {
  const [usuario, config] = await Promise.all([obterUsuarioAtual(), obterOuSemearConfigRelatorio("desempenho-comercial")]);
  const temAcesso =
    !!usuario &&
    (usuario.perfil === "Gestor"
      ? config.acessoGestor
      : config.acessoComprador && usuario.departamentos.length > 0 && usuario.lojas.length > 0);
  return temAcesso ? usuario : null;
}

function registrosPermitidos(registros: RegistroDesempenho[], usuario: NonNullable<Awaited<ReturnType<typeof obterAcesso>>>) {
  if (usuario.perfil === "Gestor") return registros;
  return registros.filter(
    (r) => r.produto && usuario.departamentos.includes(r.produto.dpto) && r.loja && usuario.lojas.includes(r.loja.codUnid),
  );
}

export async function POST(request: Request) {
  const usuario = await obterAcesso();
  if (!usuario) return NextResponse.json({ erro: "Sem acesso a este relatório." }, { status: 403 });

  let consulta: ConsultaDesempenho;
  try {
    consulta = await request.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido" }, { status: 400 });
  }

  const provider = getDataProvider();
  const [lojasCadastro, departamentosCadastro, desempenho] = await Promise.all([
    obterOuSemearLojasCadastro(),
    obterOuSemearDepartamentosCadastro(),
    provider.getDesempenho(),
  ]);

  const registros = registrosPermitidos(desempenho.registros, usuario);
  const resultado = computarDesempenho(registros, lojasDoCadastro(lojasCadastro), consulta, construirIndiceDepartamentos(departamentosCadastro));
  return NextResponse.json(resultado);
}

/**
 * Datas (ISO, distintas) existentes no conjunto de movimento — só isso, nunca os registros
 * brutos — pra validar no cliente os seletores de período sem round-trip a cada data digitada.
 * Atual e Comparação compartilham o mesmo conjunto (união de todos os meses disponíveis).
 */
export async function GET() {
  const usuario = await obterAcesso();
  if (!usuario) return NextResponse.json({ erro: "Sem acesso a este relatório." }, { status: 403 });

  const provider = getDataProvider();
  const desempenho = await provider.getDesempenho();
  const registros = registrosPermitidos(desempenho.registros, usuario);

  return NextResponse.json({ datas: datasDisponiveis(registros) });
}
