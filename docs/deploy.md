# Execução: local vs produção

Dois modos, mesmo código-fonte — o que muda é só quais variáveis de ambiente
estão preenchidas (ver CLAUDE.md > "App local vs produção" pra tabela
resumida). Fluxo de trabalho combinado: **desenvolver e validar localmente
primeiro**, publicar em produção só as versões prontas.

## Rodando localmente (sem nenhuma conta de nuvem)

```bash
npm install
cp .env.local.example .env.local   # ajustar DESEMPENHO_COMERCIAL_DATA_DIR, deixar o resto comentado
npm run build
npm run start
```

Abrir [http://localhost:3000](http://localhost:3000). Sem tela de login, sem
Vercel, sem Redis, sem OneDrive — os arquivos-fonte vêm de uma pasta local
(`DESEMPENHO_COMERCIAL_DATA_DIR`, tipicamente a mesma pasta sincronizada pelo
cliente do OneDrive na máquina, mas o app não sabe nem se importa que é
OneDrive), e o cadastro de Parâmetros (Lojas/Departamentos/Dicionário) vira
arquivos JSON locais em `data/parametros/` (gitignored — não é backup, se
quiser levar o cadastro customizado pra outra máquina, copiar essa pasta à
mão).

`npm run dev`/`npm run start` já sobem o Node com heap maior
(`--max-old-space-size=8192`, ver `package.json`) — necessário pra processar
o dataset completo sem estourar o limite padrão do V8 (deu OOM sem isso,
testado em 2026-09-29 numa máquina com 16GB de RAM). Ajustar esse valor
conforme a RAM disponível.

### Desempenho local

Sem Redis, não há mais o limite de memória que forçava `MESES_HABILITADOS`
em produção — mas processar os 9+ meses (4+ milhões de registros) de uma vez
ainda é pesado: ~30s de CPU por consulta (a agregação em si, não a leitura do
arquivo — essa fica em cache em memória, invalidada por data de modificação
do arquivo). Se ficar lento demais pro dia a dia, `MESES_HABILITADOS`
continua disponível em `.env.local` (ex:
`MESES_HABILITADOS=Julho,Agosto,Setembro`) — mesma variável de produção, só
que aqui é opcional e só uma válvula de performance, não uma necessidade de
infraestrutura.

## Deploy em produção (Vercel)

Checklist pra publicar pro time Comercial **depois de validado localmente**.
Passos com 🔧 são manuais, feitos uma vez só; o resto é automático depois
disso.

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
| `SITE_PASSWORD` | senha única de acesso ao site (login não é individual, ver CLAUDE.md) |
| `MICROSOFT_CLIENT_ID` | do passo 2 |
| `MICROSOFT_CLIENT_SECRET` | do passo 2 |
| `MESES_HABILITADOS` | `Julho,Agosto,Setembro` (ou o que couber — ver ⚠️ abaixo) |

Depois **Deploy** (ou fazer um novo commit/push — o deploy é automático a cada
push na branch principal a partir daqui).

⚠️ **`MESES_HABILITADOS`**: o plano atual do Redis não aguenta o dataset
completo (4+ milhões de registros) de uma vez — dá OOM. Enquanto isso não for
resolvido (upgrade de plano Redis, ou mover esse cache pra outro banco), essa
variável limita quais meses o cron/botão "Atualizar agora" processam. Ver
CLAUDE.md > Deploy.

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
