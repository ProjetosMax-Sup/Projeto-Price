# Parâmetros — Especificação para Implementação

> Complementa `CLAUDE.md` e os demais docs em `docs/`. Trata da reestruturação dos
> arquivos-fonte (um por mês, multi-movimento) e da nova camada de **Parâmetros**
> que passa a governar colunas, cálculos, cadastro de Lojas/Departamentos e acesso
> de usuários — tudo pensado para ser reaproveitado pelos módulos que ainda faltam
> (Entradas e Saídas, Compra e Venda, Perdas e Quebras, Raio X Fornecedor).
>
> Protótipo navegável de referência (Claude Artifact, não é o app final — usar só
> como guia de comportamento e fluxo, não de pixel):
> https://claude.ai/artifact/Rhiv63ZeYY9zNSuT6ftg5L

## 1. Reestruturação dos arquivos-fonte

✅ **Seções 1 e 1.1 executadas** — `FileDataProvider`/`OneDriveDataProvider` já leem
só os arquivos mensais (`bd<Mês>.txt`), `bdDesempenhoComercialAtual.txt`/
`...Comparação.txt` saíram de uso (código não referencia mais, arquivos continuam no
disco). Validado contra os 8 meses reais disponíveis (Janeiro–Junho, Agosto,
Setembro — falta só Julho). Detalhe técnico completo em `docs/fonte-de-dados.md`.

- **Um arquivo por mês** (ex.: `bdSetembro.txt`, `bdOutubro.txt`), substituindo
  `bdDesempenhoComercialAtual`/`...Comparação`. Nome real leva prefixo `bd`.
- Mesmo formato dos arquivos atuais: delimitado por `|`, encoding **ISO-8859-1
  (Latin-1)**, cabeçalho em **2 linhas**, colunas **sempre na mesma posição** —
  nunca mudam de mês pra mês.
- Analisamos uma amostra real (`Setembro.txt`, sem o prefixo `bd`, ~83 colunas,
  ~390 mil linhas) e confirmamos:
  - **Não existe coluna "Tipo Movimento"** — cada tipo de movimentação já é uma
    coluna própria (ex.: `Compras`, `Compras | Líquidas`, `Compras | Ct Empresa`,
    `Compras | Vl NFe`, `Outras (Entradas)`, `Transfer. (Entradas)`,
    `Devoluções (Venda)`, `Trocas (Entradas)`, `Bonific (Entradas)`,
    `Consig (Entradas)`, `Produção`, `Sobras (Estoque)`, e o espelho do lado
    de saída: `Perdas`, `Outras (Saídas)`, `Transfer. (Saídas)`,
    `Devoluções (Compra)`, `Trocas (Saídas)`, `Doações`, `Bonific (Saídas)`,
    `Consig (Saídas)`, `Consumos (Internos)`, `Transf (Mat. Prima)`,
    `Faltas (Estoque)`, entre outras). O motor de cálculo soma ou não soma uma
    coluna — nunca filtra linha por um campo de tipo.
  - `Dpto` (código do departamento, 3 dígitos) e o código da Unidade **vêm
    diretos em cada linha** — não dependem de join com `bdCadastro` para
    identificar departamento/loja.
  - O nome da loja também vem na linha, mas **cru/feio** (ex.: `Ap.Independência`)
    — por isso o cadastro de Lojas com Nome Customizado (seção 3).
  - `bdCadastro` **continua existindo separado** — a nova base só duplica
    `Descricao`/`Marca` como conveniência; a hierarquia mercadológica completa
    (até 5 níveis) e outros dados de apoio seguem vindo de lá.
  - Números em formato BR (vírgula decimal, ponto de milhar); **estoque pode
    ser negativo** — não assumir não-negatividade no parser.
  - Granularidade: uma linha por **SKU × Loja × Dia**, e só existe linha nos
    dias em que houve movimento (arquivo esparso, não um calendário denso).
  - A coluna `Código/Nome Fornecedor` é o **Fornecedor Padrão** (a indústria à
    qual o produto pertence) — muitos itens ainda não têm isso preenchido.
    Fora de escopo por ora: subida em massa desse dado e a regra de negócio
    para tratar itens sem Fornecedor Padrão no Raio X Fornecedor ficam para
    depois (não travar nada agora — mesmo tratamento de badge/exclusão que já
    existe para hierarquia incompleta, até essa regra ser definida).
