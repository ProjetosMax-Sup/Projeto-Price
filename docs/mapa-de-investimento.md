# Mapa de Investimento — infraestrutura definitiva

Status: **aprovado pela diretoria** (investimento financeiro confirmado).
Escrito antes de Entradas e Saídas e Compra e Venda existirem — ver nota
abaixo antes de iniciar qualquer fase de execução.

⚠️ **O que precisa ser reconferido antes da Fase 1**: o documento original
mede "14/83 colunas extraídas" e desenha a migração do "motor de cálculo"
em cima só do Desempenho Comercial (`lib/desempenho/consulta.ts`). Isso
mudou: Entradas e Saídas e Compra e Venda nasceram depois, com um parser
**separado e já mais largo** — `REFS_NATIVOS_ENTRADAS_SAIDAS`
(`config/data-sources.ts`) já lê **todas as colunas numéricas das 83**, não
14. O Desempenho Comercial continua com o parser estreito original
(`CAMPOS_MOVIMENTO` em `normalizar-desempenho.ts`, 14 campos). Ou seja: a
migração pro banco de dados (seção 2) precisa cobrir **dois motores de
agregação** (`lib/desempenho/consulta.ts` e
`lib/entradas-saidas/aggregate.ts` + `lib/compra-venda/aggregate.ts`), não
um só — reavaliar escopo/esforço da Fase 2 antes de começar.

**Precisão adicional (2026-10-03):** nem tudo nesses "dois motores" precisa
de trabalho. O motor de colunas/fórmulas configuráveis
(`lib/parametros/avaliador.ts`, `ConfigRelatorio`, o Dicionário) já é único e
module-agnostic hoje — os três módulos já o usam sem nenhum retrabalho (ver
`docs/exemplos-motor-colunas/README.md`). O que a Fase 2/3 realmente precisa
resolver é só a camada de **parser + soma por linha** (hoje duplicada em JS
por motivo de performance: fundir isso em JS já foi tentado em 2026-09-30 e
revertido por regressão de 60s→2min47 no dataset de 5M+ registros). Mover
essa camada pro Postgres deve unificá-la naturalmente — a soma por linha vira
`GROUP BY` em SQL, sem o custo de JS que motivou a reversão.

## 1. Onde estava a medição original

Arquivo de referência: `bdAgosto.txt` (o mais pesado até então) — 352MB,
679.085 linhas, 83 colunas no arquivo. Teto rígido da Vercel Hobby: 60s por
função. O motor de agregação do Desempenho Comercial faz de 8 a 12
varreduras completas sobre o array de registros a cada requisição — funciona
porque o array ainda cabe em memória, mas não escala pra todos os meses
futuros nem pra mais usuários simultâneos.

## 2. Arquitetura recomendada

Mesma fonte (OneDrive por ora), mesmo Next.js/Vercel — troca o meio de
campo: de "carregar tudo e filtrar no código" para "o banco já filtra e
soma, o site só pede o resultado pronto".

```
OneDrive (.txt) → GitHub Actions (diário) → grava nas 83 colunas → Postgres → consulta já pronta → Next.js/Vercel (KPIs)
```

Redis não desaparece — continua guardando o token do OneDrive e o cadastro
de Parâmetros (uso pequeno, pra isso é ótimo). Só a base grande de movimento
sai do Redis e vai pro Postgres (Supabase). A atualização diária sai da
Vercel (sem teto de tempo) e vira tarefa agendada no GitHub Actions (grátis).

**Arquivo por dia + fechamento de mês** (confirmado com o RP Info): o ERP
consegue gerar um arquivo por dia; correção lançada depois entra datada no
dia do lançamento, nunca reescreve o dia original. Fluxo:
1. Durante o mês, cada dia gera um arquivo pequeno, processado automaticamente.
2. No início do mês seguinte, o time gera manualmente o consolidado (ex.:
   `bdSetembro.txt`, mesmo processo de hoje) — processado automaticamente ao
   aparecer.
3. Depois de confirmar o consolidado, o time **apaga manualmente** os
   arquivos diários daquele mês — decisão deles, não automática.

## 3. Hospedagem e fonte de dados — decisões já tomadas

- **Continuar na Vercel**: o único motivo real pra trocar era o teto de
  tempo, que deixa de ser problema assim que o processamento pesado sai da
  Vercel (seção 2). Trocar de hospedagem custaria reconfigurar tudo sem
  ganho.
