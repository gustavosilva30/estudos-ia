import type { Metadata } from "next";
import { CalculatorView } from "@/components/calculator/calculator-view";

export const metadata: Metadata = { title: "Calculadora" };

// A calculadora roda toda no navegador (sem dados da sessão): não depende de nada carregado do servidor.
export const instant = false;

export default function Page() {
  return <CalculatorView />;
}
