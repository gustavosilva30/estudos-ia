import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { Spinner } from "@/components/ui/primitives";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  // usePathname() é dado de runtime nas rotas dinâmicas (/aulas/[id]); precisa de Suspense.
  return (
    <Suspense
      fallback={
        <div className="grid min-h-screen place-items-center">
          <Spinner label="Carregando…" />
        </div>
      }
    >
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
