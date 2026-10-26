import type { Metadata } from "next";
import { PeriodicTableView } from "@/components/tools/periodic-table";

export const metadata: Metadata = { title: "Tabela periódica" };

// Conteúdo estático que roda no navegador: não depende de dados carregados do servidor.
export const instant = false;

export default function Page() {
  return <PeriodicTableView />;
}
