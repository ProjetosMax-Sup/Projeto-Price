"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function FormularioLogin() {
  const router = useRouter();
  const params = useSearchParams();
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function aoSubmeter(evento: FormEvent) {
    evento.preventDefault();
    setEnviando(true);
    setErro(null);
    try {
      const resposta = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senha }),
      });
      if (!resposta.ok) {
        const dados = await resposta.json().catch(() => ({}));
        setErro(dados.erro ?? "Senha incorreta");
        return;
      }
      router.push(params.get("proximo") || "/");
      router.refresh();
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex min-h-full flex-1 items-center justify-center bg-zinc-50 px-6">
      <form
        onSubmit={aoSubmeter}
        className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-6 shadow-sm"
      >
        <h1 className="font-display text-xl font-bold text-zinc-900">
          MAX <span className="text-vermelho">Supermercados</span>
        </h1>
        <p className="mt-1 text-sm text-zinc-500">Acesso restrito ao time Comercial.</p>

        <label className="mt-5 block text-sm font-medium text-zinc-700">
          Senha
          <input
            type="password"
            autoFocus
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-azul focus:outline-none"
          />
        </label>

        {erro && <p className="mt-2 text-sm text-vermelho">{erro}</p>}

        <button
          type="submit"
          disabled={enviando || senha.length === 0}
          className="mt-4 w-full rounded-md bg-azul px-4 py-2 text-sm font-semibold text-white hover:bg-azul/90 disabled:opacity-50"
        >
          {enviando ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <FormularioLogin />
    </Suspense>
  );
}
