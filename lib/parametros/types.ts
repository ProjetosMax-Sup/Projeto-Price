/**
 * Cadastro de Lojas e Departamentos (docs/parametros.md, seções 2.2 e 2.3) —
 * substitui bdLojas.txt e as tabelas fixas compradores.ts/departamentos.ts
 * como fonte editável pela própria plataforma.
 */

export interface LojaCadastro {
  codigo: string;
  nomeCustomizado: string;
  formato: string;
  /** ISO "AAAA-MM-DD" — opcional. Quando preenchida, substitui a proxy de "1ª venda"
   * no filtro "Mesmas Lojas" (ver docs/regras-de-negocio.md). */
  dataAbertura?: string;
}

export interface DepartamentoCadastro {
  codigo: string;
  nome: string;
  mesmoCompradorTodosFormatos: boolean;
  comprador: string;
  compradorPorFormato: Record<string, string>;
}

/**
 * Seção 2.4 — chave é o usuário (username, mesmo da conta Clerk; sem e-mail —
 * contas são criadas manualmente pelo Gestor no painel do Clerk, ninguém se
 * cadastra sozinho).
 */
export interface UsuarioCadastro {
  usuario: string;
  nome: string;
  perfil: "Comprador" | "Gestor";
  /** Só relevante/obrigatório (≥1) quando perfil = Comprador. */
  departamentos: string[];
  /** Só relevante/obrigatório (≥1) quando perfil = Comprador. */
  lojas: string[];
}

/**
 * Dicionário de Colunas Nativas (seção 2.1) — catálogo documental de todas as
 * colunas do arquivo mensal (bd<Mês>.txt), auto-importado do cabeçalho real
 * (config/data-sources.ts > CABECALHO_REFERENCIA_MENSAL). Puramente
 * informativo: não decide o que aparece num relatório (isso é ColunaRelatorio,
 * seção 3.1) — só documenta nome/tradução/tipo de cada coluna existente.
 */
export interface ColunaNativa {
  /** Identidade da coluna nas configurações de relatório: o **nome** dela no arquivo
   * (`nomeArquivo`), não a posição. Nome é estável; posição não — em 2026-09-29 o ERP
   * exportou o `bdSetembro` com 4 colunas a menos e deslocou tudo depois da posição 74,
   * o que faria toda config apontar pra coluna errada silenciosamente (ver
   * `docs/exemplos-motor-colunas/README.md`, cenário 4). */
  ref: string;
  /** Posição no arquivo — informativa (ordem de exibição do dicionário e rastreio da
   * origem). Nunca usar como identidade: muda quando o ERP altera o layout. */
  posicao: number;
  /** Nome bruto combinado (as duas linhas do cabeçalho). */
  nomeArquivo: string;
  /** Como exibir — sem isso, "Valor" e "Qtde Vendas" sairiam do mesmo jeito na tela. */
  formato?: FormatoColuna;
  /** A que movimento se aplica (ex.: "Vendas", "Compras", "Estoque") — editável, texto livre. */
  movimento: string;
  /** Tradução/significado amigável — editável. */
  traducao: string;
  tipoDado: "Texto" | "Número" | "Data";
  /** SKU/Código Unidade/Data — nunca aparecem como coluna selecionável num relatório (seção 3.1). */
  chaveAutomatica: boolean;
}

export type SinalTermo = "+" | "-";

/** Um termo de fórmula: um sinal + uma coluna (nativa ou calculada) já existente no relatório. */
export interface TermoFormula {
  sinal: SinalTermo;
  colunaRef: string;
}

/** Como o número aparece na tela e na exportação. Não é decoração: "DDE" e "% Lucro"
 * são as duas uma razão, mas uma é quantidade de dias e a outra é percentual. */
export type FormatoColuna = "moeda" | "percentual" | "numero" | "pontosPercentuais";

/**
 * Os tipos de conta que o avaliador sabe executar (`lib/parametros/avaliador.ts`).
 * Cada tipo novo é uma função a mais lá e um formulário a mais no editor — nunca
 * mexe em relatório que já funciona. Ver `docs/manual-de-formulas.md`.
 *
 * `formato` é opcional: sem ele vale o padrão do tipo (ver `formatoDaCalculada`).
 */
