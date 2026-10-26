import type { Metadata } from "next";
import { Suspense } from "react";
import { FormulasView } from "@/components/formulas/formulas-view";
import { Skeleton } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Fórmulas" };

// Guarda e lê favoritos, anotações e fórmulas próprias do servidor (carregados no navegador).
export const instant = false;

export default function Page() {
  return (
    <Suspense fallback={<Skeleton className="h-40" />}>
      <FormulasView />
    </Suspense>
  );
}
