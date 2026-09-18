import { formatPercent, formatPontosPercentuais } from "@/lib/desempenho/format";

export function Semaforo({
  valor,
  tamanho = "md",
  unidade = "percent",
}: {
  valor: number | null;
  tamanho?: "sm" | "md";
  /** "percent": variação % (padrão). "pp": diferença em pontos percentuais (ex: P.P Desv. Lucro). */
  unidade?: "percent" | "pp";
}) {
  const padding = tamanho === "sm" ? "px-1.5 py-0.5 text-xs" : "px-2 py-1 text-sm";

  if (valor === null) {
    return (
      <span className={`inline-flex rounded ${padding} font-medium text-zinc-400 bg-zinc-100`}>
        —
      </span>
    );
  }

  const positivo = valor >= 0;
  return (
    <span
      className={[
        "inline-flex rounded font-semibold tabular-nums",
        padding,
        positivo ? "bg-verde/10 text-verde" : "bg-vermelho/10 text-vermelho",
      ].join(" ")}
    >
      {positivo ? "+" : ""}
      {unidade === "pp" ? formatPontosPercentuais(valor) : formatPercent(valor)}
    </span>
  );
}
