"use client";

import Link from "next/link";
import { useState } from "react";
import { Alert, Button, Field } from "@/components/ui/primitives";
import { api, ApiError } from "@/lib/api";

export function ForgotForm() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api("/auth/password-reset/request", { method: "POST", body: { email: email.trim() } });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível enviar o pedido. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Recuperar senha</h1>
        <p className="mt-1 text-sm text-muted">Informe seu e-mail para receber o link de redefinição.</p>
      </div>
      {done ? (
        <Alert tone="success">
          Se o e-mail estiver cadastrado, enviaremos as instruções de recuperação. Confira também a caixa de spam.
        </Alert>
      ) : (
        <>
          {error && <Alert>{error}</Alert>}
          <form onSubmit={onSubmit} className="space-y-4">
            <Field
              label="E-mail"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Button type="submit" className="w-full" loading={busy}>
              Enviar link
            </Button>
          </form>
        </>
      )}
      <Link href="/entrar" className="text-sm text-primary hover:underline">
        Voltar para o login
      </Link>
    </div>
  );
}