- **Identificador único de uma coluna nunca é só a 1ª linha do cabeçalho** — ela
  se repete (ex.: `Compras` aparece 4x, `Qtde` aparece 4x). O identificador real
  é a **combinação das duas linhas do cabeçalho** (ex.: `Compras | Líquidas`).
- Ao processar o arquivo, o parser deve **importar o cabeçalho inteiro
  automaticamente** (nome bruto combinado + posição) para popular o Dicionário
  de Colunas Nativas (seção 2.1). Não faz sentido pré-cadastrar as ~83 colunas
  na mão — a tradução/seleção acontece depois, dentro da própria plataforma.

### 1.1 Desligar a lógica de `Atual`/`Comparação`

- **A lógica que lê `bdDesempenhoComercialAtual` e
  `bdDesempenhoComercialComparação` deve ser desativada** — não referenciar
  mais esses dois arquivos em `lib/data-providers/file-provider.ts` nem em
  `lib/desempenho/consulta.ts`. Esses dois arquivos saem de uso.
- O `FileDataProvider` passa a ler **exclusivamente os arquivos mensais**
  (`bdJaneiro.txt`, `bdFevereiro.txt`, ..., `bdJulho.txt`, `bdAgosto.txt`,
  `bdSetembro.txt`, ...) — já testamos e confirmamos essa estrutura em três
  meses reais (Julho, Agosto, Setembro).
- Cada arquivo mensal **chega já unificado** — um único par de linhas de
  cabeçalho, um arquivo por mês. Quando o mês é exportado do ERP em vários
  pedaços (aconteceu em Julho e Agosto — blocos de dias, pra não travar a
  geração), a unificação é feita **antes** de o arquivo chegar na aplicação;
  o parser nunca precisa lidar com múltiplos arquivos do mesmo mês.
- **Cabeçalho real confirmado** (as duas linhas, validadas em Julho, Agosto e
  Setembro — usar como referência de validação, não como suposição):

  ```
  Linha 1: Código|Descricao|Complemento|Marca|Dpto|Código Barras|Unidade|Unidade|Qtde|Qtde Outras|Qtde Transf|Qtde Devoluções|Qtde Trocas|Qtde Bonif|Qtde Consig|Qtde|Qtde Sobras|Qtde Simp Rem|Qtde Reman|Compras|Compras|Compras|Compras|Outras|Transfer.|Devoluções|Trocas|Bonific|Consig|Produção|Sobras|Simp. Rem.|Valor Reman|Qtde|Qtde Vendas|Qtde Perdas|Qtde Outras|Qtde Transf|Qtde Devoluções|Qtde Trocas|Qtde Doaçoes|Qtde Bonif|Qtde Consig|Qtde Consumos|Qtde Transf|Qtde Faltas|Qtde Simp Rem|Qtde Reman|Valor|Lucros|Vendas|Lucros|Perdas|Outras|Transfer.|Devoluções|Trocas|Doações|Bonific|Consig|Consumos|Transf|Faltas|Simp. Rem.|Valor Reman|Margem|Custo Total|Vendas|Vendas|Ct Médio|Vl. ICMS|Ct Venda|Vendas|Núm. Clientes|Estoques|Qtde Venda|Estoque|Valor Venda|Código do Fornecedor|Nome Fornecedor|Data|Estoque|

  Linha 2: ||||||Código|Nome|Compras|Entradas|Entradas|Venda|Entradas|Entradas|Entradas|Produção|Estoque|Entradas|Entradas||Líquidas|Ct Empresa|Vl NFe|Entradas|Entradas|Venda|Entradas|Entradas|Entradas||Estoque|Entradas|Entradas|Vendas|Oferta|Estoque|Saídas|Saídas|Compra|Saídas||Saídas|Saídas|Internos|Mat. Prima|Estoque|Saías|Saídas|||Oferta|Oferta||Saídas|Saídas|Compra|Saídas||Saídas|Saídas|Internos|Mat. Prima|Estoque|Saídas|Saídas|Contrib.|Vendas|Ct Empresa|Ct Compra|Vendas|Informado|Vendas|Líquidas|Atendidos|Preço Venda|Média Diária|Disponível|Média Diária||||Diário|
  ```

  83 colunas. O parser deve **validar o cabeçalho de cada arquivo recebido
  contra esta referência antes de processar** e **recusar/alertar** (nunca
  processar silenciosamente) se não bater — foi exatamente assim que
  detectamos, na mão, que um bloco de Julho (dias 11 a 20) veio de uma
  extração diferente, com 111 colunas em outra ordem. Sem essa validação,
  esse tipo de arquivo passaria despercebido e corromperia o mês inteiro.

