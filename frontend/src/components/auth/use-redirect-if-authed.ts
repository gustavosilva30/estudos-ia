"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSession } from "@/lib/session";

/** Telas de login/cadastro: quem já está autenticado vai direto para o destino. */
export function useRedirectIfAuthed(destination: string) {
  const { state } = useSession();
  const router = useRouter();
  useEffect(() => {
    if (state.status === "authed") router.replace(destination);
  }, [state.status, destination, router]);
  return state.status === "authed";
}
