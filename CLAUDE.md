# MAX Supermercados — Plataforma de Dashboards e Análises

## Visão geral

Plataforma web interna para o time de Inteligência de Mercado / Comercial da MAX
Supermercados (rede de 11 lojas: 4 varejo, 7 atacado — confirmado em `bdLojas.txt`).
Composta por 5 módulos:

1. **Desempenho Comercial** ← primeiro módulo, escopo deste documento
2. Entradas e Saídas
3. Compra e Venda
4. Perdas e Quebras
5. Raio X Fornecedor

Regra permanente: **nunca excluir ou reorganizar pastas/arquivos sem aviso prévio e
instrução explícita do usuário.**

## Stack técnica

- **Next.js + TypeScript** (App Router), rodando localmente e hospedado na
  **Vercel** (free tier — decidido; ver seção "Deploy" abaixo)
- **Tailwind CSS** com tokens de cor nomeados semanticamente (ver Design System)
- **Recharts** para gráficos que forem além do que HTML/CSS resolve
- Parser próprio para os arquivos-fonte (não é Excel/CSV — ver Fonte de Dados)
- Proteção simples por senha (`SITE_PASSWORD`, cookie via `proxy.ts`) — sem
  autenticação complexa, já que é uso interno do time

## Deploy

Hospedado na **Vercel**. Em produção o app lê os arquivos direto do **OneDrive
via Microsoft Graph API** (não da pasta local sincronizada — um servidor na
nuvem não enxerga o disco do computador do usuário). Em desenvolvimento local
continua lendo da pasta local (`DESEMPENHO_COMERCIAL_DATA_DIR`), sem mudança.

`lib/data-providers/index.ts` escolhe automaticamente, nessa ordem: OneDrive
(Graph API, se `MICROSOFT_CLIENT_ID`/`MICROSOFT_CLIENT_SECRET` configurados) →
pasta local (`DESEMPENHO_COMERCIAL_DATA_DIR`) → dataset de exemplo (mock).

Peças da integração com o OneDrive (conta pessoal — tenant `consumers`):
- `config/onedrive.ts` — credenciais/config do app Microsoft
- `lib/onedrive/auth.ts` — troca/renovação de token (refresh token)
- `lib/onedrive/graph.ts` — leitura de arquivo + versão (eTag) via Graph API
- `lib/onedrive/token-store.ts` — refresh token persistido num Redis (integração
  "Upstash"/KV do marketplace da Vercel), porque instâncias serverless não têm
  disco persistente
- `app/api/auth/onedrive/login` e `.../callback` — fluxo de autorização,
  **feito manualmente uma única vez** por quem tem a conta Microsoft (ver
  checklist no README.md); depois disso o refresh token renova sozinho

`lib/data-providers/parse-tabela.ts` e `normalizar-desempenho.ts` contêm a
lógica de parsing pura (compartilhada entre `file-provider.ts` e
`onedrive-provider.ts`) — qualquer ajuste no formato dos arquivos deve mudar
só ali, nunca duplicar entre os dois providers.

Checklist completo dos passos manuais (registro do app na Microsoft, criação
do projeto na Vercel, Redis, variáveis de ambiente) está no README.md.

## Fonte de dados (fase atual: arquivos)

Os dados vêm de arquivos **TXT delimitados por pipe (`|`)**, sincronizados via pasta
do OneDrive (caminho difere entre computador pessoal e notebook corporativo — **não
hardcodear o caminho**, usar variável de ambiente `DESEMPENHO_COMERCIAL_DATA_DIR`,
configurada em `.env.local`).

Arquitetura pensada para trocar depois para API do ERP sem reescrever os módulos:
toda leitura de dado passa por uma interface `DataProvider`, com duas implementações
possíveis por trás dela — `FileDataProvider` (atual) e `ApiDataProvider` (futuro).

