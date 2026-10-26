import type { Metadata } from "next";
import { ConstantsView } from "@/components/tools/constants-view";

export const metadata: Metadata = { title: "Constantes" };

// Conteúdo estático que roda no navegador: não depende de dados carregados do servidor.
export const instant = false;

export default function Page() {
  return <ConstantsView />;
}
