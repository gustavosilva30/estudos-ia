"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Tex } from "@/components/formulas/tex";
import { EmptyState } from "@/components/ui/forms";
import { TrashIcon } from "@/components/ui/icons";
import { Alert, Button, Card, Field } from "@/components/ui/primitives";
import { api } from "@/lib/api";
import { customToFormula, formulaAsText } from "@/lib/formula-custom";
import { categoryLabel, formulaKey, searchFormulas, type Formula } from "@/lib/formula-engine";
import { FORMULAS } from "@/lib/formulas";
import type { CustomFormulaData, FormulaMark, LessonFormulaLink, Material } from "@/lib/types";
import { errorMessage, useApi } from "@/lib/use-api";

/** Fórmulas vinculadas à aula: consulta rápida e atalho para virar texto (e então ser estudada pela IA). */
export function FormulasPanel({ lessonId, onMaterialSaved }: { lessonId: string; onMaterialSaved: () => void }) {
  const links = useApi<LessonFormulaLink[]>(`/lessons/${lessonId}/formulas`);
  const customApi = useApi<CustomFormulaData[]>("/formulas/custom");
  const marksApi = useApi<FormulaMark[]>("/formulas/marks");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  const all = useMemo(() => [...FORMULAS, ...(customApi.data ?? []).map(customToFormula)], [customApi.data]);
  const byKey = useMemo(() => new Map(all.map((f) => [formulaKey(f), f])), [all]);
  const noteOf = (key: string) => marksApi.data?.find((m) => m.formula_key === key)?.note ?? null;

  const linkedKeys = new Set((links.data ?? []).map((l) => l.formula_key));
  const linked = (links.data ?? []).map((l) => byKey.get(l.formula_key)).filter((f): f is Formula => f !== undefined);
  const suggestions = query.trim().length >= 2 ? searchFormulas(all, query, "todas").filter((f) => !linkedKeys.has(formulaKey(f))).slice(0, 8) : [];

  async function act(key: string, action: "add" | "remove" | "text") {
    setBusy(`${action}:${key}`);
    setMessage(null);
    try {
      if (action === "add") {
        await api(`/lessons/${lessonId}/formulas`, { method: "POST", body: { formula_key: key } });
        setQuery("");
      } else if (action === "remove") {
        await api(`/lessons/${lessonId}/formulas/${key}`, { method: "DELETE" });
      } else {
        const formula = byKey.get(key);
        if (!formula) return;
        await api<Material>(`/lessons/${lessonId}/materials`, { method: "POST", body: { content: formulaAsText(formula, noteOf(key)), origin: "formula" } });
        onMaterialSaved();
        setMessage({ tone: "success", text: "Fórmula salva como texto da aula. Use a aba IA para resumir ou criar exercícios sobre ela." });
      }
      links.reload();
    } catch (error) {
      setMessage({ tone: "error", text: errorMessage(error) });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      {message && <Alert tone={message.tone}>{message.text}</Alert>}
      {links.error && <Alert>{links.error}</Alert>}

      {linked.length === 0 && !links.loading ? (
        <EmptyState title="Nenhuma fórmula vinculada">Vincule fórmulas do catálogo (ou as suas) para consultá-las junto com o conteúdo desta aula.</EmptyState>
      ) : (
        <ul className="space-y-3">
          {linked.map((f) => {
            const key = formulaKey(f);
            return (
              <li key={key}>
                <Card className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="mr-auto font-semibold">{f.title}</h3>
                    <span className="text-xs text-muted">{categoryLabel(f.category)}</span>
                  </div>
                  <div className="overflow-x-auto rounded-lg bg-surface-2 px-3 py-3 text-center text-sm">
                    <Tex display>{f.latex}</Tex>
                  </div>
                  {noteOf(key) && <p className="whitespace-pre-wrap text-sm text-muted">Anotação: {noteOf(key)}</p>}
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/formulas?f=${encodeURIComponent(key)}`} className="inline-flex min-h-9 items-center rounded-lg border border-line px-3 text-sm font-medium hover:bg-surface-2">
                      Abrir e resolver
                    </Link>
                    <Button variant="secondary" className="min-h-9" loading={busy === `text:${key}`} onClick={() => void act(key, "text")}>
                      Salvar como texto
                    </Button>
                    <Button variant="ghost" className="min-h-9" aria-label={`Desvincular ${f.title}`} loading={busy === `remove:${key}`} onClick={() => void act(key, "remove")}>
                      <TrashIcon />
                    </Button>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <Card className="space-y-2">
        <Field label="Vincular uma fórmula" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Busque por nome (ex.: bhaskara, ohm, juros)" autoComplete="off" />
        {suggestions.length > 0 && (
          <ul className="divide-y divide-line rounded-lg border border-line">
            {suggestions.map((f) => (
              <li key={formulaKey(f)} className="flex items-center gap-2 px-3 py-2">
                <span className="flex-1 text-sm">
                  {f.title} <span className="text-xs text-muted">· {categoryLabel(f.category)}</span>
                </span>
                <Button variant="secondary" className="min-h-8 px-3 text-xs" loading={busy === `add:${formulaKey(f)}`} onClick={() => void act(formulaKey(f), "add")}>
                  Vincular
                </Button>
              </li>
            ))}
          </ul>
        )}
        {query.trim().length >= 2 && suggestions.length === 0 && <p className="text-sm text-muted">Nenhuma fórmula nova encontrada.</p>}
      </Card>
    </div>
  );
}
