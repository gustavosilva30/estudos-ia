import { calculate } from "@/lib/calculator";

export type Category = "matematica" | "fisica" | "quimica" | "outra";

/** Áreas do catálogo (usadas nos filtros). Fórmulas próprias podem ainda ter a área "outra". */
export const CATEGORIES: { id: Category; label: string }[] = [
  { id: "matematica", label: "Matemática" },
  { id: "fisica", label: "Física" },
  { id: "quimica", label: "Química" },
];

export function categoryLabel(category: Category): string {
  return CATEGORIES.find((c) => c.id === category)?.label ?? "Outra";
}

/** Restrição dos valores que a pessoa digita. */
export type Domain = "any" | "pos" | "nonneg" | "nonnegint";

export interface FormulaVar {
  id: string; // nome usado nas contas (sem espaços; evite e, i e pi, que são constantes)
  latex: string; // como aparece desenhado
  name: string;
  unit?: string;
  domain?: Domain;
  /** Valor sugerido (constantes como g = 9,8). */
  default?: string;
}

export type Line = string | { if: string; latex: string };

export interface Solver {
  /** Texto do botão, por exemplo "Hipotenusa (c)". */
  label: string;
  /** Variáveis que a pessoa precisa informar. */
  needs: string[];
  /** Contas, em ordem: nome → expressão. Cada uma pode usar as entradas e as anteriores. */
  compute: Record<string, string>;
  /** Passos mostrados. `«x»` vira o valor de x (negativo entre parênteses); `«=x»` vira o valor puro. */
  lines: Line[];
  /** Condições que impedem a conta (verdadeiras = erro). Avaliadas antes das contas. */
  checks?: { when: string; message: string }[];
  /** Nomes calculados que formam a resposta final, para conferência nos testes e destaque na tela. */
  answers: string[];
}

export interface Formula {
  id: string;
  title: string;
  category: Category;
  topic: string;
  latex: string;
  summary: string;
  vars: FormulaVar[];
  solvers: Solver[];
  /** Exemplo verificado pelos testes (só o catálogo tem; fórmulas próprias não). */
  example?: { solver: number; values: Record<string, string>; expect: Record<string, number> };
  /** Fórmula criada pela pessoa (guardada no servidor). */
  custom?: boolean;
}

/** Chave que identifica a fórmula no servidor: `b:<id>` (catálogo) ou `c:<uuid>` (própria). */
export function formulaKey(formula: Pick<Formula, "id" | "custom">): string {
  return `${formula.custom ? "c" : "b"}:${formula.id}`;
}

export type Outcome =
  | { status: "incomplete"; missing: string[] }
  | { status: "error"; message: string }
  | { status: "ok"; lines: string[]; values: Record<string, number | boolean> };

const OPEN = "«";
const CLOSE = "»";

/** Número para LaTeX: 6 algarismos significativos; potência de dez só para valores extremos. */
export function texNumber(value: number): string {
  if (!Number.isFinite(value)) return "\\infty";
  if (value === 0) return "0";
  const abs = Math.abs(value);
  if (abs >= 1e9 || abs < 1e-4) {
    const [mantissa, exponent] = value.toExponential(5).split("e");
    return `${Number(mantissa)} \\times 10^{${Number(exponent)}}`;
  }
  return String(Number(value.toPrecision(6)));
}

function fill(template: string, scope: Map<string, unknown>): string {
  return template.replace(new RegExp(`${OPEN}(=?)([A-Za-z_]\\w*)${CLOSE}`, "g"), (_, plain: string, name: string) => {
    const value = scope.get(name);
    if (typeof value !== "number") return name;
    const text = texNumber(value);
    return !plain && value < 0 ? `(${text})` : text;
  });
}

function parseInput(raw: string): number {
  const text = raw.trim().replace(",", ".");
  return text === "" ? Number.NaN : Number(text);
}

/** Resolve uma fórmula passo a passo. Nunca lança: problemas viram `incomplete` ou `error`. */
export function solveFormula(formula: Formula, solver: Solver, raw: Record<string, string>): Outcome {
  const byId = new Map(formula.vars.map((v) => [v.id, v]));
  const missing = solver.needs.filter((id) => (raw[id] ?? "").trim() === "");
  if (missing.length) return { status: "incomplete", missing };

  const scope = new Map<string, unknown>();
  for (const id of solver.needs) {
    const v = byId.get(id)!;
    const n = parseInput(raw[id]);
    if (!Number.isFinite(n)) return { status: "error", message: `"${v.name}" não é um número válido.` };
    if (v.domain === "pos" && !(n > 0)) return { status: "error", message: `"${v.name}" deve ser maior que zero.` };
    if (v.domain === "nonneg" && n < 0) return { status: "error", message: `"${v.name}" não pode ser negativo.` };
    if (v.domain === "nonnegint" && !(Number.isInteger(n) && n >= 0)) {
      return { status: "error", message: `"${v.name}" deve ser um número inteiro maior ou igual a zero.` };
    }
    scope.set(id, n);
  }

  const evaluate = (expression: string) => calculate(expression, { angle: "rad", scope: new Map(scope) });
  for (const check of solver.checks ?? []) {
    const r = evaluate(check.when);
    if (r.ok && r.value === true) return { status: "error", message: check.message };
  }
  const values: Record<string, number | boolean> = {};
  for (const [name, expression] of Object.entries(solver.compute)) {
    const r = evaluate(expression);
    if (!r.ok) return { status: "error", message: "Não foi possível calcular com estes valores." };
    if (typeof r.value === "number" && !Number.isFinite(r.value)) return { status: "error", message: "Não foi possível calcular com estes valores." };
    if (typeof r.value !== "number" && typeof r.value !== "boolean") return { status: "error", message: "O resultado não é um número real." };
    scope.set(name, r.value);
    values[name] = r.value;
  }

  const lines: string[] = [];
  for (const line of solver.lines) {
    if (typeof line === "string") lines.push(fill(line, scope));
    else {
      const shown = evaluate(line.if);
      if (shown.ok && shown.value === true) lines.push(fill(line.latex, scope));
    }
  }
  return { status: "ok", lines, values };
}

/** Fórmulas cujo título, tópico ou descrição contêm todas as palavras buscadas (sem acento/maiúsculas). */
export function normalizeText(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function searchFormulas(formulas: Formula[], query: string, category: Category | "todas"): Formula[] {
  const words = normalizeText(query).split(/\s+/).filter(Boolean);
  return formulas.filter((f) => {
    if (category !== "todas" && f.category !== category) return false;
    const haystack = normalizeText(`${f.title} ${f.topic} ${f.summary} ${f.vars.map((v) => v.name).join(" ")}`);
    return words.every((w) => haystack.includes(w));
  });
}
