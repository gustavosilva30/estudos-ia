"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Alert, Button, Field, PasswordField } from "@/components/ui/primitives";
import { ApiError } from "@/lib/api";
import { safeNext } from "@/lib/navigation";
import { useSession } from "@/lib/session";
import { useRedirectIfAuthed } from "./use-redirect-if-authed";

export function LoginForm() {
  const params = useSearchParams();
  const destination = safeNext(params.get("proximo"));
  const redirecting = useRedirectIfAuthed(destination);
  const { login } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível entrar. Tente novamente.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Entrar</h1>
        <p className="mt-1 text-sm text-muted">Acesse suas matérias, aulas e resumos.</p>
      </div>
      {params.get("proximo") && !error && <Alert tone="info">Entre para continuar.</Alert>}
      {error && <Alert>{error}</Alert>}
      <form onSubmit={onSubmit} className="space-y-4" noValidate={false}>
        <Field
          label="E-mail"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <PasswordField
          label="Senha"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button type="submit" className="w-full" loading={busy || redirecting}>
          Entrar
        </Button>
      </form>
      <div className="flex flex-col gap-2 text-sm sm:flex-row sm:justify-between">
        <Link href="/recuperar-senha" className="text-primary hover:underline">
          Esqueci minha senha
        </Link>
        <Link href="/cadastro" className="text-primary hover:underline">
          Criar uma conta
        </Link>
      </div>
    </div>
  );
}
