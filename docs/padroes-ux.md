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
   - **Cabeçalho da tabela travado ao rolar** — títulos das colunas ficam
     fixos no topo do próprio container da tabela. Bloco de Filtros+KPIs no
     topo da página também fica fixo, soltando só quando a 1ª tabela
     (Estrutura) chega, pra abrir espaço pro cabeçalho dela.
   - **Valores de Comparação marcados visualmente** (itálico + fundo
     ligeiramente sombreado) em todas as colunas "…Comparação", pra não
     confundir com os valores do período Atual ao ler a tabela.
3. **Toggle Tabela ↔ Ranking** no painel de Estrutura — Tabela é a visão detalhada
   com todas as colunas; Ranking é barras horizontais ordenadas por valor, mais
   rápidas de escanear.
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
8. Filtros no topo: Loja, Formato (Varejo/Atacado) e Comprador são todos
   **multi-seleção**. Período Atual e Período de Comparação mostrados como
   texto estático (não clicável, sem seletor), sempre calculados a partir do
   min/máx de `Data` do respectivo arquivo — nunca configurados manualmente
   (ver docs/fonte-de-dados.md). Formato fixo pros dois: "DD a DD/MMM AAAA
   Atual"/"... Comparação".
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