export type ColunaCalculada =
  /** Combinação linear de colunas — a única que soma normalmente na agregação. */
  | { id: string; nome: string; tipo: "soma"; termos: TermoFormula[]; formato?: FormatoColuna; oculta: boolean }
  /** Divisão de dois grupos de termos; só existe depois de agregar. */
  | {
      id: string;
      nome: string;
      tipo: "razao";
      numerador: TermoFormula[];
      denominador: TermoFormula[];
      formato?: FormatoColuna;
      oculta: boolean;
    }
  /** O valor de outra coluna no período escolhido — é assim que "Comparação" deixa
   * de ser um punhado de colunas fixas e passa a valer pra qualquer coluna. */
  | {
      id: string;
      nome: string;
      tipo: "valorDoPeriodo";
      coluna: string;
      periodo: "atual" | "comparacao";
      formato?: FormatoColuna;
      oculta: boolean;
    }
  /** Variação percentual de uma coluna contra o período de Comparação. */
  | { id: string; nome: string; tipo: "desvio"; coluna: string; formato?: FormatoColuna; oculta: boolean }
  /** Diferença em pontos percentuais entre Atual e Comparação — pra coluna que já é %. */
  | { id: string; nome: string; tipo: "difPP"; coluna: string; formato?: FormatoColuna; oculta: boolean }
  /** Diferença entre duas colunas quaisquer do MESMO período (não Atual×Comparação
   * como difPP — ex.: "Meta - Realizado" no Compra e Venda). `heatmap` pinta a
   * célula numa escala vermelho→verde pelo valor em vez do texto cinza padrão. */
  | {
      id: string;
      nome: string;
      tipo: "diferenca";
      colunaA: string;
      colunaB: string;
      formato?: FormatoColuna;
      heatmap?: boolean;
      oculta: boolean;
    };

/**
 * Papéis das colunas — âncoras pro código. Nenhuma parte do app pode depender do
 * NOME de uma coluna ("Venda" pode virar "Faturamento" em outra rede) nem do ref
 * direto (a composição muda por cliente): quem precisa de "a coluna principal"
 * pergunta pelo papel. Ver `docs/exemplos-motor-colunas/README.md`, cenário 5.
 */
export interface PapeisRelatorio {
  /** Ref de nativa ou id de calculada que alimenta KPI, Top Altas/Quedas e ordenação padrão. */
  principal?: string;
}

/**
 * Configuração "Por Relatório" (seção 3) — uma por módulo (slug), 100%
 * independente das demais mesmo quando duas colunas calculadas de módulos
 * diferentes têm o mesmo nome.
 */
export interface ConfigRelatorio {
  modulo: string;
  /** Refs de ColunaNativa marcadas como visíveis (checklist da aba Nativas). */
  nativasVisiveis: string[];
  calculadas: ColunaCalculada[];
  /** Ordem final de exibição (refs de nativa ou id de calculada) — só a aba Ativas decide isso. */
  ordemAtivas: string[];
  /**
   * Nome da coluna **neste relatório**, por ref de nativa — sobrepõe a tradução do
   * Dicionário. A mesma coluna do arquivo é "R$ Valor Total Atual" no Desempenho
   * Comercial e "Vendas" no Entradas e Saídas; o Dicionário guarda como o ERP
   * chama ("Valor"), que é outra coisa. Calculada não precisa disso: o `nome` dela
   * já é por relatório. Ausente = usa a tradução do Dicionário.
   */
  rotulos?: Record<string, string>;
  /** Ausente enquanto ninguém tiver escolhido uma coluna principal neste relatório. */
  papeis?: PapeisRelatorio;
  /**
   * Metas cadastradas manualmente (não vêm do arquivo) — chave `"<códigoDpto>|<formato>"`,
   * valor no mesmo formato exibido pela coluna que a usa (ex.: 79 = 79%). Fixa até
   * alguém editar de novo (decisão de 2026-09-30: sem histórico por mês). Injetada
   * como ref sintético `"Meta"` na agregação de quem precisar dela (ver
   * `lib/compra-venda/aggregate.ts`) — não é uma coluna do Dicionário.
   */
  metas?: Record<string, number>;
  /** "Quem acessa este relatório" (seção 3.3) — condição 1 das duas que precisam valer juntas. */
  acessoComprador: boolean;
  acessoGestor: boolean;
  status: "Rascunho" | "Publicado";
}
