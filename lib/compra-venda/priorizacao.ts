import {
  REF_ENTRADAS_COMPRAS,
  REF_ENTRADAS_SAIDAS_ESTOQUE,
  REF_ENTRADAS_SAIDAS_QTDE_VMD,
} from "@/config/data-sources";
import { caminhoAteNivel } from "@/lib/desempenho/aggregate";
import { nomeCompradorPorDptoCadastro, type IndiceDepartamentos } from "@/lib/desempenho/comprador-cadastro";
import type { LinhaReduzida } from "@/lib/entradas-saidas/aggregate";

/**
 * Priorização do Compra e Venda — o que o Comprador deve TRATAR, em ordem de
 * relevância em dinheiro, até o grão de Produto e de Loja. É o motor do PDF
 * por Comprador (`lib/compra-venda/pdf-comprador.ts`); não tem nada de UI aqui.
 *
 * Lê a MESMA `LinhaReduzida` que o relatório na tela usa (Produto×Loja, já
 * reduzida pelo período escolhido) — nunca abre arquivo nem refaz agregação
 * própria, senão o PDF e a tela divergiriam sem ninguém perceber.
 *
 * ## Por que "GAP em R$" e não "Meta − Realizado" em pontos percentuais
 *
 * A tela mostra o desvio em pp, que é a régua certa pra julgar um departamento
 * mas a errada pra priorizar: em Setembro/2026 (Varejo) Mercearia Saudável
 * estourou a meta em +42,7pp e isso vale R$ 21 mil, enquanto Mercearia Básica
 * estourou +21,5pp e vale R$ 134 mil. O número que ordena é:
 *
 *     GAP R$ = Compra − (Meta% × Venda)
 *
 * "quanto de compra sobrou acima do que a meta autorizava". Ele já nasce
 * ponderado pelo tamanho (venda pequena com desvio grande dá R$ pequeno) e,
 * principalmente, é **somável**: o GAP de uma Categoria é a soma do GAP dos
 * produtos dela. É isso que faz a cascata Departamento → Seção → Categoria →
 * Produto fechar conta em todos os níveis.
 */

const REF_VENDA = "Valor";
const REF_LUCRO = "Lucros";
const REF_QTDE_COMPRAS = "Qtde Compras";
const REF_QTDE_VENDAS = "Qtde Vendas";
const REF_ESTOQUE_VALOR = "Estoques Preço Venda";

/** Piso de relevância por linha (decisão de 2026-10-01): abaixo disso o item não
 * vira linha do relatório — entra somado como "pulverizado em N SKUs", pra não
 * sumir da conta nem virar ruído de 200 linhas que ninguém trata. */
export const PISO_RELEVANCIA_PADRAO = 3000;

/**
 * Departamentos onde Estoque/DDE **não** descrevem a realidade e por isso não
 * entram no PDF (nem como coluna, nem como sinal de ruptura) — medido nos
 * arquivos reais de Setembro/2026, % de linhas Produto×Loja com estoque
 * negativo: Padaria Própria 33%, Hortifruti 21%, Eletro 20%, Açougue 12%,
 * contra 2–6% no resto da rede. São produção própria, pesável e venda com
 * entrega futura: a saída é lançada no produto final e a entrada é insumo, de
 * outro código. Sem este corte o relatório abriria com "Pão Francês: −11.804
 * unidades em estoque, ruptura crítica", que é verdade no dado e mentira no
 * mundo.
 *
 * Códigos, não nomes — nome de departamento é editável em /parametros.
 */
export const DPTOS_ESTOQUE_NAO_CONFIAVEL = new Set(["001", "003", "004", "017"]);

/** Motivo pelo qual um SKU sai da lista de ação e vai pro anexo. Nenhum deles é
 * "erro do comprador" — por isso nunca entram no número que se cobra dele. */
export type MotivoAnexo =
  /** Compra no período sem nenhuma venda: 1ª carga de lançamento, não excesso.
   * Em Setembro/2026 (Varejo) eram 209 SKUs e R$ 306 mil — whey, pneu, TV, ar
   * condicionado. Misturar isso com excesso faz o comprador descartar a lista. */
  | "lancamento"
  /** Preço médio de compra acima de 2× o preço médio de venda — não existe no
   * mundo real, é rateio de desmembramento/transformação caindo num SKU que
   * não é o que foi comprado. Os dois maiores "excessos" do Varejo em
   * Setembro/2026 eram isto: "Osso Kg" (R$ 22,45/un comprado contra R$ 0,84/un
   * vendido, R$ 188 mil) e "Muchiba Kg" (R$ 151 mil) — juntos, mais da metade
   * do GAP do Varejo inteiro, puro fantasma. */
  | "precoIncoerente"
  /** Margem abaixo de −15%: ou é rateio como acima, ou é uma perda real que se
   * resolve em outra conversa (preço), não cortando compra. */
  | "margemNegativa"
  /** Comprou mais de 20× o que vendeu em unidades — na prática é 1ª carga de um
   * item que teve uma venda simbólica no período, ou unidade de compra diferente
   * da de venda no cadastro. Nunca é "comprou demais" no sentido que o
   * comprador pode corrigir. Achado em 2026-10-02: Feijão Carioca Nova Era 1kg
   * (Atacado) com QC/QV de **1.361** e R$ 133 mil de "GAP" — marca própria
   * entrando, passava pela trava de lançamento porque teve venda mínima. */
  | "quantidadeDesproporcional";

/** Acima disso, QC/QV deixa de ser decisão de compra e passa a ser 1ª carga ou
 * erro de unidade no cadastro — ver `quantidadeDesproporcional`. */
const QCQV_DESPROPORCIONAL = 20;

/**
 * O que o comprador faz com a linha. Sai do dado, não é opinião — ver
 * `acaoDoProduto`. "PREÇO" e "QUANTIDADE" nomeiam os dois fatores da identidade
 * do % C/V (ver `variacaoQuantidade`), que é o que o comprador precisa saber
 * para não mexer na alavanca errada.
 */
