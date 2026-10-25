"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "./api";
import { useSession } from "./session";

interface Result<T> {
  key: string;
  data?: T;
  error?: string;
}

/**
 * Busca dados (GET) e acompanha carregando/erro. Mantém os dados anteriores enquanto recarrega
 * (útil em paginação e filtros). `path = null` desliga a busca.
 */
export function useApi<T>(path: string | null) {
  const { reload: reloadSession } = useSession();
  const [tick, setTick] = useState(0);
  const [result, setResult] = useState<Result<T> | null>(null);
  const key = `${path}#${tick}`;

  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    api<T>(path, { signal: controller.signal })
      .then((data) => setResult({ key, data }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        // Sessão expirada: o AppShell volta ao login.
        if (error instanceof ApiError && error.status === 401) void reloadSession();
        setResult({ key, error: error instanceof Error ? error.message : "Erro inesperado." });
      });
    return () => controller.abort();
  }, [path, key, reloadSession]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  /** Atualiza os dados em memória (atualização otimista) sem nova requisição. */
  const mutate = useCallback((fn: (current: T) => T) => {
    setResult((r) => (r?.data !== undefined ? { ...r, data: fn(r.data) } : r));
  }, []);

  const loading = path !== null && result?.key !== key;
  return {
    data: path === null ? undefined : result?.data,
    error: result?.key === key ? result.error : undefined,
    loading,
    reload,
    mutate,
  };
}

export function useDebounced<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

/** Mensagem amigável de qualquer erro capturado. */
export function errorMessage(error: unknown, fallback = "Não foi possível concluir a operação."): string {
  return error instanceof ApiError || error instanceof Error ? error.message : fallback;
}