⚠️ **Volume real**: os arquivos de movimento têm centenas de milhares de linhas
(`bdDesempenhoComercialAtual.txt` ~351 mil linhas / 41MB, `...Comparação.txt` ~45MB).
Nunca mandar os registros brutos para o cliente — toda filtragem/agregação roda no
servidor (`lib/desempenho/consulta.ts`, chamado pela página e por
`app/api/desempenho-comercial/route.ts`); o navegador só recebe o resultado já
agregado (KPIs + algumas dezenas/centenas de linhas). `lib/data-providers/file-provider.ts`
mantém cache em memória do processo (invalidado por `mtime` do arquivo) porque
reprocessar do zero a cada requisição é lento demais.

### Arquivos do módulo Desempenho Comercial

Ficam em `05 - Bases` (irmã da pasta deste projeto, `06 - Projetos`), com extensão
`.txt`:

| Arquivo | Conteúdo |
|---|---|
| `bdDesempenhoComercialAtual.txt` | Vendas/margem por produto — período atual, grão diário, **sem quebra por loja** (ver aviso abaixo) |
| `bdDesempenhoComercialComparação.txt` | Vendas/margem por produto **e loja** — período de comparação inteiro, sem grão diário |
| `bdCadastro.txt` | Cadastro de produtos: hierarquia mercadológica + comprador (~130 colunas no total, só usamos ~7) |
| `bdLojas.txt` | As 11 lojas: nome, formato (Varejo/Atacado) |

⚠️ **Assimetria confirmada entre Atual e Comparação**: `bdDesempenhoComercialAtual.txt`
NÃO tem colunas `Unidade Código`/`Unidade Nome` (tem `Data` no lugar — um grão diário
consolidado de todas as lojas juntas). `bdDesempenhoComercialComparação.txt` tem
`Unidade Código`/`Unidade Nome` mas não tem `Data` (já vem agregado por loja para o
período inteiro). Efeito prático: o painel "Lojas" (breakdown por loja) fica vazio
para o período atual — os KPIs totais (venda/lucro da empresa) continuam corretos,
mas não há como saber qual loja vendeu o quê no período atual com o arquivo como
está hoje. Ver decisão registrada em "Em aberto" mais abaixo.

### Formato dos arquivos

- Encoding: **`bdLojas.txt` é UTF-8**; os outros três (`bdCadastro`,
  `bdDesempenhoComercialAtual`, `...Comparação`) são **ISO-8859-1/Latin-1** —
  confirmado byte a byte nos arquivos reais. Não presumir o mesmo encoding para
  todos os arquivos.
- Números usam **vírgula como separador decimal** (padrão BR)
- `bdDesempenhoComercialAtual`, `bdDesempenhoComercialComparação` e `bdCadastro`:
  **cabeçalho em 2 linhas** — linha 1 = nome principal da coluna, linha 2 =
  complemento (quando presente, junta como `"{linha1} {linha2}"`, senão usa só a
  linha 1). `bdCadastro.txt` tem nomes de coluna repetidos na linha 1 (ex: duas
  colunas "Código", duas "Classe") — a linha 2 sempre desambigua o nome combinado;
  ao resolver uma coluna pelo nome, usar a **primeira ocorrência** do nome já
  combinado (ver `lerTabela` em `file-provider.ts`).
- `bdLojas`: cabeçalho **normal de 1 linha**, sem complemento — não presumir que
  todo arquivo segue o padrão de 2 linhas, checar por arquivo.

### Colunas confirmadas — `bdDesempenhoComercialAtual.txt`

```
Código | Descricao (sem acento) | Complemento | Marca | Código Barras
Qtde Vendas | Valor | Lucros
Qtde Vendas Oferta | Vendas Oferta | Lucros Oferta
Vendas Ct Empresa (descartar — não utilizado)
Data (grão diário; NÃO tem Unidade Código/Nome — ver aviso acima)
```

### Colunas confirmadas — `bdDesempenhoComercialComparação.txt`

```
Código | Descricao (sem acento) | Complemento | Marca | Código Barras
Unidade Código (= código da loja) | Unidade Nome (= nome da loja)
Qtde Vendas | Valor | Lucros
Qtde Vendas Oferta | Vendas Oferta | Lucros Oferta
Vendas Ct Empresa (descartar — não utilizado)
(sem coluna Data — já agregado para o período inteiro)
```

