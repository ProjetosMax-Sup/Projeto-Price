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
/lib/data-providers        DataProvider (FileDataProvider/OneDriveDataProvider, ApiDataProvider futuro)
/lib/onedrive               integração com a Microsoft Graph API
/lib/types                 tipos compartilhados
/components/ui             design system compartilhado
/components/charts         gráficos (Recharts)
/config                    caminhos de dados via env var
```

## Deploy (Vercel)

Checklist pra publicar pro time Comercial. Passos com 🔧 são manuais, feitos
uma vez só; o resto é automático depois disso. Ver arquitetura completa em
[CLAUDE.md > Deploy](./CLAUDE.md#deploy).

### 1. 🔧 GitHub

Criar um repositório (privado) em github.com e apontar este projeto pra ele:

```bash
git remote add origin https://github.com/<seu-usuario>/<nome-do-repo>.git
git push -u origin master
```

### 2. 🔧 Registrar o app na Microsoft (acesso ao OneDrive)

Em [portal.azure.com](https://portal.azure.com) → **App registrations** → **New registration**:

- Nome: `MAX Dashboards`
- Supported account types: **Personal Microsoft accounts only**
- Redirect URI: tipo **Web**, valor `https://<seu-projeto>.vercel.app/api/auth/onedrive/callback`
  (só dá pra confirmar o domínio depois do passo 3 — pode voltar aqui e editar)

Depois de criado:
- Anotar o **Application (client) ID** → vira `MICROSOFT_CLIENT_ID`
- **Certificates & secrets** → **New client secret** → copiar o **valor** (só
  aparece uma vez) → vira `MICROSOFT_CLIENT_SECRET`
- **API permissions** → **Add a permission** → **Microsoft Graph** →
  **Delegated permissions** → marcar `Files.Read` e `offline_access` → **Add permissions**

### 3. 🔧 Criar o projeto na Vercel

Em [vercel.com](https://vercel.com) → **Add New** → **Project** → importar o
repositório do GitHub (passo 1). Next.js é detectado automaticamente, não
precisa mexer em build settings.

### 4. 🔧 Adicionar um Redis (token do OneDrive, cadastro de Parâmetros e cache do dataset)

No projeto da Vercel → **Storage** → **Marketplace Database Providers** →
escolher a integração **Redis** (Upstash) → **Create** → conectar ao projeto.
Isso injeta `REDIS_URL` sozinho, não precisa copiar nada.

### 5. 🔧 Variáveis de ambiente

No projeto da Vercel → **Settings** → **Environment Variables**, adicionar:

| Variável | Valor |
|---|---|
| `SITE_PASSWORD` | senha única de acesso ao site (login não é individual, ver abaixo) |
| `MICROSOFT_CLIENT_ID` | do passo 2 |
| `MICROSOFT_CLIENT_SECRET` | do passo 2 |
| `MESES_HABILITADOS` | `Julho,Agosto,Setembro` (ou o que couber — ver ⚠️ abaixo) |

Depois **Deploy** (ou fazer um novo commit/push — o deploy é automático a cada
push na branch principal a partir daqui).

Login é **senha única do site** (`SITE_PASSWORD`), sem conta individual — todo
mundo que sabe a senha tem acesso completo. Login por pessoa (usuário/senha
via Clerk, com perfil Comprador/Gestor e escopo por Departamento/Loja) foi
construído mas está **pausado**: Clerk exige domínio próprio pra rodar em modo
Production, e o projeto hoje só tem o domínio compartilhado `*.vercel.app` —
retomar isso é decisão futura, não faz parte deste checklist. Detalhe em
[CLAUDE.md > Stack técnica](./CLAUDE.md#stack-técnica).

⚠️ **`MESES_HABILITADOS`**: o plano atual do Redis não aguenta o dataset
completo (4+ milhões de registros) de uma vez — dá OOM. Enquanto isso não for
resolvido (upgrade de plano Redis, ou mover esse cache pra outro banco), essa
variável limita quais meses o cron/botão "Atualizar agora" processam. Ver
[CLAUDE.md > Deploy](./CLAUDE.md#deploy).

### 6. 🔧 Conectar a conta do OneDrive (só uma vez)

Com o site publicado: logar com a senha do site e acessar
`https://<seu-projeto>.vercel.app/api/auth/onedrive/login`, fazer login com a
conta Microsoft **dona da pasta `05 - Bases`** e autorizar o acesso. A página
final confirma "OneDrive conectado com sucesso". **Não precisa repetir isso**
— o token renova sozinho daqui pra frente.

### Pronto

O site já está lendo os arquivos direto do OneDrive (só os meses dentro de
`MESES_HABILITADOS`, por ora). Pra atualizar os dados, o time só precisa
sobrescrever os arquivos na pasta `05 - Bases` (mesmo nome) — o site detecta a
mudança sozinho, sem precisar reimplantar nada.
