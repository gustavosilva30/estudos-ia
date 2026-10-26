import type { Metadata } from "next";
import { ReferenceTablesView } from "@/components/tools/reference-tables-view";

export const metadata: Metadata = { title: "Tabelas de consulta" };

// Conteúdo estático que roda no navegador: não depende de dados carregados do servidor.
export const instant = false;

export default function Page() {
  return <ReferenceTablesView />;
}
