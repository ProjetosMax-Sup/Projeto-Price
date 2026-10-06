# Regras de negócio — Desempenho Comercial

## Qualidade de cadastro

Produtos com hierarquia mercadológica incompleta (ex: caem em "Verificar Dpto") que
tenham **movimentação** (venda > 0) **não deveriam aparecer** nos relatórios — é
rotina da equipe do usuário tratar/corrigir esses produtos regularmente.

Se algum produto nessa situação aparecer com movimentação:
- **avisar o usuário**
- exibir contagem num **badge discreto na interface** (não um banner chamativo);
  clicar no badge baixa um `.txt` com os códigos (SKU) desses produtos, pra
  facilitar levar a lista pra quem corrige o cadastro
- excluir esses produtos dos números consolidados até serem corrigidos

⚠️ A contagem é de **produtos (SKU) únicos**, não de linhas — o mesmo produto
tem uma linha por loja/dia em cada arquivo mensal (`bd<Mês>.txt`), então contar
linhas infla o número (`lib/data-providers/normalizar-desempenho.ts`,
`normalizarMovimentos`, usa um `Set` de códigos por arquivo, unidos depois por
`unirMovimentos` — o mesmo SKU descartado em vários meses conta só 1 vez).

## Insumo de produção não é linha de produto

Produtos cuja **Descrição começa com "Insumo"** (`ehInsumo` em
`lib/compra-venda/aggregate.ts`) existem só pra comprar e produzir: entram na
receita de outro produto, e **a venda é lançada no produto final**, nunca
neles. São ~500 SKUs, concentrados em Padaria Própria (dpto 004) e
Apropriações (099). Todos usam esse prefixo; **não existe coluna de tipo no
`bdCadastro`** que os separe — `Tipo`, `Função` e `Classe` foram verificados e
não servem, a Descrição é o único marcador.

Regra (pedido de 2026-10-05), e a distinção é o ponto todo:

- ✅ **O valor continua contando em tudo** — Compra, Venda, % C/V, GAP, de
  Produto até o Total da rede, na tela e nos dois PDFs.
- ❌ **Não pode virar linha de produto cobrada do comprador**, nem na lista de
  ação nem nos anexos. Insumo compra sem vender *por definição*, então
  apareceria sempre com GAP cheio e em "Comprou e ainda não vendeu", todo mês,
  sem nada pro comprador fazer.

Dois cortes, porque são dois caminhos diferentes até a vista:

| Onde | O que barra |
|---|---|
| `construirProdutos` (`priorizacao.ts`) | a linha na lista de ação e nos anexos de trava de cadastro — antes de `motivoAnexo`, pra não cair em nenhum dos dois |
| `lancamentos` (`priorizarComprador`) | o anexo "Comprou e ainda não vendeu", que é calculado à parte, direto sobre todas as linhas |

⚠️ **Por que o valor não pode sair**: em Setembro/2026, insumo era **92% da
Compra de Padaria Própria** (R$ 762,7 mil de R$ 829,7 mil). Descontá-lo levaria
o departamento de **47,5% para 3,8% de C/V** — pareceria não comprar nada, com
um GAP negativo falso. A compra do insumo é a compra de verdade de quem produz.

O GAP do insumo fica dentro do subtotal sem ter linha própria, então a conta
"listados + pulverizados = acima da meta" não fecharia sozinha. Por isso
`NoCascata.gapInsumo`/`skusInsumo` existem e o PDF declara o valor na linha de
contagens da Categoria — o número continua conferível.

Detalhe de hierarquia que muda onde o corte pega: 359 dos insumos de Padaria
têm **só 2 níveis** de Hierarquia de Grupos ("Padaria Propria, Padaria - In"),
e `caminhoAteNivel` devolve `null` em Categoria — ou seja, esses nunca
chegavam a virar linha de produto, só apareciam no anexo. Os outros (4-5
níveis, "Apropriacoes, Brinde Diversos, ...") chegavam. Daí os dois cortes.

## Lojas fora da plataforma

