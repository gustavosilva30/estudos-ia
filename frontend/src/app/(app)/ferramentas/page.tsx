import type { Metadata } from "next";
import { ToolsHub } from "@/components/tools/tools-hub";

export const metadata: Metadata = { title: "Ferramentas" };

// Conteúdo estático que roda no navegador: não depende de dados carregados do servidor.
export const instant = false;

export default function Page() {
  return <ToolsHub />;
}
