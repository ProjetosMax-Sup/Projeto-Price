import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Rotas que ficam de fora do login individual: só a própria tela de login
// (não existe cadastro público — contas são criadas manualmente pelo Gestor
// no painel do Clerk) e o cron diário (protegido por CRON_SECRET via header,
// não por sessão — chamado pela Vercel, sem navegador/cookie).
// /api/auth/onedrive/* continua protegida (era por SITE_PASSWORD, agora por
// Clerk) — é quem autoriza a conta OneDrive da empresa, não pode ficar aberta.
const isRotaPublica = createRouteMatcher(["/sign-in(.*)", "/api/cron(.*)"]);

export default clerkMiddleware(async (auth, request) => {
  if (!isRotaPublica(request)) await auth.protect();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
