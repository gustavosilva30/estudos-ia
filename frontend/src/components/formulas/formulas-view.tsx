"use client";

import { useMemo, useState } from "react";
import { Tex } from "@/components/formulas/tex";
import { Badge, EmptyState, PageHeader, Select } from "@/components/ui/forms";
import { Alert, Button, Card, cx, Field } from "@/components/ui/primitives";
import { CATEGORIES, searchFormulas, solveFormula, type Category, type Formula } from "@/lib/formula-engine";
import { FORMULAS } from "@/lib/formulas";

export function FormulasView() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category | "todas">("todas");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const results = useMemo(() => searchFormulas(FORMULAS, query, category), [query, category]);
  const selected = FORMULAS.find((f) => f.id === selectedId) ?? null;

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <PageHeader
        title="Fórmulas"
        subtitle="Consulte fórmulas de Matemática, Física e Química e resolva passo a passo, sem IA: informe os valores que conhece e veja a conta desenvolvida."
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <div className={cx("min-w-0 space-y-3", selected && "hidden lg:block")}>
          <Field
            label="Buscar fórmula"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ex.: pitágoras, juros, ohm…"
            autoComplete="off"
          />
          <div role="group" aria-label="Área" className="flex flex-wrap gap-1.5">
            {([{ id: "todas", label: "Todas" }, ...CATEGORIES] as { id: Category | "todas"; label: string }[]).map((c) => (
              <button
                key={c.id}
                type="button"
                aria-pressed={category === c.id}
                onClick={() => setCategory(c.id)}
                className={cx(
                  "min-h-9 rounded-full border border-line px-3 text-sm font-medium",
                  category === c.id ? "bg-primary text-primary-fg" : "hover:bg-surface-2",
                )}
              >
                {c.label}
              </button>
            ))}
          </div>

          {results.length === 0 ? (
            <EmptyState title="Nenhuma fórmula encontrada">Tente outra palavra ou escolha “Todas”.</EmptyState>
          ) : (
            <ul className="space-y-1.5" aria-label="Fórmulas">
              {results.map((f) => (
                <li key={f.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(f.id)}
                    aria-current={selectedId === f.id ? "true" : undefined}
                    className={cx(
                      "w-full rounded-lg border border-line p-3 text-left transition-colors hover:bg-surface-2",
                      selectedId === f.id && "border-primary bg-primary-soft",
                    )}
                  >
                    <span className="block font-medium">{f.title}</span>
                    <span className="block text-xs text-muted">
                      {CATEGORIES.find((c) => c.id === f.category)?.label} · {f.topic}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={cx("min-w-0", !selected && "hidden lg:block")}>
          {selected ? (
            <FormulaDetail key={selected.id} formula={selected} onBack={() => setSelectedId(null)} />
          ) : (
            <Card>
              <p className="text-sm text-muted">Escolha uma fórmula na lista para ver a explicação e resolver passo a passo.</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function FormulaDetail({ formula, onBack }: { formula: Formula; onBack: () => void }) {
  const [solverIndex, setSolverIndex] = useState(0);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(formula.vars.filter((v) => v.default).map((v) => [v.id, v.default as string])),
  );
  const solver = formula.solvers[solverIndex];
  const byId = new Map(formula.vars.map((v) => [v.id, v]));
  const outcome = useMemo(() => solveFormula(formula, solver, values), [formula, solver, values]);

  function fillExample() {
    setSolverIndex(formula.example.solver);
    setValues((current) => ({ ...current, ...formula.example.values }));
  }

  return (
    <div className="space-y-4">
      <Button variant="ghost" className="lg:hidden" onClick={onBack}>
        ← Voltar à lista
      </Button>

      <Card className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">{formula.title}</h2>
          <Badge tone="primary">{CATEGORIES.find((c) => c.id === formula.category)?.label}</Badge>
          <Badge>{formula.topic}</Badge>
        </div>
        <div className="overflow-x-auto rounded-lg bg-surface-2 px-3 py-4 text-center text-sm">
          <Tex display>{formula.latex}</Tex>
        </div>
        <p className="text-sm">{formula.summary}</p>
        <table className="w-full text-sm">
          <caption className="sr-only">Variáveis da fórmula</caption>
          <tbody>
            {formula.vars.map((v) => (
              <tr key={v.id} className="border-t border-line">
                <th scope="row" className="w-20 py-1.5 text-left font-normal">
                  <Tex>{v.latex}</Tex>
                </th>
                <td className="py-1.5">{v.name}</td>
                <td className="py-1.5 text-right text-muted">{v.unit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">Resolver passo a passo</h3>
          <Button variant="secondary" className="min-h-8 px-3" onClick={fillExample}>
            Usar exemplo
          </Button>
        </div>

        {formula.solvers.length > 1 && (
          <Select label="O que você quer descobrir?" value={solverIndex} onChange={(e) => setSolverIndex(Number(e.target.value))}>
            {formula.solvers.map((s, i) => (
              <option key={s.label} value={i}>
                {s.label}
              </option>
            ))}
          </Select>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {solver.needs.map((id) => {
            const v = byId.get(id)!;
            return (
              <Field
                key={id}
                label={`${v.name}${v.unit ? ` (${v.unit})` : ""}`}
                inputMode="decimal"
                autoComplete="off"
                value={values[id] ?? ""}
                onChange={(e) => setValues({ ...values, [id]: e.target.value })}
                placeholder="0"
                maxLength={30}
              />
            );
          })}
        </div>

        <div aria-live="polite" className="space-y-2">
          {outcome.status === "incomplete" && (
            <p className="text-sm text-muted">
              Preencha {outcome.missing.length === 1 ? "o campo que falta" : "os campos que faltam"} para ver a conta.
            </p>
          )}
          {outcome.status === "error" && <Alert>{outcome.message}</Alert>}
          {outcome.status === "ok" && (
            <ol className="space-y-1 rounded-lg bg-surface-2 p-3" aria-label="Passos da solução">
              {outcome.lines.map((line, i) => (
                <li
                  key={i}
                  className={cx("overflow-x-auto py-1", i === outcome.lines.length - 1 && "border-t border-line pt-2 font-semibold text-primary")}
                >
                  <Tex display>{line}</Tex>
                </li>
              ))}
            </ol>
          )}
        </div>
      </Card>
    </div>
  );
}