- **Continuar lendo do OneDrive**, não migrar pra API direta do RP Info
  ainda: a API devolve dado cru (venda por venda, nota por nota), não o
  resumo diário já organizado que o arquivo atual entrega pronto — migrar
  agora significaria reconstruir do zero a lógica de agregação que o ERP já
  faz, com risco real de erro silencioso em número financeiro/estoque. Fica
  documentado como possível no futuro, projeto à parte.

## 4. Investimento mensal

⚠️ **Urgente, independente do resto**: OneDrive em 4,3GB de 5GB (plano
gratuito) — precisa de upgrade já, junto da primeira contratação.

| Item | Por quê | Custo |
|---|---|---|
| Microsoft 365 Business Basic | Resolve o OneDrive quase cheio (1TB) — licença de empresa, não pessoal | R$43,22/mês por usuário |
| Domínio próprio | Pré-requisito do Clerk em modo definitivo | R$40/ano (.com.br, Registro.br) |
| Vercel Pro | **Não opcional**: o plano gratuito da Vercel proíbe uso comercial — um site interno de decisão de negócio já conta como uso comercial hoje | US$20/mês (já inclui US$20 de uso) |
| Supabase Pro | Espaço de sobra pros próximos anos + não desliga por inatividade (o grátis desliga depois de 1 semana sem uso) | US$25/mês (parte coberta por crédito incluso) |
| Clerk (login individual) | Plano grátis cobre até 50 mil usuários/mês — 11 usuários não chegam perto | R$0 |
| GitHub Actions (atualização diária) | Bem abaixo do limite gratuito | R$0 |
| Claude Max | Ferramenta de desenvolvimento/manutenção, não custo de operar o site | US$100–200/mês |

Total estimado de infraestrutura (sem Claude Max): **~US$45/mês + R$40/ano + R$43/mês**.
Preços verificados direto nos sites oficiais na data do documento — confirmar no checkout antes de assinar.

## 5. Capacidade — histórico cabe no plano?

Usando Agosto (679.085 registros, mês mais pesado) como referência conservadora:

| Horizonte | Registros estimados | Banco estimado | Cabe no Supabase Pro (8GB)? |
|---|---|---|---|
| 1 ano | ~8,1 milhões | ~5,7GB | Cabe folgado |
| 2 anos | ~16,3 milhões | ~11,4GB | Passa um pouco — menos de US$0,50/mês a mais |

## 6. Riscos e mitigações

**Infraestrutura**
- OneDrive sem espaço → resolvido pela 1ª contratação (urgente, seção 4).
- Banco sem espaço com o crescimento → upgrade de plano é simples; seção 5 mostra que sobra espaço por anos.
- Conexões demais com o banco travando (foi o que aconteceu com o Redis) → usar desde o início a forma de conexão recomendada pra esse tipo de banco.
- Atualização diária falhar sem ninguém perceber → a ferramenta de agendamento já avisa por e-mail automaticamente.
- Atualização consumir mais tempo que o limite gratuito → ativar um teto pequeno de gasto (a partir de ~R$20) só se acontecer, em vez de deixar parar.
- Fornecedores mudarem preço/regra sem aviso (já aconteceu com o plano grátis da Vercel) → sem controle sobre isso; mitigação é revisar este documento 1x/ano e configurar avisos de gasto.
- Custo crescer sem perceber → configurar aviso automático de gasto nos painéis da Vercel e Supabase já na primeira etapa.

**Dados e atualização diária**
- Forma de lançar correção (sempre na data do lançamento) não se confirmar na prática → testar com uma correção real antes de confiar 100%; o fechamento mensal pega qualquer ajuste de qualquer forma.
- RP Info mudar a exportação ou acesso ao OneDrive expirar → acesso já se renova sozinho; aviso automático de falha cobre o resto.
- Produtos com cadastro incompleto no ERP aparecerem errado → já identificado e excluído dos números com aviso (regra já existente, ver CLAUDE.md > Regras de negócio); a correção em si é rotina do time de cadastro.

**Migração e corte**
- Motor de cálculo novo calcular algo errado → comparação lado a lado com os números atuais, no mesmo recorte, antes de qualquer coisa ir pro ar.
- Corte final dar problema → a versão atual continua no ar até confirmar que a nova está certa; reverter é só continuar usando a antiga.
- Projeto demorar mais que o previsto → sem data fechada possível; etapas são independentes, um atraso numa não trava as outras nem impede uso da plataforma atual.