## 2. Configurações Gerais

Tela nova (`/parametros` ou equivalente), com duas grandes divisões:
**Configurações Gerais** (transversal, configurado raramente) e **Por Relatório**
(um conjunto de configurações por módulo — seção 3).

### 2.1 Dicionário de Colunas Nativas
- Lista todas as colunas do arquivo mensal: nome no arquivo (cabeçalho
  combinado), a que movimento se aplica, tradução/significado, tipo de dado.
- Populado automaticamente a partir do header real do arquivo (ver seção 1).
  Configurado uma vez; só muda se o layout do ERP mudar.
- Puramente informativo/documental — não é aqui que se decide o que aparece
  num relatório (isso é na seção 3.1).

### 2.2 Lojas — substitui `bdLojas` como arquivo
- Cadastro: **Código | Nome Customizado | Formato**.
- **Código Unidade é a chave de join** com os relatórios — nunca o nome.
- Nome Customizado é só exibição/filtro (ex.: `Ap.Independência` no sistema →
  `Independência` na plataforma).
- Formato (ex.: Varejo/Atacado) alimenta a lógica de comprador-por-formato em
  Departamentos (seção 2.3) — **por isso Lojas precisa ser configurado antes
  de Departamentos**.
- `bdLojas` deixa de existir como arquivo-fonte; este cadastro (mantido na
  própria plataforma) assume esse papel.

### 2.3 Departamentos
- Cadastro: **Código | Nome Departamento | Comprador**.
- **Código é a chave lida do arquivo mensal** (o mesmo `Dpto` que já vem na
  linha, mesmo código do `bdCadastro`) — nunca o nome.
- **Comprador aqui é só um rótulo de filtro** usado dentro dos relatórios
  (ex.: filtrar/agrupar por comprador no Raio X Fornecedor) — **não define
  quem acessa o quê**. Acesso é outra coisa (seção 2.4).
- Checkbox **"Mesmo comprador (todos os formatos)"**:
  - Marcado → um único campo de Comprador para o departamento inteiro.
  - Desmarcado → abre um campo de Comprador **por Formato** (a lista de
    formatos vem dinamicamente do que estiver cadastrado em Lojas — se um
    formato novo for criado depois, o campo correspondente aparece vazio e
    sinalizado, nunca é omitido silenciosamente).
- Validação: todos os campos obrigatórios — aviso visual quando faltar
  comprador (no modo único ou em algum formato específico).
- Botão **"Reprocessar comprador"**: recalcula a resolução de comprador
  efetivo (Departamento + Formato da Loja) sem esperar o cron diário (ver
  seção 4).

### 2.4 Usuários e Acesso
- Acesso é **direto**, nunca via nome de comprador (nome de comprador é só
  rótulo, seção 2.3 — usá-lo como chave de acesso quebra silenciosamente com
  qualquer erro de digitação):
  **Usuário → Departamentos (seleção múltipla, por código) + Lojas.**
- Dois perfis: **Comprador** (escopado pelos departamentos/lojas marcados) e
  **Gestor** (vê tudo, independente de qualquer marcação).