export type AcaoProduto = "QUANTIDADE" | "PREÇO" | "QUANTIDADE + PREÇO" | "TRANSFERIR" | "VERIFICAR";

export interface MetricasPrioridade {
  compra: number;
  venda: number;
  lucro: number;
  qtdeCompras: number;
  qtdeVendas: number;
  estoque: number;
  vmd: number;
  estoqueValor: number;
  /** Data mais antiga com venda entre as linhas somadas (`AA-MM-DD`). */
  primeiraVenda: string;
  /** Data mais recente entre as linhas somadas (`AA-MM-DD`). */
  ultimaData: string;
}

function metricasZeradas(): MetricasPrioridade {
  return { compra: 0, venda: 0, lucro: 0, qtdeCompras: 0, qtdeVendas: 0, estoque: 0, vmd: 0, estoqueValor: 0, primeiraVenda: "", ultimaData: "" };
}

/**
 * Soma métricas de vários nós — base dos subtotais do PDF. ⚠️ Some só as
 * PARCELAS; percentual e DDE do subtotal têm que ser recalculados a partir
 * daqui (`percentualCompraVenda(soma)`, `dde(soma)`), nunca tirados da média
 * dos filhos: a média de percentuais ignora o peso de cada um e dá um número
 * que não existe.
 */
export function somarMetricas(itens: { metricas: MetricasPrioridade }[]): MetricasPrioridade {
  const total = metricasZeradas();
  for (const item of itens) {
    total.compra += item.metricas.compra;
    total.venda += item.metricas.venda;
    total.lucro += item.metricas.lucro;
    total.qtdeCompras += item.metricas.qtdeCompras;
    total.qtdeVendas += item.metricas.qtdeVendas;
    total.estoque += item.metricas.estoque;
    total.vmd += item.metricas.vmd;
    total.estoqueValor += item.metricas.estoqueValor;
    const pv = item.metricas.primeiraVenda;
    if (pv && (total.primeiraVenda === "" || pv < total.primeiraVenda)) total.primeiraVenda = pv;
    if (item.metricas.ultimaData > total.ultimaData) total.ultimaData = item.metricas.ultimaData;
  }
  return total;
}

function acumular(alvo: MetricasPrioridade, linha: LinhaReduzida): void {
  const v = linha.valores;
  alvo.compra += v[REF_ENTRADAS_COMPRAS] ?? 0;
  alvo.venda += v[REF_VENDA] ?? 0;
  alvo.lucro += v[REF_LUCRO] ?? 0;
  alvo.qtdeCompras += v[REF_QTDE_COMPRAS] ?? 0;
  alvo.qtdeVendas += v[REF_QTDE_VENDAS] ?? 0;
  alvo.estoque += v[REF_ENTRADAS_SAIDAS_ESTOQUE] ?? 0;
  alvo.vmd += v[REF_ENTRADAS_SAIDAS_QTDE_VMD] ?? 0;
  alvo.estoqueValor += v[REF_ESTOQUE_VALOR] ?? 0;
  if (linha.primeiraVenda && (alvo.primeiraVenda === "" || linha.primeiraVenda < alvo.primeiraVenda)) {
    alvo.primeiraVenda = linha.primeiraVenda;
  }
  if (linha.ultimaData > alvo.ultimaData) alvo.ultimaData = linha.ultimaData;
}

/** `null` quando não dá pra dividir — nunca 0, que seria lido como "zero dias de
 * estoque"/"margem zero" e é coisa diferente de "não sei". */
function razao(numerador: number, denominador: number): number | null {
  return denominador > 0 ? numerador / denominador : null;
}

export function percentualCompraVenda(m: MetricasPrioridade): number | null {
  return razao(m.compra, m.venda);
}
export function margem(m: MetricasPrioridade): number | null {
  return razao(m.lucro, m.venda);
}
/** Dias entre duas datas `AA-MM-DD`, contando as duas pontas: vendeu no dia 1 e
 * no dia 30 = 30 dias de oportunidade. `null` se alguma data faltar. */
function diasEntre(inicio: string, fim: string): number | null {
  if (!inicio || !fim) return null;
  const data = (s: string) => Date.UTC(2000 + Number(s.slice(0, 2)), Number(s.slice(3, 5)) - 1, Number(s.slice(6, 8)));
  const dias = (data(fim) - data(inicio)) / 86_400_000 + 1;
  return Number.isFinite(dias) && dias > 0 ? dias : null;
}

/**
 * A venda média diária que o DDE usa, e se ela foi calculada por nós.
 *
 * A regra é usar a coluna `Qtde Venda Média Diária` do ERP (ver CLAUDE.md). Só
 * que ela cobre **3 meses fechados**, então produto novo ou de promoção fica
 * meses com VMD zero — e aí o DDE sumia da tabela, justamente nos itens em que
 * ele mais importa. Caso real de Setembro/2026: Leite Em Pó Ninho Promo 380g na
 * Independência vendeu R$ 4.539 no mês e tinha VMD zero no ERP.
 *
 * Quando não há VMD, o DDE passa a sair da venda do PRÓPRIO período, do primeiro
 * dia em que o item vendeu até o último dia do recorte (pedido de 2026-10-02).
 * É uma régua diferente — olha só o período analisado, não os 3 meses — e por
 * isso o PDF marca essas linhas e diz no rodapé da tabela qual foi a troca.
 */
export function vmdEfetiva(m: MetricasPrioridade): { valor: number; calculada: boolean } {
  if (m.vmd > 0) return { valor: m.vmd, calculada: false };
  const dias = diasEntre(m.primeiraVenda, m.ultimaData);
  if (dias === null || m.qtdeVendas <= 0) return { valor: 0, calculada: false };
  return { valor: m.qtdeVendas / dias, calculada: true };
}

export function dde(m: MetricasPrioridade): number | null {
  return razao(m.estoque, vmdEfetiva(m).valor);
}

/** `true` quando o DDE daquela linha não veio da VMD do ERP — ver `vmdEfetiva`. */
export function ddeCalculado(m: MetricasPrioridade): boolean {
  return m.estoque !== 0 && vmdEfetiva(m).calculada;
}

