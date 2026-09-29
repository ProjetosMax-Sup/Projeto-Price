"use client";

import { useEffect, useState } from "react";
import { AtivasTab } from "@/components/parametros/relatorio/AtivasTab";
import { CalculadasTab } from "@/components/parametros/relatorio/CalculadasTab";
import { NativasTab } from "@/components/parametros/relatorio/NativasTab";
import { podePublicar, refsNativasInexistentes } from "@/lib/parametros/colunas-relatorio";
import type { ColunaNativa, ConfigRelatorio } from "@/lib/parametros/types";

const MODULOS = [
  { slug: "desempenho-comercial", label: "Desempenho Comercial", implementado: true },
  { slug: "entradas-saidas", label: "Entradas e Saídas", implementado: true },
  { slug: "compra-venda", label: "Compra e Venda", implementado: false },
  { slug: "perdas-quebras", label: "Perdas e Quebras", implementado: false },
  { slug: "raio-x-fornecedor", label: "Raio X Fornecedor", implementado: false },
] as const;

const SUBABAS = [
  { valor: "nativas", label: "Nativas" },
  { valor: "calculadas", label: "Calculadas" },
  { valor: "ativas", label: "Ativas" },
] as const;

export function RelatorioColunasPanel({ dicionario }: { dicionario: ColunaNativa[] }) {
  const [modulo, setModulo] = useState<(typeof MODULOS)[number]["slug"]>("desempenho-comercial");
  const [subaba, setSubaba] = useState<(typeof SUBABAS)[number]["valor"]>("nativas");
  const [config, setConfig] = useState<ConfigRelatorio | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvoEm, setSalvoEm] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    fetch(`/api/parametros/relatorios/${modulo}`)
      .then((r) => r.json())
      .then((c) => {
        if (!cancelado) setConfig(c);
      });
    return () => {
      cancelado = true;
    };
  }, [modulo]);

  async function salvar(paraSalvar: ConfigRelatorio) {
    setSalvando(true);
    setErro(null);
    try {
      const resposta = await fetch(`/api/parametros/relatorios/${modulo}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(paraSalvar),
      });
      const corpo = await resposta.json();
      if (!resposta.ok) {
        setErro(corpo.erro ?? "Falha ao salvar.");
        return;
      }
      setConfig(corpo);
      setSalvoEm(new Date().toLocaleTimeString("pt-BR"));
    } finally {
      setSalvando(false);
    }
  }

  if (!config || config.modulo !== modulo) return <p className="text-sm text-zinc-400">Carregando...</p>;

  const publicavel = podePublicar(config);
  // O arquivo do ERP pode mudar de layout e levar embora uma coluna que alguma
  // fórmula usa — aparece aqui em vez de virar número errado na tela.
  const colunasSumidas = refsNativasInexistentes(config, dicionario);

  return (
    <div className="flex flex-col gap-4">
      {colunasSumidas.length > 0 && (
        <p className="rounded-lg border border-vermelho/30 bg-vermelho/5 px-4 py-3 text-sm text-vermelho">
          Este relatório usa {colunasSumidas.length === 1 ? "uma coluna que não existe" : "colunas que não existem"} mais
          no arquivo do ERP: <strong>{colunasSumidas.join(", ")}</strong>. Confira a exportação — se a mudança for
          permanente, troque {colunasSumidas.length === 1 ? "essa coluna" : "essas colunas"} nas fórmulas que{" "}
          {colunasSumidas.length === 1 ? "a" : "as"} usam.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {MODULOS.map((m) => (
          <button
            key={m.slug}
            disabled={!m.implementado}
            onClick={() => {
              setModulo(m.slug);
              setSubaba("nativas");
              setSalvoEm(null);
              setErro(null);
            }}
            className={[
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              modulo === m.slug ? "bg-azul text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200",
              !m.implementado && "cursor-not-allowed opacity-40",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-4 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3">
        <span className="text-sm font-medium text-zinc-600">Quem acessa este relatório:</span>
        <label className="flex items-center gap-1.5 text-sm text-zinc-700">
          <input
            type="checkbox"
            checked={config.acessoGestor}
            onChange={(e) => setConfig({ ...config, acessoGestor: e.target.checked })}
            className="accent-azul"
          />
          Gestor
        </label>
        <label className="flex items-center gap-1.5 text-sm text-zinc-700">
          <input
            type="checkbox"
            checked={config.acessoComprador}
            onChange={(e) => setConfig({ ...config, acessoComprador: e.target.checked })}
            className="accent-azul"
          />
          Comprador (com Departamento/Loja liberados em Usuários)
        </label>

        <span className="ml-auto flex items-center gap-2">
          <span
            className={[
              "rounded px-2 py-0.5 text-xs font-medium",
              config.status === "Publicado" ? "bg-verde/10 text-verde" : "bg-zinc-200 text-zinc-600",
            ].join(" ")}
          >
            {config.status}
          </span>
          <button
            onClick={() => salvar({ ...config, status: config.status === "Publicado" ? "Rascunho" : "Publicado" })}
            disabled={salvando || (config.status === "Rascunho" && !publicavel)}
            title={
              config.status === "Rascunho" && !publicavel
                ? "Existe coluna calculada dependendo de coluna excluída — corrija na aba Calculadas antes de publicar."
                : undefined
            }
            className="rounded-md border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-40"
          >
            {config.status === "Publicado" ? "Voltar pra Rascunho" : "Publicar"}
          </button>
          <button
            disabled
            title='Disponível quando este relatório migrar pra consumir esta configuração (ainda roda com a lógica antiga — ver "Migração do Desempenho Comercial" em docs/parametros.md).'
            className="rounded-md border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-400"
          >
            Reprocessar agora
          </button>
        </span>
      </div>

      <div className="flex gap-1 border-b border-zinc-200">
        {SUBABAS.map((s) => (
          <button
            key={s.valor}
            onClick={() => setSubaba(s.valor)}
            className={[
              "rounded-t-md px-4 py-2 text-sm font-medium transition-colors",
              subaba === s.valor ? "bg-azul text-white" : "text-zinc-600 hover:bg-zinc-100",
            ].join(" ")}
          >
            {s.label}
          </button>
        ))}
      </div>

      {subaba === "nativas" && <NativasTab dicionario={dicionario} config={config} onChange={setConfig} />}
      {subaba === "calculadas" && <CalculadasTab dicionario={dicionario} config={config} onChange={setConfig} />}
      {subaba === "ativas" && <AtivasTab dicionario={dicionario} config={config} onChange={setConfig} />}

      <div className="flex items-center gap-3">
        <button
          onClick={() => salvar(config)}
          disabled={salvando}
          className="rounded-md bg-azul px-4 py-1.5 text-sm font-medium text-white hover:bg-azul/90 disabled:opacity-50"
        >
          {salvando ? "Salvando..." : "Salvar alterações"}
        </button>
        {salvoEm && <span className="text-sm text-verde">Salvo às {salvoEm}.</span>}
        {erro && <span className="text-sm text-vermelho">{erro}</span>}
      </div>
    </div>
  );
}
