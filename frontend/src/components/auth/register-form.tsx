"use client";

import Link from "next/link";
import { useState } from "react";
import { Alert, Button, Field, PasswordField } from "@/components/ui/primitives";
import { ApiError } from "@/lib/api";
import { useSession } from "@/lib/session";
import { useRedirectIfAuthed } from "./use-redirect-if-authed";

const MIN_PASSWORD = 10;

export function RegisterForm() {
  const redirecting = useRedirectIfAuthed("/dashboard");
  const { register } = useSession();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const passwordError =
    password && password.length < MIN_PASSWORD ? `Use pelo menos ${MIN_PASSWORD} caracteres.` : null;
  const confirmError = confirm && confirm !== password ? "As senhas não coincidem." : null;

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (password.length < MIN_PASSWORD || password !== confirm) return;
    setBusy(true);
    try {
      await register(email.trim(), password, name.trim());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível criar a conta. Tente novamente.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Criar conta</h1>
        <p className="mt-1 text-sm text-muted">Comece a organizar seus estudos.</p>
      </div>
      {error && <Alert>{error}</Alert>}
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Nome (opcional)" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
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
          autoComplete="new-password"
          required
          hint={`Mínimo de ${MIN_PASSWORD} caracteres.`}
          error={passwordError}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <PasswordField
          label="Confirmar senha"
          autoComplete="new-password"
          required
          error={confirmError}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        <Button type="submit" className="w-full" loading={busy || redirecting}>
          Criar conta
        </Button>
      </form>
      <p className="text-sm">
        Já tem conta?{" "}
        <Link href="/entrar" className="text-primary hover:underline">
          Entrar
        </Link>
      </p>
    </div>
  );
}