/**
 * ## A identidade que sustenta o relatório inteiro
 *
 *     % Compra/Venda  =  (QC / QV)  ×  (Preço de compra / Preço de venda)
 *                         └ QUANTIDADE ┘   └──────── PREÇO ────────┘
 *
 * É exata, em qualquer produto (confirmado linha a linha em Setembro/2026:
 * Café Moinho Fino, 0,969 × 1,155 = 1,119 = os 111,9% do relatório). E os dois
 * fatores são responsabilidades diferentes: QC/QV é **decisão de compra**, que
 * o comprador controla sozinho; preço de compra ÷ preço de venda é
 * **estrutura** (custo do fornecedor, imposto embutido na nota, preço
 * praticado), que ele influencia mas não decide.
 *
 * Sem separar os dois, o relatório cobra do comprador o que não é dele.
 * Medido na rede: 89% do GAP do Varejo e 90% do Atacado vêm de quantidade —
 * mas os 10% restantes estão concentrados justamente nos maiores itens
 * (Café, Cerveja Amstel, Costela), e mandar "cortar" neles destruiria a
 * credibilidade do resto, que está certo.
 */

/**
 * Quanto se comprou a mais (ou a menos) do que se vendeu, **em unidades**,
 * como variação: `+10%` = comprou 110 para cada 100 vendidos; `-3%` = comprou
 * 97 para cada 100. Zero é o equilíbrio (estoque terminou o período como
 * começou), negativo significa que o estoque caiu em unidades — o que também
 * serve de freio contra corte burro.
 *
 * Exposta como variação, e não como a razão crua (1,10), porque é assim que se
 * lê sem treinamento: "comprou 10% a mais do que vendeu" (decisão de
 * 2026-10-02). A razão crua continua disponível em `razaoQuantidade` para as
 * contas internas.
 */
export function variacaoQuantidade(m: MetricasPrioridade): number | null {
  const r = razaoQuantidade(m);
  return r === null ? null : r - 1;
}

/** QC ÷ QV cru — insumo das contas; pra exibir use `variacaoQuantidade`. */
export function razaoQuantidade(m: MetricasPrioridade): number | null {
  return razao(m.qtdeCompras, m.qtdeVendas);
}

/**
 * Preço médio de compra ÷ preço médio de venda — o **% C/V de equilíbrio**: o
 * percentual que o item marcaria se tivesse comprado exatamente o que vendeu
 * (QC/QV = 1). Comparar com a meta responde a pergunta que a tela de hoje não
 * responde: o item cabe na meta?
 *
 * Café Moinho Fino, Varejo/Setembro: equilíbrio de **115,5%** contra meta de
 * 71%. Para bater a meta ele teria que comprar 61 unidades a cada 100
 * vendidas, todo mês, para sempre — impossível. É substituição tributária: a
 * nota de compra carrega o imposto (R$ 32,00/un em "Compras" contra R$ 23,11
 * em "Compras Líquidas") e a venda não. O item não tem problema de compra, tem
 * problema de preço, tributação ou de meta de categoria.
 *
 * ⚠️ Não é margem invertida: "Compras" é valor cheio de nota e o custo que
 * entra no resultado é outro (R$ 25,23/un no mesmo exemplo). Equilíbrio acima
 * de 100% **não** quer dizer que se vende no prejuízo — a margem do Café é
 * +8,1%. Serve pra comparar com a meta, que usa a mesma régua bruta, e pra
 * comparar o item com ele mesmo entre períodos.
 */
export function percentualEquilibrio(m: MetricasPrioridade): number | null {
  const precoCompra = razao(m.compra, m.qtdeCompras);
  const precoVenda = razao(m.venda, m.qtdeVendas);
  return precoCompra === null || precoVenda === null ? null : precoCompra / precoVenda;
}

/**
 * Parte o GAP nas duas causas, em R$, somando exatamente o GAP:
 *
 *     GAP de preço      = Venda × (equilíbrio − meta)
 *     GAP de quantidade = Venda × equilíbrio × (QC/QV − 1)
 *
 * (os dois são R$ de GAP, não quantidades — "quantidade" aqui nomeia a causa,
 * não a unidade.) Café/Varejo: R$ 68.690 de preço e −R$ 5.504 de quantidade,
 * somando os R$ 63.186 de GAP. Óleo Vila Velha: −R$ 1.124 e R$ 39.355. Mesmo
 * GAP na tela de hoje, problemas opostos.
 *
 * `null` quando falta quantidade de um dos lados (lançamento, produto sem
 * venda) — nesse caso não há preço médio e a decomposição não existe.
 */
export function decomporGap(m: MetricasPrioridade, meta: number | null): { preco: number; quantidade: number } | null {
  if (meta === null) return null;
  const equilibrio = percentualEquilibrio(m);
  const razaoQtd = razaoQuantidade(m);
  if (equilibrio === null || razaoQtd === null) return null;
  return {
    preco: m.venda * (equilibrio - meta),
    quantidade: m.venda * equilibrio * (razaoQtd - 1),
  };
}

/** O número que ordena tudo. `null` quando o departamento não tem meta
 * cadastrada — "sem meta" nunca vira "meta zero" (isso transformaria a compra
 * inteira em excesso). Esses casos saem num aviso próprio, ver `metasFaltando`. */
export function gapReais(m: MetricasPrioridade, meta: number | null): number | null {
  return meta === null ? null : m.compra - meta * m.venda;
}

export interface NoPrioridade<T = string> {
  chave: T;
  nome: string;
  metricas: MetricasPrioridade;
  /** Meta ponderada pela venda das partes que TÊM meta (mesma regra de
   * `metasPorComprador` em `aggregate.ts`: percentual não soma, pondera). */
  meta: number | null;
  gap: number | null;
}

function finalizar<T>(chave: T, nome: string, m: MetricasPrioridade, metaPonderada: number, pesoMeta: number): NoPrioridade<T> {
  const meta = pesoMeta > 0 ? metaPonderada / pesoMeta : null;
  return { chave, nome, metricas: m, meta, gap: gapReais(m, meta) };
}

