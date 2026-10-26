import type { Metadata } from "next";
import { ConverterView } from "@/components/tools/converter-view";

export const metadata: Metadata = { title: "Conversor de unidades" };

// Conteúdo estático que roda no navegador: não depende de dados carregados do servidor.
export const instant = false;

export default function Page() {
  return <ConverterView />;
}
