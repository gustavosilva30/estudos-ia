import type { Metadata } from "next";
import { SubjectsView } from "@/components/library/subjects-view";

export const metadata: Metadata = { title: "Matérias" };

// Conteúdo depende da sessão do usuário (carregada no navegador): não promete navegação "instantânea".
export const instant = false;

export default function Page() {
  return <SubjectsView />;
}