/** Meta cadastrada do par Departamento×Formato, em fração (0–1). */
export type ResolverMeta = (dpto: string, formato: string) => number | null;

export function criarResolverMeta(metas: Record<string, number>): ResolverMeta {
  return (dpto, formato) => {
    const valor = metas[`${dpto}|${formato}`];
    return valor === undefined ? null : valor / 100;
  };
}

/**
 * Agrupa `linhas` por uma chave qualquer, já com meta ponderada e GAP. A meta
 * vem sempre do par Departamento×Formato da PRÓPRIA linha — por isso um nó que
 * mistura departamentos (um Comprador, por exemplo) recebe a média ponderada
 * pela venda de cada um, e não a meta de um deles.
 */
export function agruparComGap<T>(
  linhas: LinhaReduzida[],
  resolverMeta: ResolverMeta,
  chaveDe: (linha: LinhaReduzida) => T | null,
  nomeDe: (linha: LinhaReduzida, chave: T) => string,
): NoPrioridade<T>[] {
  const mapa = new Map<string, { chave: T; nome: string; m: MetricasPrioridade; metaPonderada: number; pesoMeta: number }>();
  for (const linha of linhas) {
    const chave = chaveDe(linha);
    if (chave === null) continue;
    const id = String(chave);
    let entrada = mapa.get(id);
    if (!entrada) {
      entrada = { chave, nome: nomeDe(linha, chave), m: metricasZeradas(), metaPonderada: 0, pesoMeta: 0 };
      mapa.set(id, entrada);
    }
    acumular(entrada.m, linha);
    const meta = resolverMeta(linha.dpto, linha.formatoLoja);
    if (meta !== null) {
      const venda = linha.valores[REF_VENDA] ?? 0;
      entrada.metaPonderada += meta * venda;
      entrada.pesoMeta += venda;
    }
  }
  return Array.from(mapa.values()).map((e) => finalizar(e.chave, e.nome, e.m, e.metaPonderada, e.pesoMeta));
}

/**
 * GAP de um conjunto = **soma dos GAPs das partes que têm meta**, nunca
 * recalculado a partir do total. Parece a mesma coisa e não é: um departamento
 * sem meta (hoje Sazonais e Apropriações) entra com a sua Compra no total e
 * fica de fora do denominador da meta ponderada, inflando o GAP. Medido em
 * Setembro/2026: Bruna/Varejo dá R$ 206 mil pela soma e R$ 224 mil pelo total,
 * e os R$ 18 mil de diferença são Sazonais, que ela nem tem como responder.
 */
export function somarGaps(nos: { gap: number | null }[]): number {
  return nos.reduce((total, no) => total + (no.gap ?? 0), 0);
}

export function motivoAnexo(m: MetricasPrioridade): MotivoAnexo | null {
  if (m.venda <= 0 && m.compra > 0) return "lancamento";
  const precoCompra = razao(m.compra, m.qtdeCompras);
  const precoVenda = razao(m.venda, m.qtdeVendas);
  if (precoCompra !== null && precoVenda !== null && precoCompra > precoVenda * 2) return "precoIncoerente";
  const mrg = margem(m);
  if (mrg !== null && mrg < -0.15) return "margemNegativa";
  const qcqv = razaoQuantidade(m);
  if (qcqv !== null && qcqv > QCQV_DESPROPORCIONAL) return "quantidadeDesproporcional";
  return null;
}

/** Acima de quanto QC/QV passa a ser considerado compra a mais de verdade, e não
 * ruído de arredondamento/lote. */
const QCQV_EXCESSO = 1.1;

/**
 * A ação que a linha pede, derivada dos DOIS fatores do % C/V (ver
 * `variacaoQuantidade`). A versão anterior desta função decidia só por QC/QV e
 * errava a causa: dizia "renegociar" sempre que o comprador não tinha comprado
 * mais unidades, concluindo que o custo havia subido. No Café Moinho Fino o
 * preço de compra foi **exatamente R$ 32,00 em Agosto e em Setembro** — o que
 * mudou foi a venda, que caiu 25% em unidades. O rótulo saía certo por
 * coincidência (o Café é mesmo conversa de preço, mas por causa do equilíbrio
 * de 115,5%, não de aumento de custo) e sairia errado em qualquer item cuja
 * venda caísse. Corrigido em 2026-10-02.
 *
 * - **TRANSFERIR** vem antes de tudo: não adianta mexer na compra de um item que
 *   está em ruptura em metade das lojas. É também a ação mais barata que existe.
 * - **PREÇO** quando o % C/V de equilíbrio já está acima da meta — nenhum ajuste
 *   de pedido resolve, porque mesmo comprando só o que vende o item estoura.
 * - **QUANTIDADE** quando se comprou mais de 10% a mais do que se vendeu, em
 *   unidades, e o equilíbrio cabe na meta.
 * - **QUANTIDADE + PREÇO** quando os dois acontecem juntos.
 */
export function acaoDoProduto(m: MetricasPrioridade, meta: number | null, temDesequilibrioEntreLojas: boolean): AcaoProduto {
  if (temDesequilibrioEntreLojas) return "TRANSFERIR";
  const equilibrio = percentualEquilibrio(m);
  const qcqv = razaoQuantidade(m);
  if (equilibrio === null || qcqv === null || meta === null) return "VERIFICAR";
  const precoEstoura = equilibrio > meta;
  const comprouDemais = qcqv > QCQV_EXCESSO;
  if (precoEstoura && comprouDemais) return "QUANTIDADE + PREÇO";
  if (precoEstoura) return "PREÇO";
  if (comprouDemais) return "QUANTIDADE";
  return "VERIFICAR";
}

// ---------------------------------------------------------------------------
// Nível de Loja — "onde tratar"
// ---------------------------------------------------------------------------

/**
 * O excesso quase nunca é do SKU: é de uma loja dentro do SKU. Exemplo real
 * (Setembro/2026, Varejo, Leite Leitbom 1l Integral, meta 90%): o SKU tem
 * R$ 46,4 mil de GAP, e **R$ 44,3 mil estão em Rio Verde sozinha** — que
 * comprou 9.600 unidades e vendeu 416. Nas outras três lojas o item está
 * saudável, e Independência vende R$ 23,7 mil com 38 dias de estoque. Quem lê
 * só a linha da rede corta a compra do item e quebra Independência.
 */
