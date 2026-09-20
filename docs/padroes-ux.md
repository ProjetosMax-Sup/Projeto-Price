# Padrões de UX — módulo Desempenho Comercial

Referência de comportamento pra manter consistência nos próximos módulos.

## Design system

Cores extraídas da logo oficial da MAX:

| Token | Hex | Uso |
|---|---|---|
| `azul` (primário) | `#004C97` | header, ações primárias, destaque |
| `vermelho` (marca/alerta) | `#E30000` | badge "SUPERMERCADOS", alertas, desvio negativo |
| Verde (não é cor de marca) | `#1E9E62` | desvio positivo — semáforo |

Tipografia: **Manrope** (display/headings) + **IBM Plex Sans** (corpo) via Google
Fonts. Evitar Inter/Roboto/Arial (padrão genérico de IA).

Painéis de tabela (Estrutura Mercadológica, Lojas, Top Altas/Quedas) usam
cabeçalho sólido `azul` com texto branco (igual ao header do site) — não só a
barra de título do site, os painéis internos também carregam a cor da marca.
Linha de subtotal em `azul/10` com números em `azul` negrito; linha
selecionada (produto/loja) em `vermelho/10`; zebra sutil nas linhas pares.

## Padrões de comportamento

1. **KPI cards reativos ao filtro** — Venda, Lucro, %Lucro sempre refletem o recorte
   ativo (categoria × loja × produto selecionados), não um total fixo da empresa.
   Mostrar claramente que os números refletem o recorte quando ele não é "toda a
   empresa × todas as lojas". Ticket Médio foi removido dos cards (cálculo com
   inconsistência a investigar antes de voltar a exibir).
2. **Duas tabelas que se filtram mutuamente**: Estrutura Mercadológica (com
   drill-down completo Departamento → Seção → Categoria → Grupo → Sub Grupo →
   **Produto**, via breadcrumb clicável pra voltar a qualquer nível) e Lojas,
   **empilhadas** (Lojas abaixo de Estrutura, não lado a lado — as duas
   ocupam a largura toda pra caber o conjunto grande de colunas abaixo).
   - Produto (folha do drill-down) é rotulado no padrão "Código - Descrição -
     Complemento" e agrupado por SKU (não faz parte da Hierarquia de Grupos).
   - Clicar numa linha de Departamento/Seção/Categoria/Grupo/Sub Grupo desce um
     nível (breadcrumb cresce) e também filtra a tabela de Lojas pra mostrar a
     performance daquele nó em cada loja.
   - Clicar num Produto **não desce nível** (é a folha) — em vez disso
     seleciona aquele SKU específico (clique de novo desmarca), filtrando
     KPIs e a tabela de Lojas pela performance daquele produto por loja, sem
     sair da lista de produtos irmãos (pra comparar vários rapidamente).
   - Clicar numa loja filtra a tabela de Estrutura para mostrar só a performance
     daquela loja (clique de novo para desmarcar).
   - Barra de status mostrando o recorte ativo + botão "Limpar seleção".
   - Cliques nas tabelas (e no breadcrumb) ficam bloqueados enquanto uma busca
     está em andamento — evita que um clique numa tabela desatualizada empurre
     um nó errado/duplicado pro breadcrumb.
   - **Subtotal como primeira linha** de cada tabela (Estrutura e Lojas, não no
     rodapé), somando as linhas visíveis.
   - **Conjunto rico de colunas** (mesmo em Estrutura e em Lojas — layout
     inspirado numa planilha de referência do usuário): R$ Valor/Lucro Total
     Atual e Comparação, %Desv. Valor/Lucro, %Lucro Total Atual/Comparação,
     P.P Desv. Lucro, %Part. Of (participação da Oferta no Valor) Atual/
     Comparação, %Lucro Of Atual/Comparação, %Lucro Regular Atual/Comparação,
     Part. (participação no total geral) — mesmo conjunto nos dois painéis,
     largura fixa por coluna (cabeçalho quebra em vez de alargar). P.P Desv.
     Lucro é diferença entre dois percentuais (pontos percentuais) — mostrado
     com sufixo "pp", não "%", pra não confundir com uma variação relativa.
   - **Colunas clicáveis pra ordenar** — clique alterna asc/desc. Ordenação
     padrão (sem coluna escolhida) da 1ª coluna: por código em todos os
     níveis de Estrutura, exceto Produto, que ordena por nome/descrição
     (código de SKU não é uma sequência significativa); Lojas ordena por
     código da loja. Clicar explicitamente na 1ª coluna segue a mesma regra
     (código vs. nome conforme o nível).
   - **1ª coluna fixa** em ambas as tabelas — rolando a tabela pra o lado, o
     nome do Departamento/Produto/Loja nunca some de vista.
   - **Scroll sticky sequencial**: Bloco de Filtros+KPIs fica fixo no topo da
     página; ao rolar e alcançar a 1ª tabela (Estrutura), o cabeçalho de
     colunas dela passa a grudar logo abaixo do bloco Filtros+KPIs enquanto as
     linhas rolam por baixo; ao alcançar a 2ª tabela (Lojas), o cabeçalho da
     Estrutura solta e o da Lojas assume o mesmo lugar — nunca dois
     cabeçalhos grudados ao mesmo tempo. Implementado só com CSS
     (`position: sticky` + `overflow-x-auto` sem altura limitada em cada
     tabela, que o navegador promove a ancestral de scroll também no eixo
     vertical), sem JavaScript de scroll. Ao trocar de tabela, a barra de
     título azul da próxima rola visivelmente na tela por um instante antes
     do cabeçalho dela grudar — esperado, não é bug. Só se aplica ao modo
     Tabela de cada painel (Ranking, em Estrutura ou em Lojas, não tem
     cabeçalho de colunas pra grudar).
   - **Valores de Comparação marcados visualmente** (itálico + fundo
     ligeiramente sombreado) em todas as colunas "…Comparação", pra não
     confundir com os valores do período Atual ao ler a tabela.