**Organizacional**
- Esquecer de renovar o domínio → ativar renovação automática no ato da compra.
- Só uma pessoa entender o sistema por dentro → documentação contínua (CLAUDE.md e docs/) reduz o risco; ideal é mais de uma pessoa acompanhando.
- LGPD (dado sensível fora do Brasil) → o que se guarda é venda/estoque por produto/loja/dia, sem dado pessoal de cliente — risco baixo hoje.

## 7. Domínio

Verificado ao vivo no Registro.br — três opções livres, nenhuma escolhida ainda:

| Prioridade | Domínio | Situação |
|---|---|---|
| 1ª opção | `maxanalitycs.com.br` | Disponível — já é o nome do projeto na Vercel hoje |
| 2ª opção | `maxatacados.com.br` | Disponível |
| 3ª opção | `maxsatacados.com.br` | Disponível |

Já registrados por terceiros (sem efeito nas opções acima):
`maxsupermercados.com.br` (vale checar se é da própria empresa — nameserver
Locaweb), `maxbi.com.br`, `maxinteligencia.com.br`, `maxcomercial.com.br`.
Registro.br é a fonte oficial pra `.com.br` — R$40/ano, sem intermediário.

## 8. Usuários iniciais (login individual, Clerk)

| Nome | Perfil | Departamentos |
|---|---|---|
| Gabriel | Gestor (Admin) | Todos |
| Matheus | Gestor | Todos |
| Leonardo | Gestor | Todos |
| Bruna | Comprador | Mercearia Doce, Saudável, Lácteos, Sazonais |
| Manoel | Comprador | Mercearia Leite, Perfumaria, Limpeza |
| Ricardo | Comprador | Mercearia Salgada |
| Sandro | Comprador | Bebidas |
| Edvaldo | Comprador | Bazar, Eletro |
| Nil | Comprador | Padaria Indústria, Padaria Própria |
| Johathan | Comprador | Açougue, Peixaria, Perecíveis Frios e Congelados |
| Marrone | Comprador | Hortifruti |

Jairo e "Divino" continuam só como rótulo de comprador no cadastro de
Departamentos (não precisam de login próprio, confirmado). Username:
primeiro nome em minúsculo, sem acento (`bruna`, `manoel`...) — ajustável se
colidir.

## 9. Mudanças de código necessárias

| Onde | O que muda |
|---|---|
| Leitura dos arquivos | Expandir o parser do **Desempenho Comercial** pras 83 colunas — Entradas e Saídas/Compra e Venda já leem quase tudo (ver nota no topo) |
| Banco de dados (novo) | Tabela de movimento (produto × loja × dia, sem repetir) + tabelas de Lojas/Departamentos já existentes em Parâmetros |
| Conexão com o banco (novo) | Forma de conexão recomendada pra esse tipo de banco — mesma lição já aprendida com o Redis, aplicada desde o início |
| Tarefa agendada no GitHub (nova) | Substitui o agendamento da Vercel: baixa o(s) arquivo(s), grava no banco |
| Motor de cálculo | **A maior peça** — filtros/somas saem do código e passam pro banco. Precisa cobrir os dois motores existentes hoje (Desempenho Comercial e Entradas e Saídas/Compra e Venda), não só um — ver nota no topo |
| Login | Volta a resolver por conta individual (Clerk) |
| Contas de login | Recriar os 11 usuários (seção 8) na conta definitiva do Clerk |
| Configuração | Login aponta pro domínio novo; remove `MESES_HABILITADOS` |

## 10. Roteiro

Etapas independentes, cada uma com versão testável antes de avançar — a
plataforma atual continua no ar até o corte final.

1. **Contratações** — nada muda no site ainda: Microsoft 365, domínio,
   Vercel Pro, Supabase Pro, conta definitiva do Clerk.
2. **Banco de dados + atualização** — roda local, sem depender da Vercel:
   banco novo, leitura expandida pras 83 colunas, as duas tarefas agendadas
   no GitHub (diária + fechamento de mês), carga do histórico existente.
3. **Motor de cálculo novo** — roda local, comparado lado a lado com a
   versão atual antes de confiar no histórico inteiro.
4. **Login individual de volta** — roda local: recria os 11 usuários,
   testa Gestor/Comprador de ponta a ponta.
5. **Corte de produção** — site definitivo no ar, domínio novo, banco e
   login novos como fonte única. Só desliga a versão antiga depois disso
   confirmado.
