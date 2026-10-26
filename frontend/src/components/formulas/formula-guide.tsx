"use client";

import { Fragment } from "react";
import { Tex } from "@/components/formulas/tex";
import { Card } from "@/components/ui/primitives";
import { categoryLabel, CATEGORIES, formulaKey, solveFormula, type Category, type Formula } from "@/lib/formula-engine";
import { GENERAL_METHOD, guideFor, stepsFor } from "@/lib/formula-guides";
import { FORMULAS } from "@/lib/formulas";

/** Texto com matemática entre `$...$` (renderizada com KaTeX). */
export function RichText({ children }: { children: string }) {
  const parts = children.split(/\$([^$]+)\$/);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? <Tex key={i}>{part}</Tex> : <Fragment key={i}>{part}</Fragment>,
      )}
    </>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5 text-sm">
      {items.map((item, i) => (
        <li key={i}>
          <RichText>{item}</RichText>
        </li>
      ))}
    </ul>
  );
}

function Section({ title, tone, children }: { title: string; tone?: "warn" | "tip"; children: React.ReactNode }) {
  return (
    <section
      className={
        tone === "tip" ? "rounded-lg bg-primary-soft p-3" : tone === "warn" ? "rounded-lg border border-line bg-surface-2 p-3" : ""
      }
    >
      <h4 className="mb-1.5 text-sm font-semibold">{title}</h4>
      {children}
    </section>
  );
}

/** Exemplo resolvido: mostra os dados e a solução passo a passo do exemplo do catálogo. */
function WorkedExample({ formula }: { formula: Formula }) {
  const example = formula.example;
  if (!example) return null;
  const solver = formula.solvers[example.solver];
  const outcome = solveFormula(formula, solver, example.values);
  if (outcome.status !== "ok") return null;
  const data = Object.entries(example.values).map(([id, value]) => {
    const variable = formula.vars.find((v) => v.id === id);
    return `${variable?.name ?? id} = ${value}${variable?.unit ? ` ${variable.unit}` : ""}`;
  });
  return (
    <Section title={`Exemplo resolvido: ${solver.label}`}>
      <p className="mb-2 text-sm text-muted">Dados: {data.join("; ")}.</p>
      <ol className="space-y-1 rounded-lg bg-surface-2 p-3" aria-label="Exemplo resolvido">
        {outcome.lines.map((line, i) => (
          <li key={i} className="overflow-x-auto">
            <Tex display>{line}</Tex>
          </li>
        ))}
      </ol>
    </Section>
  );
}

/** Explicação da fórmula: como funciona, quando usar, macetes, cuidados, exemplo e fórmulas relacionadas. */
export function GuideCard({ formula, onOpen }: { formula: Formula; onOpen: (key: string) => void }) {
  const guide = guideFor(formula);
  if (!guide) return null;
  const related = (guide.related ?? []).map((id) => FORMULAS.find((f) => f.id === id)).filter((f): f is Formula => f !== undefined);
  return (
    <Card className="space-y-4" aria-label="Entenda a fórmula">
      <h3 className="font-semibold">Entenda a fórmula</h3>
      <Section title="Como funciona">
        <p className="text-sm leading-relaxed">
          <RichText>{guide.how}</RichText>
        </p>
      </Section>
      <Section title="Quando usar">
        <p className="text-sm">
          <RichText>{guide.when}</RichText>
        </p>
      </Section>
      <Section title="Macetes e facilitadores" tone="tip">
        <BulletList items={guide.tips} />
      </Section>
      <Section title="Cuidados, regras e erros comuns" tone="warn">
        <BulletList items={guide.watch} />
      </Section>
      {guide.remember && (
        <Section title="Para memorizar">
          <p className="text-sm font-medium">
            <RichText>{guide.remember}</RichText>
          </p>
        </Section>
      )}
      <WorkedExample formula={formula} />
      {related.length > 0 && (
        <Section title="Estude também">
          <div className="flex flex-wrap gap-1.5">
            {related.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => onOpen(formulaKey(f))}
                className="min-h-8 rounded-full border border-line px-3 text-xs font-medium hover:bg-surface-2"
              >
                {f.title}
              </button>
            ))}
          </div>
        </Section>
      )}
    </Card>
  );
}

/** Roteiro de resolução para o item escolhido (específico, quando o guia o traz; senão, geral). */
export function SolveSteps({ formula, solverIndex }: { formula: Formula; solverIndex: number }) {
  const { steps, custom } = stepsFor(formula, solverIndex);
  return (
    <details open={custom} className="rounded-lg border border-line p-3">
      <summary className="cursor-pointer text-sm font-semibold">
        Como resolver: {formula.solvers[solverIndex].label}
        {!custom && <span className="ml-2 text-xs font-normal text-muted">(roteiro geral)</span>}
      </summary>
      <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm">
        {steps.map((step, i) => (
          <li key={i}>
            <RichText>{step}</RichText>
          </li>
        ))}
      </ol>
    </details>
  );
}

/** Método geral por área, mostrado quando nenhuma fórmula está aberta. */
export function GeneralMethodCard({ category }: { category: Category | "todas" | "favoritas" | "minhas" }) {
  const area = category === "fisica" || category === "quimica" ? category : "matematica";
  const method = GENERAL_METHOD[area];
  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">{method.title}</h3>
        <span className="text-xs text-muted">Escolha uma fórmula na lista para ver a explicação completa ({categoryLabel(area)}).</span>
      </div>
      <ol className="list-decimal space-y-1.5 pl-5 text-sm">
        {method.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <Section title="Dicas gerais" tone="tip">
        <BulletList items={method.tips} />
      </Section>
      <p className="text-xs text-muted">
        Áreas: {CATEGORIES.map((c) => c.label).join(", ")}. Use os filtros da lista para ver o método de cada uma.
      </p>
    </Card>
  );
}
