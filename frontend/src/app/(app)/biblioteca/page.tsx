import type { Metadata } from "next";
import { Suspense } from "react";
import { LibraryView } from "@/components/library/library-view";
import { Skeleton } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Biblioteca" };

// Conteúdo depende da sessão do usuário (carregada no navegador): não promete navegação "instantânea".
export const instant = false;

export default function Page() {
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      <LibraryView />
    </Suspense>
  );
}
