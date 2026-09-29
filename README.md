# MAX Supermercados — Plataforma de Dashboards e Análises

Plataforma web interna do time de Inteligência de Mercado / Comercial. Ver
[CLAUDE.md](./CLAUDE.md) para escopo completo, stack e regras de negócio.

## Desenvolvimento (local, sem nenhuma conta de nuvem)

```bash
npm install
cp .env.local.example .env.local   # ajustar DESEMPENHO_COMERCIAL_DATA_DIR, deixar o resto comentado
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000). Sem tela de login, sem
depender de Vercel/Redis/OneDrive — fluxo de trabalho combinado: desenvolver
e validar tudo aqui, só publicar em produção (Vercel) as versões prontas. Ver
[docs/deploy.md](./docs/deploy.md) para os dois modos (local e produção) e o
checklist completo de deploy.

## Estrutura

```
/app                      páginas (App Router), uma pasta por módulo
/lib/data-providers        DataProvider (FileDataProvider local / OneDriveDataProvider produção, ApiDataProvider futuro)
/lib/onedrive               integração com a Microsoft Graph API (só usada em produção)
/lib/parametros/store.ts    cadastro de Parâmetros — JSON local (dev) ou Redis (produção)
/lib/types                 tipos compartilhados
/components/ui             design system compartilhado
/components/charts         gráficos (Recharts)
/config                    caminhos de dados via env var
/data/parametros           cadastro local (gerado em runtime, não versionado — só existe em dev)
```

## Deploy (Vercel)

Checklist completo pra publicar pro time Comercial:
[docs/deploy.md](./docs/deploy.md#deploy-em-produção-vercel).
