"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Botão "PDF por Comprador" — gera um relatório por pessoa com o que ela deve
 * tratar no período, pra mandar ao time Comercial enquanto eles ainda não
 * acessam a plataforma (pedido de 2026-10-01).
 *
 * Aparece **só pra quem a rota autoriza** (ver
 * `app/api/compra-venda/pdf-comprador/route.ts` > "Acesso"): o componente
 * pergunta antes de se desenhar e some sozinho quando a resposta é não.
 * Enquanto o relatório está em validação isso é só você — não dá pra deixar um
 * botão que gera PDF de todo mundo visível pra todo mundo.
 *
 * O trabalho pesado é todo no servidor: aqui só se dispara o download do que
 * voltar (um PDF, ou um ZIP quando é mais de um comprador).
 */
export function BotaoPdfComprador({
  meses,
  lojas,
  formato,
  formatosDisponiveis,
}: {
  meses: string[];
  lojas: string[];
  /** Formato selecionado na tela; "Todos" vira os dois no PDF (cada um no seu bloco). */
  formato: string | null;
  formatosDisponiveis: string[];
}) {
  const [habilitado, setHabilitado] = useState(false);
  const [compradores, setCompradores] = useState<string[]>([]);
  const [escolhido, setEscolhido] = useState<string>("");
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let vivo = true;
    fetch("/api/compra-venda/pdf-comprador")
      .then((r) => r.json())
      .then((dados: { habilitado: boolean; compradores: string[] }) => {
        if (!vivo) return;
        setHabilitado(Boolean(dados.habilitado));
        setCompradores(dados.compradores ?? []);
      })
      .catch(() => {
        if (vivo) setHabilitado(false);
      });
    return () => {
      vivo = false;
    };
  }, []);

  useEffect(() => () => abortRef.current?.abort(), []);

  if (!habilitado) return null;

  async function gerar() {
    setGerando(true);
    setErro(null);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const resposta = await fetch("/api/compra-venda/pdf-comprador", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          meses,
          lojas,
          compradores: escolhido ? [escolhido] : [],
          // "Todos" na tela significa somar os formatos; no PDF significa um
          // bloco pra cada, porque a meta é cadastrada por Formato.
          formatos: formato && formato !== "Todos" ? [formato] : formatosDisponiveis,
        }),
      });
      if (!resposta.ok) {
        const detalhe = await resposta.json().catch(() => null);
        throw new Error(detalhe?.erro ?? `Falha ao gerar (${resposta.status})`);
      }
      const blob = await resposta.blob();
      const nome =
        resposta.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ??
        (blob.type === "application/zip" ? "compra-venda-compradores.zip" : "compra-venda-comprador.pdf");
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = nome;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      if ((e as Error).name !== "AbortError") setErro((e as Error).message);
    } finally {
      setGerando(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={escolhido}
        onChange={(e) => setEscolhido(e.target.value)}
        className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-700"
        aria-label="Comprador do PDF"
      >
        <option value="">Todos os compradores</option>
        {compradores.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={gerar}
        disabled={gerando || meses.length === 0}
        className="rounded-md bg-azul px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-azul/90 disabled:cursor-not-allowed disabled:opacity-50"
        title="Gera um PDF por comprador com o que tratar no período — uso interno, em validação"
      >
        {gerando ? "Gerando…" : "PDF por Comprador"}
      </button>
      {erro && <span className="text-xs text-vermelho">{erro}</span>}
    </div>
  );
}