- Validação: se perfil = Comprador, os campos Departamentos e Lojas são
  **obrigatórios** — aviso "sem isso este comprador não acessa nenhum dado"
  quando algum estiver vazio. Gestor não precisa preencher nada.
- Login individual por usuário via **Clerk** (plano gratuito).
- A tabela `compradores.ts` (hoje fixa em código, usada só para *exibir* o
  nome do comprador) deixa de ser a base de qualquer decisão de acesso — o
  cadastro editável em Departamentos/Usuários assume esse papel.

### 2.5 Tema
- Um botão simples no cabeçalho da tela (Claro/Escuro) — **sem tela de
  customização de paleta por enquanto**. Cores fixas na marca MAX: azul
  `#004C97`, vermelho `#E30000`, verde `#1E9E62` (semáforo). Tipografia:
  Manrope (títulos) + IBM Plex Sans (corpo) — nunca Inter/Roboto/Arial.
- Ponto de extensão futuro (não construir agora): se a base da tela de
  Parâmetros for reaproveitada em outro projeto/cliente fora do MAX, reabrir
  uma tela de customização de paleta/tema ali. O logo do MAX em si é marca
  fixa, sempre separado de qualquer coisa que vire tema.

## 3. Por Relatório

Cada módulo (Desempenho Comercial, Entradas e Saídas, Compra e Venda, Perdas
e Quebras, Raio X Fornecedor) tem sua **própria configuração independente** —
nada vaza de um relatório para o outro, mesmo quando duas colunas calculadas
de módulos diferentes têm o mesmo nome.

### 3.1 Colunas — três sub-abas: Nativas, Calculadas, Ativas

**Nativas**
- Checklist de quais colunas do arquivo mensal aquele relatório usa.
- Marcar/desmarcar é **ocultar/visualizar**, nunca "ativar/desativar" — a
  coluna nunca deixa de existir nem de ser computada, só deixa de aparecer no
  relatório. **Nunca exige confirmação.**
- Nenhuma coluna nativa pode ser excluída de verdade (ela sempre existe no
  arquivo-fonte) — só ocultada.
- **De fora desta lista, sempre**: SKU, Código Unidade e Data — são chaves de
  identificação de linha usadas automaticamente por baixo dos panos (join,
  agregação), nunca colunas de relatório selecionáveis. Data fica pendente de
  tratamento à parte (ver seção 6) — provavelmente vira filtro de período do
  relatório, não uma coluna.

**Calculadas**
- Fórmulas **específicas daquele relatório** (mesmo nome pode ter fórmula
  diferente em outro módulo).
- Motor de cálculo: **aritmética simples** — soma/subtração de termos, em
  nível de linha, antes de qualquer agregação. Um termo pode ser uma coluna
  nativa **ou** outra coluna calculada (permite encadear — ex.:
  `Entradas Totais = Compra + Outras Entradas`).
- **Nunca há campo de texto livre para escrever fórmula.** Sempre seleção
  estruturada por chips: cada termo tem um sinal (+/−) e uma coluna escolhida
  em dropdown restrito às colunas **já existentes naquele relatório**
  (nativas ou calculadas) — nunca dá para referenciar algo que não existe,
  mesmo princípio de chave usado em Departamento/Loja.
- **Editor de coluna calculada** (ainda a construir — não existe no protótipo,
  só o resultado dele): formulário com Nome da coluna (texto, único no
  módulo) e Tipo de fórmula:
  - **Soma/Subtração** — lista de termos (sinal + dropdown de coluna),
    com botão de adicionar/remover termo.
  - **Razão** — dois grupos de termos (Numerador / Denominador), cada um
    construído exatamente como acima, divididos entre si. Cobre os casos
    de percentual (`% Desvio`, `% Lucro`).
  - Trava: a própria coluna sendo criada/editada nunca aparece no seu
    próprio dropdown (evita ciclo).
  - Validação mínima: nome preenchido + ao menos 1 termo (ou 1 por grupo,
    no modo Razão).
- Marcar/desmarcar (ocultar/visualizar) também nunca exige confirmação — a
  fórmula continua existindo e computando.
