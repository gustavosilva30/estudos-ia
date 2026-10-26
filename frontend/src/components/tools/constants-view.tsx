"use client";

import { useState } from "react";
import { Tex } from "@/components/formulas/tex";
import { ToolsNav } from "@/components/tools/tools-nav";
import { EmptyState, PageHeader } from "@/components/ui/forms";
import { Button, cx, Field } from "@/components/ui/primitives";
import { CONSTANT_GROUPS, CONSTANTS, constantForCopy, formatConstant, type ConstantGroup } from "@/lib/constants-data";
import { normalize } from "@/lib/elements";

export function ConstantsView() {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<ConstantGroup | "todas">("todas");
  const [copied, setCopied] = useState<string | null>(null);

  const q = normalize(query);
  const shown = CONSTANTS.filter((c) => (group === "todas" || c.group === group) && (!q || normalize(`${c.name} ${c.unit} ${c.note ?? ""}`).includes(q) || normalize(c.id) === q));

  async function copy(id: string, value: number) {
    try {
      await navigator.clipboard.writeText(constantForCopy(value));
      setCopied(id);
      setTimeout(() => setCopied((current) => (current === id ? null : current)), 1500);
    } catch {
      setCopied(null); // sem permissão para a área de transferência: a pessoa ainda pode selecionar o valor
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Constantes" subtitle="Constantes físicas e químicas. Use “Copiar” para colar o valor (com ponto decimal) na calculadora ou nas fórmulas." />
      <ToolsNav />
      <div className="mb-4 grid gap-3 sm:grid-cols-[minmax(0,16rem)_1fr] sm:items-end">
        <Field label="Buscar constante" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ex.: planck, gases, massa" autoComplete="off" />
        <div role="group" aria-label="Grupo" className="flex flex-wrap gap-1.5">
          {([{ id: "todas", label: "Todas" }, ...CONSTANT_GROUPS] as { id: ConstantGroup | "todas"; label: string }[]).map((g) => (
            <button
              key={g.id}
              type="button"
              aria-pressed={group === g.id}
              onClick={() => setGroup(g.id)}
              className={cx("min-h-9 rounded-full border border-line px-3 text-sm font-medium", group === g.id ? "bg-primary text-primary-fg" : "hover:bg-surface-2")}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <EmptyState title="Nenhuma constante encontrada">Tente outra palavra.</EmptyState>
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
          {shown.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
              <div className="min-w-0 flex-1 basis-56">
                <p className="font-medium">{c.name}</p>
                {c.note && <p className="text-xs text-muted">{c.note}</p>}
              </div>
              <p className="text-lg">
                <Tex>{c.symbol}</Tex> <span aria-hidden="true">=</span>
              </p>
              <p className="text-right font-mono text-sm">
                <span className="font-semibold">{formatConstant(c.value)}</span> <span className="text-muted">{c.unit}</span>
              </p>
              <Button variant="secondary" className="min-h-8 px-3 text-xs" onClick={() => copy(c.id, c.value)} aria-label={`Copiar valor de ${c.name}`}>
                {copied === c.id ? "Copiado!" : "Copiar"}
              </Button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-muted">Valores CODATA. As constantes definidas pelo SI (c, h, e, k_B e N_A) são exatas.</p>
    </div>
  );
}
