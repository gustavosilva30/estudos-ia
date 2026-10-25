import type { Metadata } from "next";
import { Suspense } from "react";
import { SubjectView } from "@/components/library/subject-view";
import { Skeleton } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Matéria" };

// Conteúdo depende da sessão do usuário (carregada no navegador): não promete navegação "instantânea".
export const instant = false;

export default function Page({ params }: PageProps<"/materias/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-40" />}>
      {params.then(({ id }) => (
        <SubjectView id={id} />
      ))}
    </Suspense>
  );
}
