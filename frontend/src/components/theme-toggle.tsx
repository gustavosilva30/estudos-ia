"use client";

import { useTheme } from "@/lib/theme";
import { useSession } from "@/lib/session";
import type { ThemePreference } from "@/lib/types";
import { MonitorIcon, MoonIcon, SunIcon } from "./ui/icons";

const ORDER: ThemePreference[] = ["light", "dark", "system"];
const LABELS: Record<ThemePreference, string> = {
  light: "Tema claro",
  dark: "Tema escuro",
  system: "Tema do sistema",
};

/** Alterna claro → escuro → sistema. Salva no navegador e, se houver sessão, na conta. */
export function ThemeToggle({ showLabel = false }: { showLabel?: boolean }) {
  const { preference, setPreference } = useTheme();
  const { state, saveTheme } = useSession();
  const next = ORDER[(ORDER.indexOf(preference) + 1) % ORDER.length];
  const Icon = preference === "light" ? SunIcon : preference === "dark" ? MoonIcon : MonitorIcon;

  return (
    <button
      type="button"
      onClick={() => (state.status === "authed" ? saveTheme(next) : setPreference(next))}
      aria-label={`${LABELS[preference]}. Alternar para ${LABELS[next].toLowerCase()}`}
      title={LABELS[preference]}
      className="inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm text-muted hover:bg-surface-2 hover:text-fg"
    >
      <Icon />
      {showLabel && <span>{LABELS[preference]}</span>}
    </button>
  );
}