export interface NoLojaPrioridade {
  lojaCodigo: string;
  metricas: MetricasPrioridade;
  gap: number | null;
  dde: number | null;
}

export function porLoja(linhas: LinhaReduzida[], resolverMeta: ResolverMeta): NoLojaPrioridade[] {
  const nos = agruparComGap(
    linhas,
    resolverMeta,
    (l) => l.lojaCodigo,
    (_l, chave) => chave,
  );
  return nos.map((no) => ({ lojaCodigo: no.chave, metricas: no.metricas, gap: no.gap, dde: dde(no.metricas) }));
}

/** Dias de cobertura abaixo do qual a loja está em risco de ruptura no item. */
export const DDE_CRITICO = 10;

/**
 * Cobertura mínima pra uma loja ser candidata a **doar** estoque: menos que isso
 * e ela ficaria apertada depois de mandar. Não é "estoque parado" em termos
 * absolutos — é só o piso pra ser doadora.
 *
 * Substituiu um limite absoluto de 60 dias (2026-10-02). O corte antigo perdia o
 * caso mais comum: Café Moinho Fino 500g no Varejo tinha Vila Mutirão com 42
 * dias enquanto Rio Verde e Independência estavam com 9,8 e 9,7 — ou seja, 4×
 * mais cobertura numa loja do que nas outras, e nenhuma transferência sugerida,
 * porque 42 não passava de 60. O que importa não é a cobertura absoluta da
 * doadora, é o DESEQUILÍBRIO entre as lojas.
 */
export const DDE_MINIMO_DOADORA = 25;

/** Quantas vezes a cobertura da doadora precisa ser maior que a da loja em falta
 * pra valer o frete e o trabalho de transferir. */
export const RAZAO_DESEQUILIBRIO = 2.5;

export interface DesequilibrioLojas {
  sobrando: NoLojaPrioridade[];
  faltando: NoLojaPrioridade[];
  /** GAP concentrado nas lojas que estão sobrando — o R$ que está parado no lugar errado. */
  gapParado: number;
}

/**
 * Lojas com estoque sobrando e lojas em cobertura crítica, no MESMO SKU, no
 * mesmo período e no mesmo formato. Quando as duas listas têm item, a ação não é
 * comprar nem cortar: é transferir.
 *
 * A doadora é escolhida **em relação à loja mais apertada**, não por um limite
 * absoluto (mudança de 2026-10-02, ver `DDE_MINIMO_DOADORA`): precisa ter pelo
 * menos `DDE_MINIMO_DOADORA` dias — pra não ficar apertada ela mesma depois de
 * mandar — e pelo menos `RAZAO_DESEQUILIBRIO` vezes a cobertura de quem está em
 * falta, que é o que paga o frete e o trabalho.
 *
 * Repare que a doadora **não** precisa estar acima da meta: uma loja pode estar
 * comprando certo e ainda assim ter 4× a cobertura da vizinha, porque a venda
 * dela caiu. O GAP só entra no `gapParado`, pra dimensionar o dinheiro.
 *
 * Só faz sentido onde o estoque é confiável — ver `DPTOS_ESTOQUE_NAO_CONFIAVEL`.
 */
export function desequilibrioEntreLojas(lojas: NoLojaPrioridade[]): DesequilibrioLojas | null {
  const faltando = lojas.filter(
    (l) => l.dde !== null && l.dde < DDE_CRITICO && l.metricas.estoque >= 0 && l.metricas.venda > 0,
  );
  if (faltando.length === 0) return null;

  // A régua é a loja mais apertada: se a doadora cobre bem mais que ela, há o
  // que remanejar.
  const menorCobertura = Math.min(...faltando.map((l) => l.dde!));
  const sobrando = lojas.filter(
    (l) =>
      l.dde !== null &&
      l.metricas.estoque > 0 &&
      l.dde >= DDE_MINIMO_DOADORA &&
      l.dde >= Math.max(menorCobertura, 0.1) * RAZAO_DESEQUILIBRIO,
  );
  if (sobrando.length === 0) return null;

  return { sobrando, faltando, gapParado: sobrando.reduce((t, l) => t + Math.max(l.gap ?? 0, 0), 0) };
}

/** Quando uma loja só concentra mais da metade do GAP do SKU, a linha de loja
 * precisa aparecer no PDF mesmo sem haver transferência a fazer — senão o
 * comprador age sobre a rede inteira por causa de um problema local. */
export const CONCENTRACAO_LOJA = 0.5;

export function lojaConcentradora(lojas: NoLojaPrioridade[], gapDoSku: number): NoLojaPrioridade | null {
  if (gapDoSku <= 0) return null;
  const pior = lojas.filter((l) => (l.gap ?? 0) > 0).sort((a, b) => (b.gap ?? 0) - (a.gap ?? 0))[0];
  if (!pior) return null;
  return (pior.gap ?? 0) / gapDoSku >= CONCENTRACAO_LOJA ? pior : null;
}

// ---------------------------------------------------------------------------
// Ruptura
// ---------------------------------------------------------------------------

export interface ItemRuptura {
  codigo: string;
  nome: string;
  dpto: string;
  metricas: MetricasPrioridade;
  dde: number | null;
  razaoQuantidade: number | null;
  /** Lojas do recorte que vendem o item. */
  lojas: number;
  /** Lojas sem estoque nenhum (estoque ≤ 0) com venda média diária > 0. */
  lojasZeradas: number;
  /** Lojas com estoque mas abaixo de `DDE_CRITICO` dias. */
  lojasCriticas: number;
  /** Venda/dia do item × proporção de lojas em risco — o que ordena a lista. */
  vendaDiariaEmRisco: number;
}

