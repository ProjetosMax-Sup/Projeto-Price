# MAX Supermercados — Plataforma de Dashboards e Análises

Plataforma web interna do time de Inteligência de Mercado / Comercial. Ver
[CLAUDE.md](./CLAUDE.md) para escopo completo, stack e regras de negócio.

## Desenvolvimento

```bash
npm install
cp .env.local.example .env.local   # ajustar DESEMPENHO_COMERCIAL_DATA_DIR
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000).

## Estrutura

```
/app                      páginas (App Router), uma pasta por módulo
/lib/data-providers        DataProvider (FileDataProvider atual, ApiDataProvider futuro)
/lib/types                 tipos compartilhados
/components/ui             design system compartilhado
/components/charts         gráficos (Recharts)
/config                    caminhos de dados via env var
```