`LOJAS_EXCLUIDAS` (`config/data-sources.ts`) lista códigos de loja que a
plataforma inteira ignora — hoje só a **013 (Max Atacadista Noroeste)**, "por
enquanto", pedido de 2026-10-05. **Não é regra de negócio, é um interruptor
temporário**: esvaziar a lista traz a loja de volta e nada mais precisa ser
desfeito.

Onde o corte acontece, e por que em mais de um lugar:

| Lugar | Por quê |
|---|---|
| `normalizarLojas` | tira do `bdLojas.txt`, que alimenta o cadastro de Lojas e, por ele, todo seletor de Loja |
| `normalizarMovimentos` | tirar só do mapa de lojas **não bastaria** — o registro continuaria no conjunto com `loja: null` e os totais do Desempenho Comercial seguiriam somando-o |
| `normalizarEntradasSaidas` | mesmo corte na 2ª passada, que serve Entradas e Saídas, Compra e Venda e os dois PDFs |
| `obterOuSemearLojasCadastro` | o cadastro já estava **salvo** com a 013 (Redis / `data/parametros/lojas.json`) — filtra na leitura, sem apagar o que está gravado |
| `salvarLojasCadastro` | a tela /parametros só enxerga a lista filtrada; salvar o que vem dela apagaria a 013 do cadastro de vez. A função a preserva |

Na prática a 013 **não tem nenhuma linha nos arquivos mensais** (conferido em
`bdSetembro`/`bdOutubro`: só as lojas 002–012). O efeito visível é ela sumir do
filtro de Loja e parar de virar um bloco vazio no PDF por Loja — os números de
rede não mudam.

## Compradores padronizados por Departamento

✅ Confirmado com o usuário: a coluna `Compr`/`Nome Comprador` de `bdCadastro`
não é confiável — o comprador exibido no app vem de uma tabela fixa por Dpto
(`lib/desempenho/compradores.ts`), não do arquivo. Dois departamentos (Açougue
e Hortifruti) têm comprador diferente por Formato de loja (Varejo × Atacado);
os demais têm um único comprador nos dois formatos.

```
001 - Acougue         - Johathan (Varejo) / Jairo (Atacado)
002 - Peixaria         - Johathan
003 - Hortifruti       - Marrone (Varejo) / Jairo (Atacado)
004 - Padaria Propria  - Nil
005 - Padaria Industria- Nil
006 - Pereciveis Frios e Congelados - Johathan
007 - Pereciveis Lacteos - Bruna
008 - Mercearia Basica - Divino
009 - Mercearia Leite  - Manoel
010 - Mercearia Doce   - Bruna
011 - Mercearia Salgada- Ricardo
012 - Mercearia Saudavel - Bruna
013 - Bebidas          - Sandro
014 - Limpeza          - Manoel
015 - Perfumaria       - Manoel
016 - Bazar            - Edvaldo
017 - Eletro           - Edvaldo
018 - Sazonais         - Bruna
099 - Apropriacoes     - S/ Comprador
```

## Códigos de Departamento (Dpto) confirmados

```
001 - Acougue
002 - Peixaria
003 - Hortifruti
004 - Padaria Propria
005 - Padaria Industria
006 - Pereciveis Frios e Congelados
007 - Pereciveis Lacteos
008 - Mercearia Basica
009 - Mercearia Leite
010 - Mercearia Doce
011 - Mercearia Salgada
012 - Mercearia Saudavel
013 - Bebidas
014 - Limpeza
015 - Perfumaria
016 - Bazar
017 - Eletro
018 - Sazonais
099 - Apropriacoes
```

## Mesmas Lojas × Total Lojas

Toggle nos Filtros principais (`Filtros.mesmasLojas`, padrão `false` = Total Lojas —
comportamento de sempre). Conceito de "vendas em lojas comparáveis" (same-store sales):
"Mesmas Lojas" exclui dos **totais e subtotais** (KPIs, Estrutura Mercadológica, Top
Altas/Quedas, e o subtotal do painel Lojas) as lojas que não estavam abertas desde o
início dos **dois períodos comparados ao mesmo tempo** (Atual e Comparação) — uma loja
só entra na conta se já estava aberta no início dos dois, senão a comparação fica
capenga (loja existe de um lado, não existe do outro). Só avaliável quando os dois
períodos estão definidos (`periodoAtual` e `periodoComparacao` não-nulos); sem os dois,
não há "início" pra comparar e todas as lojas contam normalmente.