/**
 * Risco de ruptura, no grão Produto×Loja (rompe numa loja, não na rede).
 *
 * Esta é a metade do relatório sem a qual ele não funciona: em Setembro/2026,
 * três compradores do Varejo (Ricardo, Sandro e Nil) estavam ABAIXO da meta e
 * receberiam um PDF em branco. Sandro tinha Coca-Cola 2l vendendo R$ 115
 * mil/mês com 2 das 4 lojas em cobertura crítica e Qc/Qv 0,94 — comprou menos
 * unidades do que vendeu.
 *
 * `diasDoPeriodo` converte venda do período em venda/dia (o período pode ser
 * mais de um mês desde 2026-10-01).
 */
export function itensEmRisco(
  linhas: LinhaReduzida[],
  nomeDoProduto: (codigo: string) => string,
  diasDoPeriodo: number,
  vendaMinima: number,
): ItemRuptura[] {
  const mapa = new Map<string, { dpto: string; m: MetricasPrioridade; lojas: number; zeradas: number; criticas: number }>();
  for (const linha of linhas) {
    if (DPTOS_ESTOQUE_NAO_CONFIAVEL.has(linha.dpto)) continue;
    let e = mapa.get(linha.codigo);
    if (!e) {
      e = { dpto: linha.dpto, m: metricasZeradas(), lojas: 0, zeradas: 0, criticas: 0 };
      mapa.set(linha.codigo, e);
    }
    acumular(e.m, linha);
    e.lojas += 1;
    const vmdLoja = linha.valores[REF_ENTRADAS_SAIDAS_QTDE_VMD] ?? 0;
    const estoqueLoja = linha.valores[REF_ENTRADAS_SAIDAS_ESTOQUE] ?? 0;
    if (vmdLoja > 0) {
      if (estoqueLoja <= 0) e.zeradas += 1;
      else if (estoqueLoja / vmdLoja < DDE_CRITICO) e.criticas += 1;
    }
  }

  const itens: ItemRuptura[] = [];
  for (const [codigo, e] of mapa) {
    const emRisco = e.zeradas + e.criticas;
    if (emRisco === 0 || e.m.venda < vendaMinima) continue;
    const proporcao = emRisco / e.lojas;
    itens.push({
      codigo,
      nome: nomeDoProduto(codigo),
      dpto: e.dpto,
      metricas: e.m,
      dde: dde(e.m),
      razaoQuantidade: razaoQuantidade(e.m),
      lojas: e.lojas,
      lojasZeradas: e.zeradas,
      lojasCriticas: e.criticas,
      vendaDiariaEmRisco: (e.m.venda / diasDoPeriodo) * proporcao,
    });
  }
  return itens.sort((a, b) => b.vendaDiariaEmRisco - a.vendaDiariaEmRisco);
}

/**
 * Estoque negativo com venda ativa — o ERP acredita que não falta nada, então
 * **nunca** vai sugerir reposição. Não é decisão de compra, é inventário, e por
 * isso sai num bloco separado do risco de ruptura.
 */
export function estoqueNegativoComVenda(linhas: LinhaReduzida[], nomeDoProduto: (codigo: string) => string, vendaMinima: number) {
  const mapa = new Map<string, { dpto: string; m: MetricasPrioridade; lojas: Set<string> }>();
  for (const linha of linhas) {
    if (DPTOS_ESTOQUE_NAO_CONFIAVEL.has(linha.dpto)) continue;
    if ((linha.valores[REF_ENTRADAS_SAIDAS_ESTOQUE] ?? 0) >= 0) continue;
    let e = mapa.get(linha.codigo);
    if (!e) {
      e = { dpto: linha.dpto, m: metricasZeradas(), lojas: new Set() };
      mapa.set(linha.codigo, e);
    }
    acumular(e.m, linha);
    e.lojas.add(linha.lojaCodigo);
  }
  return Array.from(mapa.entries())
    .filter(([, e]) => e.m.venda >= vendaMinima)
    .map(([codigo, e]) => ({ codigo, nome: nomeDoProduto(codigo), dpto: e.dpto, metricas: e.m, lojas: e.lojas.size }))
    .sort((a, b) => b.metricas.venda - a.metricas.venda);
}

// ---------------------------------------------------------------------------
// Montagem da árvore do relatório
// ---------------------------------------------------------------------------

export interface LinhaProduto {
  codigo: string;
  nome: string;
  metricas: MetricasPrioridade;
  meta: number | null;
  gap: number;
  acao: AcaoProduto;
  /** Preenchido só quando uma loja concentra o problema ou há transferência a fazer. */
  lojas: { sobrando: NoLojaPrioridade[]; faltando: NoLojaPrioridade[] } | null;
  /** % C/V de equilíbrio (preço de compra ÷ preço de venda). */
  equilibrio: number | null;
  /** GAP partido em preço e quantidade, somando o GAP. */
  causa: { preco: number; quantidade: number } | null;
}

export interface NoCascata {
  nome: string;
  metricas: MetricasPrioridade;
  meta: number | null;
  gap: number;
  /** TODOS os SKUs do nó, inclusive os que estão dentro da meta. */
  skus: number;
  /** Quantos dos `skus` estão acima da meta — o universo do problema. A soma
   * `produtos.length + skusPulverizados` tem que dar este número (fora os
   * anexados), e o PDF mostra as três contagens juntas pra isso ser conferível. */
  skusAcimaDaMeta: number;
  filhos: NoCascata[];
  produtos: LinhaProduto[];
  /** GAP que ficou abaixo do piso e não virou linha — some da vista, não da conta. */
  gapPulverizado: number;
  /** Em quantos SKUs esse GAP está espalhado. */
  skusPulverizados: number;
  /** SKUs barrados pelas travas de cadastro, com o motivo. Vão pro anexo. */
  anexados: { codigo: string; nome: string; motivo: MotivoAnexo; gap: number; dataCadastro: string }[];
}

export interface BlocoDepartamento extends NoCascata {
  dpto: string;
  estoqueConfiavel: boolean;
}