3. **Toggle Tabela ↔ Ranking** em Estrutura e em Lojas (independentes um do outro) —
   Tabela é a visão detalhada com todas as colunas; Ranking é barras horizontais
   ordenadas por Venda Atual (maior → menor), mais rápidas de escanear. Em Lojas, a
   barra também é clicável (mesmo comportamento de seleção da linha na Tabela,
   incluindo shift+clique).
4. **Painel Top Altas/Quedas** com **toggle de nível independente** (Seção /
   Categoria / Grupo) — ranqueia por %Desvio de Venda no nível escolhido, escopado
   pela loja selecionada (se houver) e **preso só ao Departamento** selecionado
   (1º nó do caminho de drill-down) — continua mostrando a visão daquele
   departamento mesmo descendo mais fundo (Seção → Categoria → Grupo → Sub
   Grupo → Produto), não precisa acompanhar o drill-down inteiro. Rótulo no
   formato "Departamento - Nome"; um item nunca aparece nos dois grupos ao
   mesmo tempo (quem caiu não entra em Altas, quem subiu não entra em Quedas).
5. **Semaforização automática**: todo %Desvio (venda e lucro) fica verde
   (positivo) ou vermelho (negativo) — cor + fundo leve, nunca só a cor do texto.
6. **Ordenação em modo Tabela por código** (`003 - Bazar`, `002 - Vila Mutirão`)
   por padrão — ver "Colunas clicáveis pra ordenar" acima. Modo Ranking continua
   ordenado por valor (maior → menor).
7. **Exportar Excel / PDF** — botões no header (ver "Exportação" abaixo).
8. Filtros no topo: Loja, Formato (Varejo/Atacado), Comprador e Departamento
   são todos **multi-seleção**. Todo multi-seleção com **mais de 2 opções**
   ganha "Selecionar tudo" ao lado de "Limpar seleção" (lado a lado, no topo
   do dropdown) — Formato (só 2 opções) fica só com "Limpar seleção". Em
   qualquer um desses multi-seleção, opção sem nenhuma movimentação **relevante
   pra este módulo** no recorte atual (período + os outros filtros já ativos)
   continua aparecendo na lista, mas com fonte apagada e não dá pra marcar —
   só some se o usuário já tinha marcado antes e o recorte mudou embaixo
   dela, aí ainda dá pra desmarcar normalmente. "Selecionar tudo" pula essas
   opções desabilitadas. "Relevante pra este módulo" ≠ "linha existe no
   arquivo": em Desempenho Comercial é `valorTotal > 0` (venda), não só
   presença do registro — um ajuste/baixa com valor zerado não conta como
   movimentação aqui. Cada módulo futuro (Entradas e Saídas, Compra e Venda,
   ...) define seu próprio critério — não é uma regra fixa pro sistema
   inteiro (`acumularOpcoesComDados` em `lib/desempenho/consulta.ts`).
   Toggle **Total Lojas / Mesmas Lojas** (ver
   docs/regras-de-negocio.md) com ⓘ explicando o critério.
   Período Atual e Período de Comparação são **editáveis** por um calendário
   (dois meses lado a lado, clique na data inicial → clique na final, faixa
   conectada em azul entre as duas) — como só dá pra clicar em dias reais do
   calendário, não existe "data inválida" pra validar. Dias sem dado no
   arquivo correspondente ficam desabilitados (cinza). Padrão (nada escolhido
   ainda ou botão "Voltar ao período padrão"): Atual = mês mais recente com
   dado, Comparação = o mês imediatamente anterior — nunca mais "período
   automático = range completo do conjunto disponível". Dentro do seletor de
   Comparação, dois atalhos de mês rápido: "Mesmo período, mês" (qualquer mês do mesmo
   ano do Atual) e "Mesmo período, ano anterior" (qualquer mês do ano
   anterior) — aplicam o mesmo intervalo de dias do Atual no mês escolhido. Os dois
   seletores (Atual e Comparação) compartilham o mesmo conjunto de datas disponíveis
   — "Atual"/"Comparação" nunca foram duas fontes de dado diferentes, sempre foram só
   dois recortes de data sobre o mesmo conjunto (ver `docs/fonte-de-dados.md`).
9. Navegação entre os 5 módulos como abas no header (mesmo estando só o primeiro
   implementado).
10. **Badge de cadastro pendente é clicável** — baixa um `.txt` com os códigos
    (SKU) dos produtos descartados por hierarquia incompleta (ver
    docs/regras-de-negocio.md).

## Exportação

Exportar Excel/PDF gera o arquivo a partir do recorte ativo (mesmos números
exibidos nos KPIs, na Estrutura Mercadológica e nas Lojas no momento do clique).

- Excel: `exceljs` (client-side) — planilhas "Resumo", "Estrutura Mercadológica"
  e "Lojas". Não usar o pacote `xlsx`/SheetJS — a versão publicada no npm tem
  vulnerabilidade conhecida sem correção.
- PDF: `jspdf` + `jspdf-autotable` (client-side) — cabeçalho com recorte ativo e
  KPIs, seguido das mesmas duas tabelas, paisagem.
- Implementação em `lib/desempenho/export.ts`, chamada pelos botões do header em
  `components/desempenho/DesempenhoDashboard.tsx`.
