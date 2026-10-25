import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 px-4">
      <h1 className="text-2xl font-semibold">Página não encontrada</h1>
      <p className="text-sm text-muted">O endereço que você acessou não existe ou foi movido.</p>
      <Link href="/dashboard" className="text-primary hover:underline">
        Ir para o painel
      </Link>
    </main>
  );
}