export interface ResumoComprador {
  comprador: string;
  formato: string;
  metricas: MetricasPrioridade;
  meta: number | null;
  gap: number;
  departamentos: BlocoDepartamento[];
  /** Todos os departamentos do comprador, em ordem de venda — inclusive os que estão
   * dentro da meta. O comprador precisa ver o que NÃO precisa tratar. */
  panorama: { dpto: string; nome: string; metricas: MetricasPrioridade; meta: number | null; gap: number | null }[];
  ruptura: ItemRuptura[];
  transferencias: { produto: LinhaProduto; gapParado: number }[];
  inventario: ReturnType<typeof estoqueNegativoComVenda>;
  lancamentos: { codigo: string; nome: string; dpto: string; compra: number; dataCadastro: string }[];
  /** Departamentos do comprador sem meta cadastrada em /parametros, com a compra que
   * ficou fora da conta por isso. */
  metasFaltando: { dpto: string; nome: string; compra: number; venda: number }[];
}

export interface OpcoesPriorizacao {
  piso: number;
  /** Dias corridos do período escolhido — divide a venda pra chegar em venda/dia. */
  diasDoPeriodo: number;
  nomeDepartamento: (codigo: string) => string;
  /** Data de cadastro do SKU no ERP ("DD/MM/AA") — separa cadastro novo de item
   * antigo parado nos anexos, que no número do período são idênticos. */
  dataCadastro: (codigo: string) => string;
}

function nomeProdutoDaLinha(linha: LinhaReduzida): string {
  return [linha.descricao, linha.complemento].filter(Boolean).join(" ").trim() || linha.codigo;
}

function construirProdutos(
  linhas: LinhaReduzida[],
  resolverMeta: ResolverMeta,
  opcoes: OpcoesPriorizacao,
  estoqueConfiavel: boolean,
): {
  produtos: LinhaProduto[];
  anexados: NoCascata["anexados"];
  gapPulverizado: number;
  skusPulverizados: number;
  skus: number;
  skusAcimaDaMeta: number;
} {
  const nos = agruparComGap(
    linhas,
    resolverMeta,
    (l) => l.codigo || null,
    (l) => nomeProdutoDaLinha(l),
  );

  const produtos: LinhaProduto[] = [];
  const anexados: NoCascata["anexados"] = [];
  let gapPulverizado = 0;
  let skusPulverizados = 0;
  let skusAcimaDaMeta = 0;

  for (const no of nos) {
    const gap = no.gap ?? 0;
    if (gap <= 0) continue;
    skusAcimaDaMeta++;
    const motivo = motivoAnexo(no.metricas);
    if (motivo) {
      anexados.push({ codigo: no.chave, nome: no.nome, motivo, gap, dataCadastro: opcoes.dataCadastro(no.chave) });
      continue;
    }
    if (gap < opcoes.piso) {
      gapPulverizado += gap;
      skusPulverizados++;
      continue;
    }
    const linhasDoSku = linhas.filter((l) => l.codigo === no.chave);
    const lojas = estoqueConfiavel ? porLoja(linhasDoSku, resolverMeta) : [];
    const desequilibrio = estoqueConfiavel ? desequilibrioEntreLojas(lojas) : null;
    const concentradora = lojaConcentradora(lojas, gap);
    produtos.push({
      codigo: no.chave,
      nome: no.nome,
      metricas: no.metricas,
      meta: no.meta,
      gap,
      acao: acaoDoProduto(no.metricas, no.meta, desequilibrio !== null),
      lojas: desequilibrio
        ? { sobrando: desequilibrio.sobrando, faltando: desequilibrio.faltando }
        : concentradora
          ? { sobrando: [concentradora], faltando: [] }
          : null,
      equilibrio: percentualEquilibrio(no.metricas),
      causa: decomporGap(no.metricas, no.meta),
    });
  }

  // Ordem de VENDA, não de GAP: dentro do que já foi filtrado como "acima da meta",
  // o que mais pesa no faturamento é o que se trata primeiro (pedido de 2026-10-01).
  produtos.sort((a, b) => b.metricas.venda - a.metricas.venda);
  return { produtos, anexados, gapPulverizado, skusPulverizados, skus: nos.length, skusAcimaDaMeta };
}

function construirNivel(
  linhas: LinhaReduzida[],
  resolverMeta: ResolverMeta,
  opcoes: OpcoesPriorizacao,
  estoqueConfiavel: boolean,
  nivel: "secao" | "categoria",
): NoCascata[] {
  const indice = nivel === "secao" ? "secao" : "categoria";
  const nos = agruparComGap(
    linhas,
    resolverMeta,
    (l) => caminhoAteNivel(l.hierarquiaGrupos, indice),
    (_l, chave) => chave.split(" > ").at(-1) ?? chave,
  );

  const resultado: NoCascata[] = [];
  for (const no of nos) {
    const gap = no.gap ?? 0;
    if (gap < opcoes.piso) continue;
    const doNo = linhas.filter((l) => caminhoAteNivel(l.hierarquiaGrupos, indice) === no.chave);
    const filhos = nivel === "secao" ? construirNivel(doNo, resolverMeta, opcoes, estoqueConfiavel, "categoria") : [];
    const folha = nivel === "categoria" ? construirProdutos(doNo, resolverMeta, opcoes, estoqueConfiavel) : null;
    resultado.push({
      nome: no.nome,
      metricas: no.metricas,
      meta: no.meta,
      gap,
      skus: folha?.skus ?? new Set(doNo.map((l) => l.codigo)).size,
      skusAcimaDaMeta: folha?.skusAcimaDaMeta ?? 0,
      filhos,
      produtos: folha?.produtos ?? [],
      gapPulverizado: folha?.gapPulverizado ?? 0,
      skusPulverizados: folha?.skusPulverizados ?? 0,
      anexados: folha?.anexados ?? [],
    });
  }
  // Ordem de venda — mesma regra dos produtos.
  return resultado.sort((a, b) => b.metricas.venda - a.metricas.venda);
}

/**
 * Cascata completa de um Comprador num Formato. Só desce dentro de nó que está
 * acima da meta: não adianta listar os produtos caros de uma Seção que já está
 * economizando. É isso que mantém a lista curta — com piso de R$ 3.000, o
 * Varejo inteiro de Setembro/2026 deu 77 linhas de produto para 9 compradores.
 */
