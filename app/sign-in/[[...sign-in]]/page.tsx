import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-zinc-50 px-6">
      <h1 className="font-display text-xl font-bold text-zinc-900">
        MAX <span className="text-vermelho">Supermercados</span>
      </h1>
      <SignIn />
    </div>
  );
}
