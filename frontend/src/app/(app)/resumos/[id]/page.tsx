import type { Metadata } from "next";
import { Suspense } from "react";
import { SummaryEditor } from "@/components/summary/summary-editor";
import { Skeleton } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Resumo" };

// Conteúdo depende da sessão do usuário (carregada no navegador): não promete navegação "instantânea".
export const instant = false;

export default function Page({ params }: PageProps<"/resumos/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-40" />}>
      {params.then(({ id }) => (
        <SummaryEditor id={id} />
      ))}
    </Suspense>
  );
}
