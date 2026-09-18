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
        <span className="font-medium">Recorte ativo:</span> {descricaoRecorte}
      </span>
      {temSelecao && (
        <button
          type="button"
          onClick={onLimpar}
          className="rounded-md border border-azul/30 bg-white px-3 py-1 text-xs font-medium text-azul hover:bg-azul/10"
        >
          Limpar seleção
        </button>
      )}
    </div>
  );
}
