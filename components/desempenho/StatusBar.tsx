export function StatusBar({
  descricaoRecorte,
  temSelecao,
  onLimpar,
}: {
  descricaoRecorte: string;
  temSelecao: boolean;
  onLimpar: () => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-azul/20 bg-azul/5 px-4 py-2 text-sm">
      <span className="text-azul">
        <span className="font-medium">Filtrando por:</span> {descricaoRecorte}
        <span className="text-azul/60"> — os cards de KPI acima refletem este recorte</span>
      </span>
      {temSelecao && (
        <button
          type="button"
          onClick={onLimpar}
          className="shrink-0 rounded-md border border-azul/30 bg-white px-3 py-1 text-xs font-medium text-azul hover:bg-azul/10"
        >
          Limpar seleção
        </button>
      )}
    </div>
  );
}