export function priorizarComprador(
  linhasDoFormato: LinhaReduzida[],
  comprador: string,
  formato: string,
  indiceComprador: IndiceDepartamentos,
  resolverMeta: ResolverMeta,
  opcoes: OpcoesPriorizacao,
): ResumoComprador {
  const minhas = linhasDoFormato.filter((l) => nomeCompradorPorDptoCadastro(indiceComprador, l.dpto, l.formatoLoja) === comprador);

  const porDpto = agruparComGap(
    minhas,
    resolverMeta,
    (l) => l.dpto,
    (l) => opcoes.nomeDepartamento(l.dpto),
  );
  const panorama = porDpto
    .map((no) => ({ dpto: no.chave, nome: no.nome, metricas: no.metricas, meta: no.meta, gap: no.gap }))
    .sort((a, b) => b.metricas.venda - a.metricas.venda);

  const metricas = metricasZeradas();
  for (const linha of minhas) acumular(metricas, linha);

  const pesoMeta = porDpto.filter((n) => n.meta !== null).reduce((t, n) => t + n.metricas.venda, 0);
  const metaPonderada = porDpto.filter((n) => n.meta !== null).reduce((t, n) => t + n.meta! * n.metricas.venda, 0);

  const departamentos: BlocoDepartamento[] = [];
  for (const no of porDpto.filter((n) => (n.gap ?? 0) > opcoes.piso).sort((a, b) => b.metricas.venda - a.metricas.venda)) {
    const doDpto = minhas.filter((l) => l.dpto === no.chave);
    const estoqueConfiavel = !DPTOS_ESTOQUE_NAO_CONFIAVEL.has(no.chave);
    const secoes = construirNivel(doDpto, resolverMeta, opcoes, estoqueConfiavel, "secao");
    // Departamento contábil sem Hierarquia de Grupos profunda o bastante cai direto
    // em Produto — mesmo fallback de `agregarDepartamento` em entradas-saidas/aggregate.ts.
    const folhaDireta = secoes.length === 0 ? construirProdutos(doDpto, resolverMeta, opcoes, estoqueConfiavel) : null;
    const skusDoDpto = agruparComGap(
      doDpto,
      resolverMeta,
      (l) => l.codigo || null,
      (l) => nomeProdutoDaLinha(l),
    );
    departamentos.push({
      dpto: no.chave,
      nome: no.nome,
      metricas: no.metricas,
      meta: no.meta,
      gap: no.gap ?? 0,
      estoqueConfiavel,
      skus: skusDoDpto.length,
      skusAcimaDaMeta: skusDoDpto.filter((s) => (s.gap ?? 0) > 0).length,
      skusPulverizados: folhaDireta?.skusPulverizados ?? 0,
      filhos: secoes,
      produtos: folhaDireta?.produtos ?? [],
      gapPulverizado: folhaDireta?.gapPulverizado ?? 0,
      anexados: folhaDireta?.anexados ?? [],
    });
  }

  const nomeDoProduto = (() => {
    const cache = new Map<string, string>();
    for (const l of minhas) if (!cache.has(l.codigo)) cache.set(l.codigo, nomeProdutoDaLinha(l));
    return (codigo: string) => cache.get(codigo) ?? codigo;
  })();

  const transferencias: ResumoComprador["transferencias"] = [];
  const vistos = new Set<string>();
  for (const bloco of departamentos) {
    const todos = [...bloco.produtos, ...bloco.filhos.flatMap((s) => [...s.produtos, ...s.filhos.flatMap((c) => c.produtos)])];
    for (const produto of todos) {
      if (produto.acao !== "TRANSFERIR" || vistos.has(produto.codigo)) continue;
      vistos.add(produto.codigo);
      transferencias.push({ produto, gapParado: produto.lojas?.sobrando.reduce((t, l) => t + (l.gap ?? 0), 0) ?? 0 });
    }
  }
  transferencias.sort((a, b) => b.gapParado - a.gapParado);

  const lancamentos = agruparComGap(
    minhas,
    resolverMeta,
    (l) => l.codigo || null,
    (l) => nomeProdutoDaLinha(l),
  )
    .filter((no) => motivoAnexo(no.metricas) === "lancamento" && no.metricas.compra >= opcoes.piso)
    .map((no) => ({
      codigo: no.chave,
      nome: no.nome,
      dpto: minhas.find((l) => l.codigo === no.chave)?.dpto ?? "",
      compra: no.metricas.compra,
      dataCadastro: opcoes.dataCadastro(no.chave),
    }))
    .sort((a, b) => b.compra - a.compra);

  return {
    comprador,
    formato,
    metricas,
    meta: pesoMeta > 0 ? metaPonderada / pesoMeta : null,
    gap: somarGaps(porDpto),
    departamentos,
    panorama,
    ruptura: itensEmRisco(minhas, nomeDoProduto, opcoes.diasDoPeriodo, opcoes.piso).slice(0, 15),
    transferencias: transferencias.slice(0, 12),
    inventario: estoqueNegativoComVenda(minhas, nomeDoProduto, opcoes.piso).slice(0, 12),
    lancamentos: lancamentos.slice(0, 12),
    metasFaltando: porDpto
      .filter((no) => no.meta === null && no.metricas.compra > 0)
      .map((no) => ({ dpto: no.chave, nome: no.nome, compra: no.metricas.compra, venda: no.metricas.venda })),
  };
}

/** Lista de compradores presentes nas linhas, sem o placeholder de departamento
 * sem dono (Apropriações) — que não é pessoa e não recebe relatório. */
export function compradoresPresentes(linhas: LinhaReduzida[], indiceComprador: IndiceDepartamentos): string[] {
  const nomes = new Set<string>();
  for (const linha of linhas) nomes.add(nomeCompradorPorDptoCadastro(indiceComprador, linha.dpto, linha.formatoLoja));
  return Array.from(nomes)
    .filter((nome) => nome && !/^s\/\s*comprador$/i.test(nome))
    .sort((a, b) => a.localeCompare(b, "pt-BR"));
}
