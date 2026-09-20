"use client";

import { useState } from "react";
import { MultiSelect } from "@/components/ui/MultiSelect";
import type { UsuarioCadastro } from "@/lib/parametros/types";

function pendenciaAcesso(usuario: UsuarioCadastro): boolean {
  if (usuario.perfil !== "Comprador") return false;
  return usuario.departamentos.length === 0 || usuario.lojas.length === 0;
}

const USUARIO_VAZIO: UsuarioCadastro = { usuario: "", nome: "", perfil: "Comprador", departamentos: [], lojas: [] };

export function UsuariosTable({
  usuarios,
  onChange,
  departamentosOpcoes,
  lojasOpcoes,
  statusContasIniciais,
}: {
  usuarios: UsuarioCadastro[];
  onChange: (usuarios: UsuarioCadastro[]) => void;
  departamentosOpcoes: { value: string; label: string }[];
  lojasOpcoes: { value: string; label: string }[];
  statusContasIniciais: Record<string, boolean>;
}) {
  const [salvando, setSalvando] = useState(false);
  const [erros, setErros] = useState<string[]>([]);
  const [salvoEm, setSalvoEm] = useState<string | null>(null);
  const [contaBanida, setContaBanida] = useState<Record<string, boolean>>(statusContasIniciais);
  const [linhaEmAcao, setLinhaEmAcao] = useState<string | null>(null);
  const [erroAcao, setErroAcao] = useState<string | null>(null);

  const [criando, setCriando] = useState(false);
  const [novoUsuario, setNovoUsuario] = useState<UsuarioCadastro>(USUARIO_VAZIO);
  const [novaSenhaCriacao, setNovaSenhaCriacao] = useState("");
  const [erroCriacao, setErroCriacao] = useState<string | null>(null);

  const [senhaEmEdicaoDe, setSenhaEmEdicaoDe] = useState<string | null>(null);
  const [novaSenha, setNovaSenha] = useState("");

  function atualizar(index: number, patch: Partial<UsuarioCadastro>) {
    onChange(usuarios.map((usuario, i) => (i === index ? { ...usuario, ...patch } : usuario)));
    setSalvoEm(null);
  }

  function remover(index: number) {
    const usuario = usuarios[index];
    if (
      !confirm(
        `Remover o acesso de "${usuario.nome || usuario.usuario}" desta lista? Isso NÃO apaga a conta no Clerk — use "Desativar" pra isso.`,
      )
    )
      return;
    onChange(usuarios.filter((_, i) => i !== index));
    setSalvoEm(null);
  }

  async function salvar() {
    setSalvando(true);
    setErros([]);
    try {
      const resposta = await fetch("/api/parametros/usuarios", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(usuarios),
      });
      const corpo = await resposta.json();
      if (!resposta.ok) {
        setErros(corpo.erros ?? [corpo.erro ?? "Falha ao salvar."]);
        return;
      }
      setSalvoEm(new Date().toLocaleTimeString("pt-BR"));
    } finally {
      setSalvando(false);
    }
  }

  async function criarUsuario() {
    setErroCriacao(null);
    if (novoUsuario.perfil === "Comprador" && (!novoUsuario.departamentos.length || !novoUsuario.lojas.length)) {
      setErroCriacao("Sem Departamento e Loja, este comprador não acessa nenhum dado.");
      return;
    }
    setLinhaEmAcao("__criar__");
    try {
      const resposta = await fetch("/api/parametros/usuarios/criar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...novoUsuario, senha: novaSenhaCriacao }),
      });
      const corpo = await resposta.json();
      if (!resposta.ok) {
        setErroCriacao(corpo.erro ?? "Falha ao criar usuário.");
        return;
      }
      onChange(corpo as UsuarioCadastro[]);
      setContaBanida((atual) => ({ ...atual, [novoUsuario.usuario]: false }));
      setCriando(false);
      setNovoUsuario(USUARIO_VAZIO);
      setNovaSenhaCriacao("");
    } finally {
      setLinhaEmAcao(null);
    }
  }

  async function confirmarTrocaSenha(usuario: string) {
    setErroAcao(null);
    if (!novaSenha || novaSenha.length < 8) {
      setErroAcao("Senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    setLinhaEmAcao(usuario);
    try {
      const resposta = await fetch("/api/parametros/usuarios/senha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario, novaSenha }),
      });
      const corpo = await resposta.json();
      if (!resposta.ok) {
        setErroAcao(corpo.erro ?? "Falha ao trocar senha.");
        return;
      }
      setSenhaEmEdicaoDe(null);
      setNovaSenha("");
    } finally {
      setLinhaEmAcao(null);
    }
  }

  async function alternarStatus(usuario: string, bloquearAgora: boolean) {
    setErroAcao(null);
    setLinhaEmAcao(usuario);
    try {
      const resposta = await fetch("/api/parametros/usuarios/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario, bloquear: bloquearAgora }),
      });
      const corpo = await resposta.json();
      if (!resposta.ok) {
        setErroAcao(corpo.erro ?? "Falha ao mudar status.");
        return;
      }
      setContaBanida((atual) => ({ ...atual, [usuario]: bloquearAgora }));
    } finally {
      setLinhaEmAcao(null);
    }
  }

  const temPendencia = usuarios.some(pendenciaAcesso);

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-lg border border-zinc-200">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-azul text-white">
              <th className="w-40 px-3 py-2 text-left font-medium">Usuário</th>
              <th className="w-44 px-3 py-2 text-left font-medium">Nome</th>
              <th className="w-32 px-3 py-2 text-left font-medium">Perfil</th>
              <th className="px-3 py-2 text-left font-medium">Departamentos</th>
              <th className="px-3 py-2 text-left font-medium">Lojas</th>
              <th className="w-24 px-3 py-2 text-left font-medium">Conta</th>
              <th className="w-56 px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {usuarios.map((usuario, index) => {
              const pendente = pendenciaAcesso(usuario);
              const banido = contaBanida[usuario.usuario] ?? false;
              const emAcao = linhaEmAcao === usuario.usuario;
              return (
                <tr key={usuario.usuario || index} className={index % 2 === 1 ? "bg-zinc-50" : undefined}>
                  <td className="px-3 py-1.5 align-top text-zinc-700">{usuario.usuario}</td>
                  <td className="px-3 py-1.5 align-top">
                    <input
                      value={usuario.nome}
                      onChange={(e) => atualizar(index, { nome: e.target.value })}
                      className="w-full rounded border border-zinc-300 px-2 py-1"
                    />
                  </td>
                  <td className="px-3 py-1.5 align-top">
                    <select
                      value={usuario.perfil}
                      onChange={(e) => atualizar(index, { perfil: e.target.value as UsuarioCadastro["perfil"] })}
                      className="w-full rounded border border-zinc-300 px-2 py-1"
                    >
                      <option value="Comprador">Comprador</option>
                      <option value="Gestor">Gestor</option>
                    </select>
                  </td>
                  <td className="px-3 py-1.5 align-top">
                    {usuario.perfil === "Comprador" ? (
                      <div className={pendente && usuario.departamentos.length === 0 ? "rounded ring-1 ring-vermelho" : undefined}>
                        <MultiSelect
                          rotulo="Departamentos"
                          opcoes={departamentosOpcoes}
                          selecionados={usuario.departamentos}
                          onChange={(valores) => atualizar(index, { departamentos: valores })}
                          rotuloTodos="Nenhum"
                        />
                      </div>
                    ) : (
                      <span className="text-xs text-zinc-400">Vê tudo (Gestor)</span>
                    )}
                  </td>
                  <td className="px-3 py-1.5 align-top">
                    {usuario.perfil === "Comprador" ? (
                      <div className={pendente && usuario.lojas.length === 0 ? "rounded ring-1 ring-vermelho" : undefined}>
                        <MultiSelect
                          rotulo="Lojas"
                          opcoes={lojasOpcoes}
                          selecionados={usuario.lojas}
                          onChange={(valores) => atualizar(index, { lojas: valores })}
                          rotuloTodos="Nenhuma"
                        />
                      </div>
                    ) : (
                      <span className="text-xs text-zinc-400">Vê tudo (Gestor)</span>
                    )}
                  </td>
                  <td className="px-3 py-1.5 align-top">
                    <span
                      className={[
                        "rounded px-2 py-0.5 text-xs font-medium",
                        banido ? "bg-vermelho/10 text-vermelho" : "bg-verde/10 text-verde",
                      ].join(" ")}
                    >
                      {banido ? "Desativado" : "Ativo"}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 align-top">
                    {senhaEmEdicaoDe === usuario.usuario ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="password"
                          value={novaSenha}
                          onChange={(e) => setNovaSenha(e.target.value)}
                          placeholder="Nova senha"
                          className="w-28 rounded border border-zinc-300 px-2 py-1 text-sm"
                        />
                        <button
                          onClick={() => confirmarTrocaSenha(usuario.usuario)}
                          disabled={emAcao}
                          className="rounded bg-azul px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
                        >
                          OK
                        </button>
                        <button
                          onClick={() => {
                            setSenhaEmEdicaoDe(null);
                            setNovaSenha("");
                          }}
                          className="text-xs text-zinc-400 hover:text-zinc-600"
                        >
                          cancelar
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <button
                          onClick={() => setSenhaEmEdicaoDe(usuario.usuario)}
                          className="font-medium text-azul hover:underline"
                        >
                          Trocar senha
                        </button>
                        <button
                          onClick={() => alternarStatus(usuario.usuario, !banido)}
                          disabled={emAcao}
                          className={["font-medium hover:underline disabled:opacity-50", banido ? "text-verde" : "text-vermelho"].join(
                            " ",
                          )}
                        >
                          {banido ? "Reativar" : "Desativar"}
                        </button>
                        <button onClick={() => remover(index)} className="text-zinc-400 hover:text-vermelho">
                          remover
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {erroAcao && <p className="text-sm text-vermelho">{erroAcao}</p>}

      <div className="flex items-center gap-3">
        <button
          onClick={() => setCriando((v) => !v)}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
        >
          {criando ? "Cancelar" : "+ Criar usuário"}
        </button>
        <button
          onClick={salvar}
          disabled={salvando || temPendencia}
          title={temPendencia ? "Preencha Departamento(s) e Loja(s) dos compradores antes de salvar." : undefined}
          className="rounded-md bg-azul px-4 py-1.5 text-sm font-medium text-white hover:bg-azul/90 disabled:opacity-50"
        >
          {salvando ? "Salvando..." : "Salvar alterações"}
        </button>
        {salvoEm && <span className="text-sm text-verde">Salvo às {salvoEm}.</span>}
        {temPendencia && (
          <span className="rounded bg-vermelho/10 px-2 py-1 text-xs font-medium text-vermelho">
            Sem isso, algum comprador não acessa nenhum dado
          </span>
        )}
      </div>

      {criando && (
        <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
          <p className="text-sm font-medium text-zinc-700">
            Cria a conta de acesso (Clerk) e o registro de permissão numa única ação.
          </p>
          <div className="flex flex-wrap gap-3">
            <input
              value={novoUsuario.usuario}
              onChange={(e) => setNovoUsuario((v) => ({ ...v, usuario: e.target.value }))}
              placeholder="Usuário (ex.: joaosilva)"
              className="w-48 rounded border border-zinc-300 px-2 py-1.5 text-sm"
            />
            <input
              value={novoUsuario.nome}
              onChange={(e) => setNovoUsuario((v) => ({ ...v, nome: e.target.value }))}
              placeholder="Nome"
              className="w-48 rounded border border-zinc-300 px-2 py-1.5 text-sm"
            />
            <input
              type="password"
              value={novaSenhaCriacao}
              onChange={(e) => setNovaSenhaCriacao(e.target.value)}
              placeholder="Senha inicial (mín. 8)"
              className="w-48 rounded border border-zinc-300 px-2 py-1.5 text-sm"
            />
            <select
              value={novoUsuario.perfil}
              onChange={(e) => setNovoUsuario((v) => ({ ...v, perfil: e.target.value as UsuarioCadastro["perfil"] }))}
              className="rounded border border-zinc-300 px-2 py-1.5 text-sm"
            >
              <option value="Comprador">Comprador</option>
              <option value="Gestor">Gestor</option>
            </select>
          </div>
          {novoUsuario.perfil === "Comprador" && (
            <div className="flex flex-wrap gap-3">
              <MultiSelect
                rotulo="Departamentos"
                opcoes={departamentosOpcoes}
                selecionados={novoUsuario.departamentos}
                onChange={(valores) => setNovoUsuario((v) => ({ ...v, departamentos: valores }))}
                rotuloTodos="Nenhum"
              />
              <MultiSelect
                rotulo="Lojas"
                opcoes={lojasOpcoes}
                selecionados={novoUsuario.lojas}
                onChange={(valores) => setNovoUsuario((v) => ({ ...v, lojas: valores }))}
                rotuloTodos="Nenhuma"
              />
            </div>
          )}
          <div className="flex items-center gap-3">
            <button
              onClick={criarUsuario}
              disabled={linhaEmAcao === "__criar__" || !novoUsuario.usuario.trim() || !novoUsuario.nome.trim()}
              className="rounded-md bg-azul px-4 py-1.5 text-sm font-medium text-white hover:bg-azul/90 disabled:opacity-50"
            >
              {linhaEmAcao === "__criar__" ? "Criando..." : "Criar"}
            </button>
            {erroCriacao && <span className="text-sm text-vermelho">{erroCriacao}</span>}
          </div>
        </div>
      )}

      {erros.length > 0 && (
        <ul className="rounded-md bg-vermelho/10 px-3 py-2 text-sm text-vermelho">
          {erros.map((erro) => (
            <li key={erro}>{erro}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