**Regular = Total − Oferta.** Não é uma coluna do arquivo, é campo calculado na
camada de normalização (vale para Qtde, Valor e Lucro).

### Colunas confirmadas — `bdCadastro.txt`

```
Código (SKU)
Dpto (código do departamento, 3 dígitos, ex: "014")
Grupo (código numérico do nível mais baixo — Sub Grupo)
Nome Grupo (nome do Sub Grupo)
Hierarquia de Grupos → string única, níveis separados por vírgula:
    "Departamento, Seção, Categoria, Grupo, Sub Grupo"
    ⚠️ NEM SEMPRE tem os 5 níveis — parser precisa tratar isso sem quebrar
    ✅ Confirmado com o usuário: não existe fonte estruturada separada para
    Categoria/Grupo — basta dividir esta string pelo delimitador ","
Compr / Nome Comprador → comprador é atributo do PRODUTO, não da loja
```

#### Códigos de Departamento (Dpto) confirmados

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

### Colunas confirmadas — `bdLojas`

```
Cód Unid | Cód Unid Reduzido | Nome Sistema | Nome Loja | Formato (Varejo/Atacado)
```

### Chaves de join

```
bdDesempenhoComercialAtual/Comparação.Código  →  bdCadastro.Código        (SKU)
bdDesempenhoComercialAtual/Comparação.Unidade Código → bdLojas.Cód Unid   (loja)
```

## Regra de negócio: qualidade de cadastro

Produtos com hierarquia mercadológica incompleta (ex: caem em "Verificar Dpto") que
tenham **movimentação** (venda > 0) **não deveriam aparecer** nos relatórios — é
rotina da equipe do usuário tratar/corrigir esses produtos regularmente.

Se algum produto nessa situação aparecer com movimentação:
- **avisar o usuário**
- exibir contagem num **badge discreto na interface** (não um banner chamativo)
- excluir esses produtos dos números consolidados até serem corrigidos

## Design system

Cores extraídas da logo oficial da MAX:

| Token | Hex | Uso |
|---|---|---|
| `azul` (primário) | `#004C97` | header, ações primárias, destaque |
| `vermelho` (marca/alerta) | `#E30000` | badge "SUPERMERCADOS", alertas, desvio negativo |
| Verde (não é cor de marca) | `#1E9E62` | desvio positivo — semáforo |

Tipografia: **Manrope** (display/headings) + **IBM Plex Sans** (corpo) via Google
Fonts. Evitar Inter/Roboto/Arial (padrão genérico de IA).

## Padrões de UX validados no mockup (módulo Desempenho Comercial)

O protótipo interativo foi validado em:
https://claude.ai/artifact/HqygHGp2du7aMt62x8xjam
(useR como referência visual e de interação — screenshots ou re-implementação, já
que o Claude Code não acessa esse link diretamente)

Elementos a replicar:

1. **KPI cards reativos ao filtro** — Venda, Lucro, %Lucro sempre refletem o recorte
   ativo (categoria × loja selecionadas), não um total fixo da empresa. Mostrar
   claramente que os números refletem o recorte quando ele não é "toda a empresa ×
   todas as lojas".
2. **Duas tabelas que se filtram mutuamente**: Estrutura Mercadológica (com
   drill-down Departamento → Seção) e Lojas, lado a lado.
   - Clicar num departamento/seção filtra a tabela de Lojas para mostrar a
     performance daquela categoria em cada loja.
   - Clicar numa loja filtra a tabela de Estrutura para mostrar só a performance
     daquela loja (clique de novo para desmarcar).
   - Barra de status mostrando o recorte ativo + botão "Limpar seleção".
3. **Toggle Tabela ↔ Ranking** no painel de Estrutura — Tabela é a visão detalhada
   com todas as colunas; Ranking é barras horizontais ordenadas por valor, mais
   rápidas de escanear.
