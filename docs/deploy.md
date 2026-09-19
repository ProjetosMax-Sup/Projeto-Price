# Deploy

Hospedado na **Vercel**, repo no GitHub — push na branch `master` publica
direto em produção (sem branch de staging). Em produção o app lê os arquivos
direto do **OneDrive via Microsoft Graph API** (não da pasta local — um
servidor na nuvem não enxerga o disco do usuário); em dev local continua
lendo da pasta local (`DESEMPENHO_COMERCIAL_DATA_DIR`).

Requisições normais (navegar, filtrar, clicar) **nunca tocam o OneDrive
direto** — lento demais numa função serverless. Um **cron da Vercel roda
1x/dia às 09:00** (America/Sao_Paulo), busca os 4 arquivos, processa e grava
num **cache Redis**; o botão "Atualizar dados" no header roda a mesma rotina
sob demanda. Toda leitura normal só lê esse cache. Ordem de fallback (sem
Redis configurado, ou fora do ar): OneDrive direto → pasta local → dataset de
exemplo (arquitetura `DataProvider`, ver docs/fonte-de-dados.md).

Checklist completo dos passos manuais (registro do app na Microsoft, projeto
na Vercel, Redis, variáveis de ambiente, conexão inicial com o OneDrive) está
no README.md.
