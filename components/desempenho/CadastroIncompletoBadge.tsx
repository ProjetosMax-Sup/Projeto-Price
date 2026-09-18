export function CadastroIncompletoBadge({ quantidade }: { quantidade: number }) {
  if (quantidade === 0) return null;

  return (
    <span
      title="Produtos com hierarquia mercadológica incompleta e movimentação no período — excluídos dos números até serem corrigidos."
      className="inline-flex items-center gap-1.5 rounded-full bg-vermelho/10 px-2.5 py-1 text-xs font-medium text-vermelho"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-vermelho" />
      {quantidade} {quantidade === 1 ? "produto" : "produtos"} com cadastro pendente
    </span>
  );
}