⚠️ **Sem coluna de data de abertura em `bdLojas.txt`** — a "abertura" é inferida pela
**primeira data com venda registrada (valor > 0)** da loja, olhando os **dois arquivos
juntos** (Atual + Comparação, não cada um isolado) — pega a data mais antiga entre os
dois. Regra de tolerância: considerada aberta se essa primeira venda cai até **2 dias
corridos** depois do início do período avaliado — folga pra não penalizar loja que só não
vendeu nos primeiros dias por causa de feriado (`lojaAbertaDesdeInicio` em
`lib/desempenho/datas.ts`).

✅ Confirmado com o usuário (depois de um teste com dados fictícios pegar um caso real):
usar os DOIS arquivos juntos pra achar a "1ª venda" é essencial pra não confundir uma
loja que só ficou **fechada temporariamente** (feriado, reforma — já tinha histórico
antes, em qualquer um dos dois períodos) com uma loja **genuinamente nova** (nunca vendeu
antes em nenhum dos dois). Só a segunda deve contar como "loja nova" pro filtro.

**Dois avisos visuais distintos no painel Lojas** (a linha continua aparecendo com os
números reais nos dois casos — só o critério de destaque muda):
- 🔴 **Borda vermelha** — loja fora do total: nunca vendeu antes do início de nenhum dos
  dois períodos (critério acima). Só entra quando "Mesmas Lojas" está ativo; sem borda
  quando é "Total Lojas".
- 🟡 **Borda amarela** — loja com fechamento: tem pelo menos um dia sem venda logo depois
  de um dia com venda, dentro de um dos períodos (`intervalosFechamento` em
  `lib/desempenho/datas.ts`) — só um aviso informativo, **não afeta o total** mesmo com
  "Mesmas Lojas" ativo, e aparece independente do toggle. Passar o mouse na loja mostra o(s)
  intervalo(s) exato(s) sem venda (ex: "Sem movimentação — Atual: 08/09 a 09/09"). Se a loja
  for as duas coisas ao mesmo tempo (nova E com fechamento depois de abrir), mostra só a
  vermelha (tem prioridade visual).

Um ⓘ ao lado do toggle "Total Lojas / Mesmas Lojas" explica o critério.

⚠️ A proxy de "1ª venda" ainda é imprecisa perto da borda mais antiga do conjunto de
dados disponível (não dá pra saber se a loja já existia antes do histórico disponível)
— só fica cada vez mais confiável conforme o histórico acumular (mais meses
disponíveis), ou se um campo de data de abertura de verdade vier no cadastro de Lojas
da tela de Parâmetros (ver `docs/parametros.md` seção 2.2 — construída, mas sem esse
campo ainda).

## Em aberto / a validar com o usuário

- Metas/objetivos ficaram fora de escopo por enquanto (mencionado explicitamente
  pelo usuário ao revisar referências de outra rede)
- ✅ Reestruturação dos arquivos-fonte (`bdDesempenhoComercial*` → um arquivo por mês)
  **executada** — ver `docs/fonte-de-dados.md` e `docs/parametros.md` seção 1.
- ✅ Camada de Parâmetros (etapas 1–5 de `docs/parametros.md` seção 7) **executada**:
  cadastro editável de Lojas/Departamentos, Usuários e Acesso + Clerk, motor de colunas
  (Nativas/Calculadas/Ativas) e migração do Desempenho Comercial pra ler tudo isso —
  não usa mais `bdLojas.txt`/tabelas fixas em runtime, só pra semear o cadastro na
  1ª leitura. Falta a etapa 6 (Entradas e Saídas como módulo, usando a camada nova) e
  a 7 (reprocessamento manual/cron reaproveitando o motor de colunas).
