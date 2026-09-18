export function ThOrdenavel<C extends string>({
  coluna,
  ordenacao,
  onClick,
  className,
  children,
}: {
  coluna: C;
  ordenacao: { coluna: C; dir: 1 | -1 } | null;
  onClick: (coluna: C) => void;
  className: string;
  children: React.ReactNode;
}) {
  const ativo = ordenacao?.coluna === coluna;
  return (
    <th className={className}>
      <button type="button" onClick={() => onClick(coluna)} className="inline-flex items-center gap-0.5 whitespace-nowrap hover:text-white">
        {children}
        <span className="text-[9px] text-white/60">{ativo ? (ordenacao!.dir === 1 ? "▲" : "▼") : "⇅"}</span>
      </button>
    </th>
  );
}
