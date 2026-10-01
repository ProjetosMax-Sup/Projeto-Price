import { formatMoeda, formatPercent } from "@/lib/desempenho/format";
import type { NoLoja } from "@/lib/entradas-saidas/aggregate";
import { avaliarColunas } from "@/lib/parametros/avaliador";
import type { ConfigRelatorio, LojaCadastro } from "@/lib/parametros/types";

/**
 * Painel informativo de Lojas (decisão de 2026-09-30) — não é um drill-down:
 * só reflete o recorte já escolhido em Departamento ou Comprador (ver
 * `consulta.focoLojas`), pra comparar lojas entre si e decidir transferência
 * interna ("essa está com excesso, essa está precisando").
 *
 * Cor relativa ao PRÓPRIO recorte, não uma escala fixa — o que importa aqui é
 * comparar lojas do mesmo grupo entre si, não um limiar universal (DDE "bom"
 * varia por departamento; a mesma ideia vale pra % Compra/Venda por Loja no
 * Compra e Venda). Saldo é exceção: pivô no zero de verdade (positivo é
 * sempre "sobrando" — entrou mais do que saiu —, negativo é sempre
 * "faltando", não é relativo a nada). Quanto MAIOR o valor (mais excesso —
 * mais estoque parado, mais dias de estoque, mais comprou em cima do que
 * vendeu), mais VERMELHO; quanto menor (sobra de margem, giro saudável),
 * mais VERDE — pedido de 2026-09-30.
 */
export interface ColunaLojas {
  ref: string;
  rotulo: string;
  formato: "moeda" | "numero" | "percentual";
  pivotZero: boolean;
  /** Sem mapa de calor — pra valores em R$ absoluto tipo Compra/Venda, onde uma
   * loja maior sempre teria número maior, sem ser "excesso" de verdade (o mapa
   * de calor só faz sentido pra métricas comparáveis entre lojas de tamanhos
   * diferentes: %, dias de estoque, saldo). */
  semHeatmap?: boolean;
}

const HEATMAP_MATIZ_VERMELHO = 0;
const HEATMAP_MATIZ_VERDE = 120;

/** Mesma escala (2 matizes fixos, sem amarelo, intensidade pela distância do
 * pivô) de `CelulaMetrica`, mas com pivô/amplitude relativos ao recorte em
 * vez de uma saturação fixa — ver comentário de `ColunaLojas` acima. */
function corHeatmapRelativo(valor: number, pivot: number, amplitude: number): string {
  if (amplitude === 0) return "hsl(0, 0%, 94%)";
  const t = Math.max(-1, Math.min(1, (valor - pivot) / amplitude));
  // t>=0 (acima do pivô, mais excesso) → vermelho; t<0 → verde.
  const matiz = t >= 0 ? HEATMAP_MATIZ_VERMELHO : HEATMAP_MATIZ_VERDE;
  const luminosidade = 90 - Math.abs(t) * 30;
  return `hsl(${matiz}, 70%, ${luminosidade}%)`;
}

function formatarValor(valor: number, formato: ColunaLojas["formato"]): string {
  if (formato === "moeda") return formatMoeda(valor);
  if (formato === "percentual") return formatPercent(valor);
  return valor.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
}

