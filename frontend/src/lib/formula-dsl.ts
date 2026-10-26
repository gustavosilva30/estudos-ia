import type { Category, Domain, Formula, FormulaVar, Line, Solver } from "@/lib/formula-engine";

/**
 * Auxiliares para escrever o catálogo de fórmulas de forma compacta.
 *
 * Convenções: `«x»` nos passos vira o valor de x (negativo entre parênteses) e `«=x»` o valor puro. Ângulos
 * são digitados em graus e convertidos nas contas. Taxas em % são digitadas em % (10 = 10%).
 */

/** Texto LaTeX sem processar as barras invertidas. */
export const tex = String.raw;

export const v = (
  id: string, latex: string, name: string, unit?: string, domain: Domain = "any", def?: string,
): FormulaVar => ({ id, latex, name, unit, domain, default: def });

export function solver(
  label: string, needs: string[], compute: Record<string, string>, lines: Line[], answers: string[],
  checks?: Solver["checks"],
): Solver {
  return { label, needs, compute, lines, answers, checks };
}

export interface Spec {
  id: string;
  title: string;
  category: Category;
  topic: string;
  latex: string;
  summary: string;
  vars: FormulaVar[];
  solvers: Solver[];
  example: NonNullable<Formula["example"]>;
}

export const f = (spec: Spec): Formula => spec;
