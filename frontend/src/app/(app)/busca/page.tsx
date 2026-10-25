import type { Metadata } from "next";
import { Suspense } from "react";
import { SearchView } from "@/components/search/search-view";
import { Skeleton } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Pesquisar" };

// Conteúdo depende da sessão do usuário (carregada no navegador): não promete navegação "instantânea".
export const instant = false;

export default function Page() {
  return (
    <Suspense fallback={<Skeleton className="h-40" />}>
      <SearchView />
    </Suspense>
  );
}
