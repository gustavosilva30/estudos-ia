"use client";

import Link from "next/link";
import { ToolsNav, TOOLS } from "@/components/tools/tools-nav";
import { PageHeader } from "@/components/ui/forms";

export function ToolsHub() {
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Ferramentas"
        subtitle="Calculadora, fórmulas e consultas rápidas para estudar. Tudo funciona no navegador, sem IA e sem gastar cota."
      />
      <ToolsNav />
      <ul className="grid gap-3 sm:grid-cols-2">
        {TOOLS.map((tool) => (
          <li key={tool.href}>
            <Link
              href={tool.href}
              className="block h-full rounded-xl border border-line bg-surface p-4 transition-colors hover:bg-surface-2"
            >
              <span className="block font-semibold">{tool.label}</span>
              <span className="mt-1 block text-sm text-muted">{tool.description}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
