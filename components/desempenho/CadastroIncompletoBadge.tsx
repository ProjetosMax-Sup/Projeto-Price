"use client";

import { baixarBlob } from "@/lib/desempenho/export";

export function CadastroIncompletoBadge({ quantidade, codigos }: { quantidade: number; codigos: string[] }) {
  if (quantidade === 0) return null;

  function aoClicar() {
    const cabecalho = `Produtos com cadastro pendente (Hierarquia de Grupos incompleta) — gerado em ${new Date().toLocaleString("pt-BR")}`;
    const conteudo = [cabecalho, "", ...codigos].join("\n");
    baixarBlob(new Blob([conteudo], { type: "text/plain;charset=utf-8" }), "produtos-cadastro-pendente.txt");
  }

  return (
    <button
      type="button"
      onClick={aoClicar}
      title="Produtos com hierarquia mercadológica incompleta e movimentação no período — excluídos dos números até serem corrigidos. Clique para baixar a lista de códigos."
      className="inline-flex items-center gap-1.5 rounded-full bg-vermelho/10 px-2.5 py-1 text-xs font-medium text-vermelho hover:bg-vermelho/20"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-vermelho" />
      {quantidade} {quantidade === 1 ? "produto" : "produtos"} com cadastro pendente
    </button>
  );
}