4. **Painel Top Altas/Quedas** com **toggle de nível independente** (Seção /
   Categoria / Grupo) — ranqueia por %Desvio de Venda no nível escolhido, escopado
   pela loja selecionada (se houver).
5. **Semaforização automática**: todo %Desvio (venda e lucro) fica verde
   (positivo) ou vermelho (negativo) — cor + fundo leve, nunca só a cor do texto.
6. **Ordenação em modo Tabela por código** (`003 - Bazar`, `002 - Vila Mutirão`),
   não por valor. Modo Ranking continua ordenado por valor (maior → menor).
7. **Exportar Excel / PDF** — botões no header (funcionalidade real a implementar).
8. Filtros no topo: Loja (multi-seleção), Formato (Varejo/Atacado), Comprador,
   Período Atual e Período de Comparação.
9. Navegação entre os 5 módulos como abas no header (mesmo estando só o primeiro
   implementado).

## Estrutura de pastas sugerida

```
/app
  /desempenho-comercial
  /api/desempenho-comercial  (route.ts — filtra/agrega no servidor, chamado pelo cliente)
  /api/auth/onedrive         (login/callback — autorização única com a Microsoft)
  /api/login                 (proteção por senha)
  /login                     (tela de senha)
  /entradas-saidas        (placeholder)
  /compra-venda           (placeholder)
  /perdas-quebras         (placeholder)
  /raio-x-fornecedor      (placeholder)
/lib
  /data-providers
    parse-tabela.ts             (parser TXT puro — só string in, objetos out)
    normalizar-desempenho.ts    (normalização + joins, também puro)
    file-provider.ts            (lê do disco local + cache por mtime — dev)
    onedrive-provider.ts        (lê do OneDrive via Graph API + cache por eTag — produção)
    mock-provider.ts            (dataset de exemplo, fallback sem nenhuma fonte configurada)
    api-provider.ts             (placeholder para o futuro ERP)
  /onedrive
    auth.ts               (troca/renovação de token)
    graph.ts               (leitura de arquivo/versão via Microsoft Graph)
    token-store.ts          (refresh token no Redis/Upstash)
  /desempenho
    aggregate.ts           (agregação por loja/estrutura)
    consulta.ts             (filtros + orquestração — roda no servidor)
    export.ts               (Excel/PDF)
  /types
/components
  /charts
  /ui                     (design system compartilhado)
/config
  data-sources.ts         (caminhos via env var, nomes de arquivo esperados)
  onedrive.ts             (credenciais/config do app Microsoft)
/proxy.ts                 (proteção por senha — SITE_PASSWORD)
```

## Em aberto / a validar com o usuário

- **Bloqueador de dados**: `bdDesempenhoComercialAtual.txt` não tem loja
  (`Unidade Código`/`Unidade Nome`) — só `bdDesempenhoComercialComparação.txt` tem.
  Painel "Lojas" fica sem dado no período atual até isso ser resolvido (reexportar
  o Atual com a quebra por loja, ou definir outro tratamento). Ver detalhes em
  "Fonte de dados" acima.
- Metas/objetivos ficaram fora de escopo por enquanto (mencionado explicitamente
  pelo usuário ao revisar referências de outra rede)

## Exportação (Desempenho Comercial)

Exportar Excel/PDF gera o arquivo a partir do recorte ativo (mesmos números
exibidos nos KPIs, na Estrutura Mercadológica e nas Lojas no momento do clique).

- Excel: `exceljs` (client-side) — planilhas "Resumo", "Estrutura Mercadológica"
  e "Lojas". Não usar o pacote `xlsx`/SheetJS — a versão publicada no npm tem
  vulnerabilidade conhecida sem correção.
- PDF: `jspdf` + `jspdf-autotable` (client-side) — cabeçalho com recorte ativo e
  KPIs, seguido das mesmas duas tabelas, paisagem.
- Implementação em `lib/desempenho/export.ts`, chamada pelos botões do header em
  `components/desempenho/DesempenhoDashboard.tsx`.
