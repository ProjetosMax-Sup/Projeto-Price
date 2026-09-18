import { Semaforo } from "@/components/ui/Semaforo";
import { formatMoeda } from "@/lib/desempenho/format";

export function RankingBar({
  rotulo,
  codigo,
  valor,
  valorMax,
  desvio,
  ativo,
  onClick,
}: {
  rotulo: string;
  codigo?: string | null;
  valor: number;
  valorMax: number;
  desvio: number | null;
  ativo?: boolean;
  onClick?: () => void;
}) {
  const largura = valorMax > 0 ? Math.max(2, (valor / valorMax) * 100) : 0;

  const Componente = onClick ? "button" : "div";

  return (
    <Componente
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={[
        "group w-full rounded-md px-3 py-2 text-left transition-colors",
        onClick ? "cursor-pointer hover:bg-zinc-50" : "",
        ativo ? "bg-azul/5 ring-1 ring-azul/30" : "",
      ].join(" ")}
    >
      <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
        <span className="truncate font-medium text-zinc-800">
          {codigo && <span className="text-zinc-400">{codigo} — </span>}
          {rotulo}
        </span>
        <div className="flex shrink-0 items-center gap-2">
          <span className="tabular-nums text-zinc-600">{formatMoeda(valor)}</span>
          <Semaforo valor={desvio} tamanho="sm" />
        </div>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
        <div
          className="h-full rounded-full bg-azul transition-all"
          style={{ width: `${largura}%` }}
        />
      </div>
    </Componente>
  );
}