export function LojasInformativoPanel({
  linhas,
  lojasCadastro,
  config,
  colunas,
  stickyTop,
}: {
  linhas: NoLoja[];
  lojasCadastro: LojaCadastro[];
  config: ConfigRelatorio;
  colunas: ColunaLojas[];
  /** O CARTÃO inteiro gruda (não só o cabeçalho) — a tabela é curta de propósito
   * (informativo, poucas linhas), então um cabeçalho sticky sozinho "descola" do
   * corpo assim que a altura da tabela fica menor que `stickyTop` (bug visto em
   * 2026-09-30: o cabeçalho aparecia embaixo das linhas). Grudar o cartão
   * inteiro evita isso e ainda mantém a comparação de lojas visível ao rolar
   * os painéis de Departamento/Comprador, bem mais altos ao lado. */
  stickyTop: number;
}) {
  const lojaPorCodigo = new Map(lojasCadastro.map((l) => [l.codigo, l]));

  const linhasAvaliadas = linhas.map((no) => ({
    no,
    loja: lojaPorCodigo.get(no.codigo),
    valores: avaliarColunas(config, { atual: no.valores, comparacao: null }),
  }));

  // Pivô/amplitude por coluna, calculados sobre o recorte ATUAL — muda de valor
  // a cada clique de drill-down em Departamento/Comprador, de propósito.
  const escalas = colunas.map((c) => {
    const vals = linhasAvaliadas.map((l) => l.valores[c.ref]).filter((v): v is number => v !== null && v !== undefined);
    if (vals.length === 0) return { pivot: 0, amplitude: 0 };
    if (c.pivotZero) {
      return { pivot: 0, amplitude: Math.max(...vals.map((v) => Math.abs(v)), 1) };
    }
    const media = vals.reduce((a, b) => a + b, 0) / vals.length;
    return { pivot: media, amplitude: Math.max(...vals.map((v) => Math.abs(v - media)), 1) };
  });

  // Código da loja, não o nome customizado (pedido de 2026-10-01 — mesma regra dos
  // outros painéis: Departamento/Loja ordenam pelo código, nunca por alfabeto).
  const ordenadas = [...linhasAvaliadas].sort((a, b) =>
    (a.loja?.codigo ?? a.no.codigo).localeCompare(b.loja?.codigo ?? b.no.codigo, "pt-BR"),
  );

  return (
    <div className="sticky flex flex-col rounded-lg border border-zinc-200 bg-white shadow-sm" style={{ top: stickyTop }}>
      <div className="rounded-t-lg bg-azul px-4 py-3">
        <h2 className="font-display font-semibold text-white">Lojas</h2>
        <p className="mt-0.5 text-xs text-white/70">Informativo — reflete a seleção feita em Departamento ou Comprador.</p>
      </div>
      <div className="max-h-[70vh] overflow-auto rounded-b-lg">
        <table className="w-full table-fixed text-xs">
          <thead>
            <tr className="bg-azul text-white">
              <th className="px-2 py-1.5 text-left font-medium">Loja</th>
              {colunas.map((c) => (
                <th key={c.ref} className="px-1.5 py-1.5 text-right font-medium leading-tight">
                  {c.rotulo}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ordenadas.map(({ no, loja, valores }, i) => (
              <tr key={no.codigo} className={i % 2 === 1 ? "bg-zinc-50" : "bg-white"}>
                <td className="truncate px-2 py-1.5 text-zinc-700" title={loja?.nomeCustomizado ?? no.codigo}>
                  <span className="font-normal text-zinc-400">{no.codigo} - </span>
                  {loja?.nomeCustomizado ?? no.codigo}
                </td>
                {colunas.map((c, ci) => {
                  const valor = valores[c.ref];
                  if (valor === null || valor === undefined) {
                    return (
                      <td key={c.ref} className="px-1.5 py-1.5 text-right tabular-nums text-zinc-400">
                        —
                      </td>
                    );
                  }
                  if (c.semHeatmap) {
                    return (
                      <td key={c.ref} className="px-1.5 py-1.5 text-right tabular-nums text-zinc-700">
                        {formatarValor(valor, c.formato)}
                      </td>
                    );
                  }
                  const { pivot, amplitude } = escalas[ci];
                  return (
                    <td
                      key={c.ref}
                      className="px-1.5 py-1.5 text-right tabular-nums text-zinc-800"
                      style={{ backgroundColor: corHeatmapRelativo(valor, pivot, amplitude) }}
                    >
                      {formatarValor(valor, c.formato)}
                    </td>
                  );
                })}
              </tr>
            ))}
            {ordenadas.length === 0 && (
              <tr>
                <td colSpan={colunas.length + 1} className="px-4 py-8 text-center text-zinc-400">
                  Nenhum dado para o recorte selecionado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
