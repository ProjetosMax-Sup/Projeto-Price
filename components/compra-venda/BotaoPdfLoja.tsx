"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Botão "PDF por Loja" — Total da rede + um bloco por Loja, mesmas colunas da
 * tela (pedido de 2026-10-02: substitui a planilha que o time montava à mão,
 * ver `docs/exemplos-pdf`). Espelho de `BotaoPdfComprador.tsx`, sem seletor —
 * usa o recorte já escolhido na tela (meses, loja(s), formato).
 *
 * Mesma porta de acesso de PDF por Comprador (`pdf-comprador/route.ts` >
 * "Acesso"): aparece só pra quem a rota autoriza, e some sozinho quando não.
 */
export function BotaoPdfLoja({
  meses,
  lojas,
  formato,
}: {
  meses: string[];
  lojas: string[];
  /** "Todos" não serve aqui: a meta é cadastrada por Formato, então o PDF
   * exige um formato concreto escolhido na tela. */
  formato: string | null;
}) {
  const [habilitado, setHabilitado] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let vivo = true;
    fetch("/api/compra-venda/pdf-loja")
      .then((r) => r.json())
      .then((dados: { habilitado: boolean }) => {
        if (vivo) setHabilitado(Boolean(dados.habilitado));
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

  const formatoValido = formato && formato !== "Todos";

  async function gerar() {
    setGerando(true);
    setErro(null);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const resposta = await fetch("/api/compra-venda/pdf-loja", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ meses, lojas, formato }),
      });
      if (!resposta.ok) {
        const detalhe = await resposta.json().catch(() => null);
        throw new Error(detalhe?.erro ?? `Falha ao gerar (${resposta.status})`);
      }
      const blob = await resposta.blob();
      const nome =
        resposta.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ?? "compra-venda-por-loja.pdf";
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
      <button
        type="button"
        onClick={gerar}
        disabled={gerando || meses.length === 0 || !formatoValido}
        className="rounded-md bg-azul px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-azul/90 disabled:cursor-not-allowed disabled:opacity-50"
        title={
          formatoValido
            ? "Gera um PDF com o Total da rede e um bloco por Loja — uso interno, em validação"
            : "Escolha um Formato (Varejo ou Atacado) pra gerar o PDF"
        }
      >
        {gerando ? "Gerando…" : "PDF por Loja"}
      </button>
      {erro && <span className="text-xs text-vermelho">{erro}</span>}
    </div>
  );
}
