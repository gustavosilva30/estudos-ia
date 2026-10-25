"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Alert, Button, PasswordField } from "@/components/ui/primitives";
import { api, ApiError } from "@/lib/api";

const MIN_PASSWORD = 10;

export function ResetForm() {
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);
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
      await api("/auth/password-reset/confirm", { method: "POST", body: { token, new_password: password } });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível redefinir a senha. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Link inválido</h1>
        <Alert>O link de recuperação está incompleto. Solicite um novo.</Alert>
        <Link href="/recuperar-senha" className="text-sm text-primary hover:underline">
          Solicitar novo link
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Nova senha</h1>
        <p className="mt-1 text-sm text-muted">Escolha uma senha nova para a sua conta.</p>
      </div>
      {done ? (
        <>
          <Alert tone="success">Senha redefinida. Todas as sessões antigas foram encerradas.</Alert>
          <Link href="/entrar" className="inline-block text-sm text-primary hover:underline">
            Entrar com a nova senha
          </Link>
        </>
      ) : (
        <>
          {error && <Alert>{error}</Alert>}
          <form onSubmit={onSubmit} className="space-y-4">
            <PasswordField
              label="Nova senha"
              autoComplete="new-password"
              required
              hint={`Mínimo de ${MIN_PASSWORD} caracteres.`}
              error={passwordError}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <PasswordField
              label="Confirmar nova senha"
              autoComplete="new-password"
              required
              error={confirmError}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
            <Button type="submit" className="w-full" loading={busy}>
              Redefinir senha
            </Button>
          </form>
        </>
      )}
    </div>
  );
}
