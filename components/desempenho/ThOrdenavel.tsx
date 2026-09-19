export function ThOrdenavel<C extends string>({
  coluna,
  ordenacao,
  onClick,
  className,
  largura,
  stickyTop,
  align = "center",
  children,
}: {
  coluna: C;
  ordenacao: { coluna: C; dir: 1 | -1 } | null;
  onClick: (coluna: C) => void;
  className: string;
  /** Largura fixa em px — permite o rótulo quebrar em vez de alargar a coluna. */
  largura?: number;
  /** Offset (px) do `position: sticky` vertical — soma da altura do nav + do bloco Filtros+KPIs. */
  stickyTop?: number;
  align?: "left" | "center" | "right";
  children: React.ReactNode;
}) {
  const ativo = ordenacao?.coluna === coluna;
  const justifica =
    align === "right" ? "justify-end text-right" : align === "left" ? "justify-start text-left" : "justify-center text-center";
  const style = {
    ...(largura ? { width: largura, maxWidth: largura } : undefined),
    ...(stickyTop !== undefined ? { top: stickyTop } : undefined),
  };
  return (
    <th className={className} style={Object.keys(style).length > 0 ? style : undefined}>
      <button type="button" onClick={() => onClick(coluna)} className={`flex w-full items-start gap-1 leading-tight hover:text-white ${justifica}`}>
        <span>{children}</span>
        <span className="mt-0.5 shrink-0 text-[9px] text-white/60">{ativo ? (ordenacao!.dir === 1 ? "▲" : "▼") : "⇅"}</span>
      </button>
    </th>
  );
}
