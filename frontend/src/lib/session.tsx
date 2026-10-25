"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api, ApiError, setCsrfToken } from "./api";
import { useTheme } from "./theme";
import type { Preferences, SessionData, ThemePreference, User } from "./types";

type State =
  | { status: "loading" }
  | { status: "anon" }
  | { status: "error"; message: string }
  | { status: "authed"; user: User; preferences: Preferences };

interface SessionContextValue {
  state: State;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
  reload: () => Promise<void>;
  saveTheme: (theme: ThemePreference) => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>({ status: "loading" });
  const { setPreference } = useTheme();
  const themeRef = useRef(setPreference);
  useEffect(() => {
    themeRef.current = setPreference;
  }, [setPreference]);

  const accept = useCallback((data: SessionData) => {
    setCsrfToken(data.csrf_token);
    themeRef.current(data.preferences.theme);
    setState({ status: "authed", user: data.user, preferences: data.preferences });
  }, []);

  const reload = useCallback(async () => {
    try {
      accept(await api<SessionData>("/users/me"));
    } catch (error) {
      setCsrfToken(null);
      if (error instanceof ApiError && error.status === 401) setState({ status: "anon" });
      else setState({ status: "error", message: error instanceof Error ? error.message : "Erro inesperado." });
    }
  }, [accept]);

  useEffect(() => {
    // Descobre se já existe uma sessão válida (cookie) ao abrir o app.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, [reload]);

  const login = useCallback(
    async (email: string, password: string) => {
      accept(await api<SessionData>("/auth/login", { method: "POST", body: { email, password } }));
    },
    [accept],
  );

  const register = useCallback(
    async (email: string, password: string, displayName: string) => {
      accept(
        await api<SessionData>("/auth/register", {
          method: "POST",
          body: { email, password, display_name: displayName || null },
        }),
      );
    },
    [accept],
  );

  const logout = useCallback(async () => {
    try {
      await api("/auth/logout", { method: "POST" });
    } catch {
      /* mesmo se falhar, encerramos a sessão neste navegador */
    }
    setCsrfToken(null);
    setState({ status: "anon" });
  }, []);

  const saveTheme = useCallback((theme: ThemePreference) => {
    themeRef.current(theme);
    // Sincroniza com a conta; se falhar, a escolha continua valendo neste navegador.
    api("/users/me/preferences", { method: "PATCH", body: { theme } }).catch(() => undefined);
  }, []);

  const value = useMemo(
    () => ({ state, login, register, logout, reload, saveTheme }),
    [state, login, register, logout, reload, saveTheme],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession deve ser usado dentro de SessionProvider");
  return ctx;
}
