export function ThOrdenavel<C extends string>({
  coluna,
  ordenacao,
  onClick,
  className,
  largura,
  align = "right",
  children,
}: {
  coluna: C;
  ordenacao: { coluna: C; dir: 1 | -1 } | null;
  onClick: (coluna: C) => void;
  className: string;
  /** Largura fixa em px — permite o rótulo quebrar em vez de alargar a coluna. */
  largura?: number;
  align?: "left" | "right";
  children: React.ReactNode;
}) {
  const ativo = ordenacao?.coluna === coluna;
  return (
    <th className={className} style={largura ? { width: largura, maxWidth: largura } : undefined}>
      <button
        type="button"
        onClick={() => onClick(coluna)}
        className={`flex w-full items-start gap-1 leading-tight hover:text-white ${align === "right" ? "justify-end text-right" : "justify-start text-left"}`}
      >
        <span>{children}</span>
        <span className="mt-0.5 shrink-0 text-[9px] text-white/60">{ativo ? (ordenacao!.dir === 1 ? "▲" : "▼") : "⇅"}</span>
      </button>
    </th>
  );
}