- **Excluir é uma ação separada do checkbox**, só para colunas calculadas
  (nativas nunca se excluem, só se ocultam). Ao excluir:
  - Se nenhuma outra coluna calculada depender dela → exclui direto.
  - Se alguma depender (via termo na fórmula) → **pede confirmação
    explícita**, listando por nome quem depende, antes de prosseguir.
  - Se confirmada mesmo assim, a(s) coluna(s) dependente(s) **não
    desaparecem nem quebram silenciosamente** — continuam existindo, mas
    ganham um aviso permanente ("depende de coluna excluída: X") até
    alguém corrigir a fórmula manualmente.
- Toda coluna (nativa ou calculada) que alimenta outra calculada mostra uma
  etiqueta discreta e sempre visível ("usada em: ...") — informa o impacto
  de qualquer decisão futura (inclusive edição de fórmula) sem precisar de
  um fluxo de aviso à parte.
- **Bloqueio de publicação**: um módulo não pode passar de Rascunho para
  Publicado enquanto tiver qualquer coluna calculada com o aviso "depende de
  coluna excluída" pendente. O controle de publicar fica desabilitado com uma
  nota explicando o motivo.

**Ativas**
- É aqui, e só aqui, que se decide a **ordem final de exibição** do
  relatório — junta automaticamente tudo que foi marcado como visível em
  Nativas e em Calculadas (não precisa marcar de novo).
- Reordenação é por **arrastar (drag-and-drop)**, não por botões de mover.
- Um botão "ocultar" por linha permite tirar a coluna da visão rapidamente,
  com efeito idêntico a desmarcar na aba de origem.
- **Esta mesma ordem vale também para a exportação Excel/PDF** (padrão já
  documentado em `docs/padroes-ux.md`) — não é só ordem visual da tela.

### 3.2 Linha (drill-down) — decisão de código, não de Parâmetros
- A **forma** da linha (o eixo do drill-down — Estrutura Mercadológica +
  Loja) é decidida em código, **não é configurável pela plataforma**. Muda
  raríssimo, e expor isso como configuração só adiciona risco de má
  configuração quebrar o relatório inteiro, sem ganho real.
- Todo módulo novo nasce com esse mesmo eixo (Estrutura Mercadológica +
  Loja) por padrão, reaproveitando o componente de drill-down já usado no
  Desempenho Comercial (um dos 10 padrões documentados em
  `docs/padroes-ux.md`) — salvo indicação explícita em contrário no futuro.
- **Quais** departamentos/lojas aparecem como linha para um usuário
  específico já está resolvido: é exatamente a permissão configurada em
  Usuários e Acesso (seção 2.4) — não precisa de tela nova para isso.

### 3.3 Acesso ao relatório
- Duas permissões que **precisam valer juntas** (E lógico), nunca uma ou
  outra isoladamente:
  1. Perfil (Comprador/Gestor) marcado em "Quem acessa este relatório" —
     checkbox simples, no nível do módulo inteiro.
  2. Departamento(s) + Loja(s) daquele usuário específico, marcados em
     Usuários e Acesso (seção 2.4).
- Um comprador marcado no perfil mas sem departamento/loja preenchido não vê
  nada — por isso esses campos são obrigatórios para perfil Comprador
  (seção 2.4).

### 3.4 Status Rascunho/Publicado
- Cada módulo tem seu próprio status, independente dos demais.
- Rascunho: alterações não afetam o que já está publicado.
- Publicado: bloqueado enquanto houver coluna quebrada (seção 3.1).
- Botão **"Reprocessar agora"** por relatório: recalcula os valores sem
  esperar o cron diário — usar depois de alterar fórmula/coluna calculada.

## 4. Processamento e recálculo

- Mudança de fórmula/regra de cálculo → **recalcula** os relatórios já
  gerados (nunca fica congelado na regra antiga).
