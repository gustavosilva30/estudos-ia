import type { Metadata } from "next";
import { Suspense } from "react";
import { NewLessonForm } from "@/components/lesson/new-lesson-form";
import { Skeleton } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Nova aula" };

// Conteúdo depende da sessão do usuário (carregada no navegador): não promete navegação "instantânea".
export const instant = false;

export default function Page() {
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      <NewLessonForm />
    </Suspense>
  );
}
