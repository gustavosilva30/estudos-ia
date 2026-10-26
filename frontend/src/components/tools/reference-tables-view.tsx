"use client";

import { useState } from "react";
import { Tex } from "@/components/formulas/tex";
import { ToolsNav } from "@/components/tools/tools-nav";
import { EmptyState, PageHeader } from "@/components/ui/forms";
import { cx, Field } from "@/components/ui/primitives";
import { normalize } from "@/lib/elements";
import { REFERENCE_TABLES } from "@/lib/reference-tables";

export function ReferenceTablesView() {
  const [tableId, setTableId] = useState(REFERENCE_TABLES[0].id);
  const [query, setQuery] = useState("");
  const table = REFERENCE_TABLES.find((t) => t.id === tableId) ?? REFERENCE_TABLES[0];
  const q = normalize(query);
  const rows = q ? REFERENCE_TABLES.flatMap((t) => t.rows.filter((r) => normalize(`${r.name} ${t.title}`).includes(q)).map((r) => ({ ...r, from: t.title }))) : table.rows.map((r) => ({ ...r, from: "" }));

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Tabelas de consulta" subtitle="Derivadas, integrais, trigonometria, potências, logaritmos, limites e áreas e volumes." />
      <ToolsNav />
      <div className="mb-4 space-y-3">
        <Field label="Buscar em todas as tabelas" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ex.: seno, cadeia, logaritmo" autoComplete="off" className="max-w-sm" />
        {!q && (
          <div role="group" aria-label="Tabela" className="flex flex-wrap gap-1.5">
            {REFERENCE_TABLES.map((t) => (
              <button
                key={t.id}
                type="button"
                aria-pressed={tableId === t.id}
                onClick={() => setTableId(t.id)}
                className={cx("min-h-9 rounded-full border border-line px-3 text-sm font-medium", tableId === t.id ? "bg-primary text-primary-fg" : "hover:bg-surface-2")}
              >
                {t.title}
              </button>
            ))}
          </div>
        )}
      </div>

      {!q && table.intro && <p className="mb-3 text-sm text-muted">{table.intro}</p>}
      {rows.length === 0 ? (
        <EmptyState title="Nada encontrado">Tente outra palavra.</EmptyState>
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
          {rows.map((row) => (
            <li key={`${row.from}-${row.name}`} className="grid gap-1 px-4 py-3 sm:grid-cols-[14rem_1fr] sm:items-center sm:gap-4">
              <p className="text-sm font-medium">
                {row.name}
                {row.from && <span className="block text-xs font-normal text-muted">{row.from}</span>}
              </p>
              <div className="overflow-x-auto">
                <Tex display>{row.latex}</Tex>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