- Processamento pesado (agregação, cálculo de colunas) continua no cron
  diário → cache Redis **em produção**, como já documentado em
  `docs/deploy.md`. Mudanças em Parâmetros só valem de fato após o próximo
  cron **ou** um reprocessamento manual: botão "Reprocessar agora" (por
  relatório, recalcula colunas) e botão "Reprocessar comprador" (recalcula a
  resolução de comprador por Departamento + Formato, seção 2.3). Rodando
  local (sem Redis), não há cron nenhum — a agregação roda ao vivo a cada
  requisição, então uma mudança em Parâmetros já vale na próxima consulta.
- **Permissão de acesso não depende do cron** — departamento/loja por
  usuário é avaliado em tempo real, direto contra o cadastro (é um filtro
  simples tipo IN-list, não uma agregação pesada). Mudar o acesso de um
  usuário vale imediatamente.

## 5. Migração do Desempenho Comercial

- Módulo já pronto e aprovado — migra para consumir a camada de Parâmetros
  em vez de regras hardcoded (seções 2-4, ainda não construídas).
- Suas colunas calculadas atuais (`Valor de Venda Regular`, `% Desvio
  (Valor)`, `% Lucro (Regular)` etc.) entram como pré-implantação inicial,
  já em status Publicado, quando essa camada existir.

✅ **Ponto em aberto resolvido** — `% Desvio (Valor)`, `% Lucro (Regular)` etc. nunca
dependeram de uma coluna "Valor Comparação" pronta vinda de arquivo: sempre foram
calculadas em JS, juntando dois conjuntos de registros (Atual e Comparação) agregados
independentemente e comparados depois (`lib/desempenho/aggregate.ts`,
`agregarPorLoja`/`agregarPorEstrutura`). "Atual" e "Comparação" sempre foram só **dois
filtros de data** (`periodoAtual`/`periodoComparacao`, calendário editável já
existente) — nunca duas fontes de dado diferentes de verdade, mesmo quando ainda
liam de dois arquivos fisicamente separados. Migrar pra um pool único de registros
(todos os meses juntos, ver seção 1) não muda esse cálculo em nada — só muda de onde
os registros vêm. "Comparação" continua sendo, como já era antes desta migração, a
escolha livre de outro período (mês anterior, mesmo mês do ano anterior, ou qualquer
range) — não uma coluna nem um arquivo especial. Isso NÃO se conecta com o pendente de
"Data como filtro de período" (seção 6) — aquele é sobre a coluna Data virar
selecionável/oculta no motor de Nativas/Calculadas da tela de Parâmetros; o filtro de
período do módulo (períodoAtual/periodoComparacao) é um mecanismo à parte, já
funcionando, que continua existindo do mesmo jeito depois que a tela de Parâmetros for
construída.

## 6. Fora de escopo agora (registrado, não construir ainda)

- Data como coluna/filtro de período do relatório.
- Biblioteca de Fórmulas Sugeridas (sugestão automática de fórmula ao criar
  uma coluna calculada) — só faz sentido depois que o editor de fórmula
  (seção 3.1) existir de verdade. Fica para uma v2.
- Regra de negócio para itens sem Fornecedor Padrão + plano de subida em
  massa desse dado (seção 1).
- Customização de paleta de cor / tema multi-tenant, caso a base seja
  reaproveitada fora do MAX no futuro (seção 2.5).

## 7. Ordem sugerida de construção

1. Parser do novo arquivo mensal (posição fixa, 2 linhas de cabeçalho,
   Latin-1) + import automático do cabeçalho para o Dicionário de Colunas.
2. Cadastro de Lojas e Departamentos (Configurações Gerais) — pré-requisito
   de todo o resto.
3. Usuários e Acesso + integração Clerk.
4. Motor de colunas por relatório (Nativas/Calculadas/Ativas) + editor de
   fórmula estruturado (chips, sem texto livre).
5. Migração do Desempenho Comercial para a nova camada.
6. Entradas e Saídas como segundo módulo — primeiro a nascer 100% dentro da
   nova arquitetura, sem legado.
7. Reprocessamento manual (botões) + atualização do cron.
8. Perdas e Quebras, Raio X Fornecedor e Compra e Venda, reaproveitando tudo
   que já foi construído nos passos 1–7.
