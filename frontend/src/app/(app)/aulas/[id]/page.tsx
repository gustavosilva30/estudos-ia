import type { Metadata } from "next";
import { Suspense } from "react";
import { LessonView } from "@/components/lesson/lesson-view";
import { Skeleton } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Aula" };

// Conteúdo depende da sessão do usuário (carregada no navegador): não promete navegação "instantânea".
export const instant = false;

export default function Page({ params }: PageProps<"/aulas/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-40" />}>
      {params.then(({ id }) => (
        <LessonView id={id} />
      ))}
    </Suspense>
  );
}
