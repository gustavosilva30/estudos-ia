import type { Metadata } from "next";
import { FormulasView } from "@/components/formulas/formulas-view";

export const metadata: Metadata = { title: "Fórmulas" };

// A biblioteca de fórmulas é estática e o resolvedor roda no navegador: não depende de dados do servidor.
export const instant = false;

export default function Page() {
  return <FormulasView />;
}
