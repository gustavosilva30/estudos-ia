"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import type { ComponentType, SVGProps } from "react";
import { useSession } from "@/lib/session";
import { firstName } from "@/lib/format";
import { ThemeToggle } from "./theme-toggle";
import { BookIcon, CalculatorIcon, FormulaIcon, HomeIcon, LibraryIcon, LogoutIcon, ReviewIcon, SearchIcon, SparkIcon } from "./ui/icons";
import { Alert, Button, cx, Spinner } from "./ui/primitives";

interface NavItem {
  href: string;
  label: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** false = tela ainda não construída: aparece desativada, sem link quebrado. */
  ready: boolean;
}

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Painel", Icon: HomeIcon, ready: true },
  { href: "/materias", label: "Matérias", Icon: BookIcon, ready: true },
  { href: "/biblioteca", label: "Biblioteca", Icon: LibraryIcon, ready: true },
  { href: "/busca", label: "Pesquisar", Icon: SearchIcon, ready: true },
  { href: "/formulas", label: "Fórmulas", Icon: FormulaIcon, ready: true },
  { href: "/calculadora", label: "Calculadora", Icon: CalculatorIcon, ready: true },
  { href: "/revisao", label: "Revisão", Icon: ReviewIcon, ready: false },
];

function Logo() {
  return (
    <div className="flex items-center gap-2 font-semibold">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-fg">
        <SparkIcon width={18} height={18} />
      </span>
      Estudos IA
    </div>
  );
}

function QuickSearch() {
  const router = useRouter();
  return (
    <form
      role="search"
      className="mt-6"
      onSubmit={(event) => {
        event.preventDefault();
        const q = String(new FormData(event.currentTarget).get("q") ?? "").trim();
        if (q.length >= 2) router.push(`/busca?q=${encodeURIComponent(q)}`);
      }}
    >
      <label htmlFor="busca-rapida" className="sr-only">
        Pesquisar em tudo
      </label>
      <input
        id="busca-rapida"
        name="q"
        type="search"
        placeholder="Pesquisar…"
        maxLength={200}
        className="block min-h-10 w-full rounded-lg border border-line bg-app px-3 text-sm placeholder:text-muted"
      />
    </form>
  );
}

function SidebarLink({ item, active }: { item: NavItem; active: boolean }) {
  const base = "flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium";
  if (!item.ready) {
    return (
      <span aria-disabled="true" className={cx(base, "cursor-not-allowed text-muted opacity-70")}>
        <item.Icon />
        <span className="flex-1">{item.label}</span>
        <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] uppercase tracking-wide">Em breve</span>
      </span>
    );
  }
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cx(base, active ? "bg-primary-soft text-fg" : "text-muted hover:bg-surface-2 hover:text-fg")}
    >
      <item.Icon />
      {item.label}
    </Link>
  );
}

function BottomLink({ item, active }: { item: NavItem; active: boolean }) {
  const base = "flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium";
  if (!item.ready) {
    return (
      <span aria-disabled="true" className={cx(base, "cursor-not-allowed text-muted opacity-50")}>
        <item.Icon />
        {item.label}
      </span>
    );
  }
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cx(base, active ? "text-primary" : "text-muted")}
    >
      <item.Icon />
      {item.label}
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { state, logout, reload } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  const leaving = useRef(false);

  useEffect(() => {
    // Sessão expirada: volta ao login lembrando a página. Saída voluntária: login limpo.
    if (state.status === "anon" && !leaving.current) {
      router.replace(`/entrar?proximo=${encodeURIComponent(pathname)}`);
    }
  }, [state.status, pathname, router]);

  if (state.status === "error") {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 px-4">
        <Alert>{state.message}</Alert>
        <Button onClick={() => void reload()}>Tentar novamente</Button>
      </div>
    );
  }
  if (state.status !== "authed") {
    return (
      <div className="grid min-h-screen place-items-center">
        <Spinner label="Carregando sua conta…" />
      </div>
    );
  }

  const { user } = state;
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  async function onLogout() {
    leaving.current = true;
    await logout();
    router.replace("/entrar");
  }

  return (
    <div className="min-h-screen lg:pl-64">
      {/* Menu lateral (computador e tablet largo) */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-line bg-surface p-4 lg:flex">
        <Logo />
        <QuickSearch />
        <nav aria-label="Principal" className="mt-4 flex flex-1 flex-col gap-1">
          {NAV.map((item) => (
            <SidebarLink key={item.href} item={item} active={isActive(item.href)} />
          ))}
        </nav>
        <div className="space-y-2 border-t border-line pt-4">
          <div className="px-3 text-sm">
            <p className="truncate font-medium">{firstName(user.display_name, user.email)}</p>
            <p className="truncate text-xs text-muted">{user.email}</p>
          </div>
          <ThemeToggle showLabel />
          <button
            type="button"
            onClick={onLogout}
            className="flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-sm text-muted hover:bg-surface-2 hover:text-fg"
          >
            <LogoutIcon />
            Sair
          </button>
        </div>
      </aside>

      {/* Barra superior (celular e tablet) */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-surface px-4 py-2 lg:hidden">
        <Logo />
        <div className="flex items-center">
          <ThemeToggle />
          <button
            type="button"
            onClick={onLogout}
            aria-label="Sair"
            className="inline-flex min-h-10 items-center rounded-lg px-3 text-muted hover:bg-surface-2 hover:text-fg"
          >
            <LogoutIcon />
          </button>
        </div>
      </header>

      <main id="conteudo" className="mx-auto w-full max-w-5xl px-4 py-6 pb-24 sm:px-6 lg:pb-10">
        {children}
      </main>

      {/* Navegação inferior (celular e tablet) */}
      <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        {NAV.map((item) => (
          <BottomLink key={item.href} item={item} active={isActive(item.href)} />
        ))}
      </nav>
    </div>
  );
}
