"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui/primitives";

export interface ToolInfo {
  href: string;
  label: string;
  description: string;
}

export const TOOLS: ToolInfo[] = [
  { href: "/calculadora", label: "Calculadora", description: "Científica completa, com variáveis, matrizes, unidades e gráfico de funções." },
  { href: "/formulas", label: "Fórmulas", description: "Mais de 100 fórmulas de Matemática, Física e Química com solução passo a passo. Salve favoritas, crie as suas e vincule às aulas." },
  { href: "/ferramentas/tabela-periodica", label: "Tabela periódica", description: "Os 118 elementos: massa, família, estado físico e distribuição eletrônica." },
  { href: "/ferramentas/constantes", label: "Constantes", description: "Constantes físicas e químicas com valores para copiar (c, h, G, R, N_A...)." },
  { href: "/ferramentas/conversor", label: "Conversor de unidades", description: "Comprimento, massa, tempo, temperatura, pressão, energia, dados e mais." },
  { href: "/ferramentas/tabelas", label: "Tabelas de consulta", description: "Derivadas, integrais, trigonometria, logaritmos e áreas e volumes." },
];

/** Abas para navegar entre as ferramentas (aparecem no topo de cada uma). */
export function ToolsNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Ferramentas" className="-mx-1 mb-4 flex gap-1 overflow-x-auto px-1 pb-1">
      <Link
        href="/ferramentas"
        aria-current={pathname === "/ferramentas" ? "page" : undefined}
        className={cx(
          "shrink-0 rounded-full border border-line px-3 py-1.5 text-sm font-medium",
          pathname === "/ferramentas" ? "bg-primary text-primary-fg" : "hover:bg-surface-2",
        )}
      >
        Todas
      </Link>
      {TOOLS.map((tool) => {
        const active = pathname === tool.href || pathname.startsWith(`${tool.href}/`);
        return (
          <Link
            key={tool.href}
            href={tool.href}
            aria-current={active ? "page" : undefined}
            className={cx(
              "shrink-0 rounded-full border border-line px-3 py-1.5 text-sm font-medium",
              active ? "bg-primary text-primary-fg" : "hover:bg-surface-2",
            )}
          >
            {tool.label}
          </Link>
        );
      })}
    </nav>
  );
}
