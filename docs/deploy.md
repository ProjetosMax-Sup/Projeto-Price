# Deploy

Hospedado na **Vercel**, repo no GitHub — push na branch `master` publica
direto em produção (sem branch de staging). Em produção o app lê os arquivos
direto do **OneDrive via Microsoft Graph API** (não da pasta local — um
servidor na nuvem não enxerga o disco do usuário); em dev local continua
lendo da pasta local (`DESEMPENHO_COMERCIAL_DATA_DIR`).

Requisições normais (navegar, filtrar, clicar) **nunca tocam o OneDrive
direto** — lento demais numa função serverless. Um **cron da Vercel roda
1x/dia às 09:00** (America/Sao_Paulo), busca os arquivos mensais (`bd<Mês>.txt`,
um por mês disponível) + `bdCadastro`/`bdLojas`, processa e grava num **cache
Redis**; o botão "Atualizar agora" no header roda a mesma rotina sob demanda.
Toda leitura normal só lê esse cache. Ordem de fallback (sem Redis
configurado, ou fora do ar): OneDrive direto → pasta local → dataset de
exemplo (arquitetura `DataProvider`, ver docs/fonte-de-dados.md).

⚠️ **Limite de 60s (plano Hobby) + capacidade do Redis**: tanto o cron quanto
o botão "Atualizar agora" rodam como função serverless, travada em 60s no
plano Hobby (não dá pra configurar mais alto). Ler+processar todos os meses
disponíveis direto do OneDrive não cabe nesse tempo, e o dataset completo
(4+ milhões de registros) também não cabe na memória do plano atual do
Redis (dá OOM). Mitigação atual: `MESES_HABILITADOS` (env var, ver
`.env.local.example`) restringe quais meses processar — hoje só
`Julho,Agosto,Setembro`. Resolver de vez: upgrade do plano Redis, ou migrar
esse cache pra um banco de verdade, e possivelmente Vercel Pro (timeout maior)
se o volume completo nunca couber em 60s mesmo com mais memória.

Checklist completo dos passos manuais (registro do app na Microsoft, projeto
na Vercel, Redis, variáveis de ambiente, conexão inicial com o OneDrive) está
no README.md.
