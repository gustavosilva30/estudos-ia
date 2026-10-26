import { calculate } from "@/lib/calculator";
import { categoryLabel, type Formula, type FormulaVar } from "@/lib/formula-engine";
import { guideFor } from "@/lib/formula-guides";
import type { CustomFormulaData } from "@/lib/types";

/** Nomes que o motor de cálculo usa para outra coisa (espelha a lista do servidor). */
export const RESERVED_NAMES = new Set([
  "pi", "e", "i", "ans", "deg", "rad", "true", "false", "Infinity", "NaN", "null", "undefined", "mod", "to",
  "and", "or", "not", "xor", "in", "end",
]);
export const NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_]{0,15}$/;
export const MAX_VARIABLES = 12;
export const MAX_EXPRESSION = 300;

/** Escapa texto livre para uso dentro de `\text{}` / `\texttt{}` do KaTeX. */
export function escapeTex(text: string): string {
  return text.replace(/[\\{}%$&#_^~]/g, (c) => {
    switch (c) {
      case "\\": return "\\textbackslash{}";
      case "^": return "\\textasciicircum{}";
      case "~": return "\\textasciitilde{}";
      default: return `\\${c}`;
    }
  });
}

export interface CustomDraft {
  title: string;
  category: CustomFormulaData["category"];
  latex: string;
  description: string;
  variables: { id: string; name: string; unit: string }[];
  expression: string;
  result_name: string;
  result_label: string;
  result_unit: string;
}

export const EMPTY_DRAFT: CustomDraft = {
  title: "", category: "outra", latex: "", description: "", variables: [{ id: "", name: "", unit: "" }],
  expression: "", result_name: "resultado", result_label: "resultado", result_unit: "",
};

export function draftFromCustom(c: CustomFormulaData): CustomDraft {
  return {
    title: c.title, category: c.category, latex: c.latex ?? "", description: c.description ?? "",
    variables: c.variables.map((v) => ({ id: v.id, name: v.name, unit: v.unit ?? "" })),
    expression: c.expression, result_name: c.result_name, result_label: c.result_label, result_unit: c.result_unit ?? "",
  };
}

/** Corpo enviado ao servidor (campos vazios viram null). */
export function draftToBody(d: CustomDraft) {
  return {
    title: d.title.trim(), category: d.category, latex: d.latex.trim() || null, description: d.description.trim() || null,
    variables: d.variables.map((v) => ({ id: v.id.trim(), name: v.name.trim(), unit: v.unit.trim() || null })),
    expression: d.expression.trim(), result_name: d.result_name.trim(), result_label: d.result_label.trim(),
    result_unit: d.result_unit.trim() || null,
  };
}

/** Confere o rascunho e testa a conta com valores de exemplo. Devolve a mensagem do problema ou null. */
export function validateDraft(d: CustomDraft): string | null {
  if (!d.title.trim()) return "Dê um nome à fórmula.";
  if (!d.expression.trim()) return "Escreva a conta (por exemplo: m*g*h).";
  if (d.expression.trim().length > MAX_EXPRESSION) return `A conta passa de ${MAX_EXPRESSION} caracteres.`;
  const ids = d.variables.map((v) => v.id.trim());
  if (ids.length > MAX_VARIABLES) return `Use no máximo ${MAX_VARIABLES} variáveis.`;
  for (const [i, v] of d.variables.entries()) {
    const id = v.id.trim();
    if (!NAME_PATTERN.test(id) || RESERVED_NAMES.has(id)) {
      return `A variável ${i + 1} tem um nome inválido: use letras, números e _ (começando por letra; não use ${[...RESERVED_NAMES].slice(0, 4).join(", ")}…).`;
    }
    if (!v.name.trim()) return `Dê um nome descritivo à variável "${id}" (por exemplo: massa).`;
  }
  if (new Set(ids).size !== ids.length) return "Há variáveis com o mesmo nome.";
  const result = d.result_name.trim();
  if (!NAME_PATTERN.test(result) || RESERVED_NAMES.has(result)) return "O nome do resultado é inválido: use letras, números e _.";
  if (ids.includes(result)) return "O nome do resultado não pode repetir o de uma variável.";
  if (!d.result_label.trim()) return "Dê um nome ao resultado (por exemplo: energia).";
  const scope = new Map<string, unknown>(ids.map((id) => [id, 2]));
  const test = calculate(d.expression, { angle: "rad", scope });
  if (!test.ok) return `A conta não funciona: ${test.error}`;
  if (typeof test.value !== "number") return "A conta precisa resultar em um número.";
  return null;
}

/** Transforma uma fórmula própria no mesmo formato do catálogo, para usar o mesmo resolvedor. */
export function customToFormula(c: CustomFormulaData): Formula {
  const ids = c.variables.map((v) => v.id);
  const vars: FormulaVar[] = [
    ...c.variables.map((v): FormulaVar => ({
      id: v.id, latex: `\\mathrm{${v.id.replace(/_/g, "\\_")}}`, name: v.name, unit: v.unit ?? undefined, domain: "any",
    })),
    { id: c.result_name, latex: `\\mathrm{${c.result_name.replace(/_/g, "\\_")}}`, name: c.result_label, unit: c.result_unit ?? undefined, domain: "any" },
  ];
  // A conta com cada variável trocada por «nome» (o motor troca pelo valor digitado).
  const identifier = new RegExp(`\\b(${ids.map((id) => id.replace(/[$]/g, "\\$&")).join("|")})\\b`, "g");
  const withPlaceholders = ids.length ? c.expression.replace(identifier, "\u00ab$1\u00bb") : c.expression;
  const unit = c.result_unit ? `\\ \\text{${escapeTex(c.result_unit)}}` : "";
  const name = `\\mathrm{${c.result_name.replace(/_/g, "\\_")}}`;
  return {
    id: c.id,
    title: c.title,
    category: c.category,
    topic: c.category === "outra" ? "Fórmulas próprias" : `Fórmulas próprias · ${categoryLabel(c.category)}`,
    latex: c.latex?.trim() || `${name} = \\texttt{${escapeTex(c.expression)}}`,
    summary: c.description?.trim() || "Fórmula criada por você.",
    vars,
    solvers: [{
      label: `${c.result_label} (${c.result_name})`,
      needs: ids,
      compute: { [c.result_name]: c.expression },
      lines: [
        `${name} = \\texttt{${escapeTex(c.expression)}}`,
        `${name} = \\texttt{${escapeTex(withPlaceholders)}}`,
        `${name} = \u00ab=${c.result_name}\u00bb${unit}`,
      ],
      answers: [c.result_name],
    }],
    custom: true,
  };
}

const LATEX_BLOCK = (latex: string) => `$$${latex.replace(/\$/g, "")}$$`;

/** Texto da fórmula para salvar na aula: a IA então pode resumir, criar exercícios e flashcards sobre ela. */
export function formulaAsText(formula: Formula, note?: string | null): string {
  const area = categoryLabel(formula.category);
  const lines = [
    `Fórmula: ${formula.title}`,
    `Área: ${area} · ${formula.topic}`,
    "",
    "Equação:",
    LATEX_BLOCK(formula.latex),
    "",
    "Significado:",
    formula.summary,
    "",
    "Variáveis:",
    ...formula.vars.map((v) => `- ${v.name}${v.unit ? ` (${v.unit})` : ""}: $${v.latex}$`),
  ];
  if (formula.example) {
    const solver = formula.solvers[formula.example.solver];
    const values = Object.entries(formula.example.values).map(([id, value]) => {
      const variable = formula.vars.find((x) => x.id === id);
      return `${variable?.name ?? id} = ${value}`;
    });
    lines.push("", `Exemplo (${solver.label}): ${values.join("; ")}.`);
  }
  const guide = guideFor(formula);
  if (guide) {
    lines.push("", "Como funciona:", guide.how, "", "Quando usar:", guide.when);
    lines.push("", "Macetes e facilitadores:", ...guide.tips.map((t) => `- ${t}`));
    lines.push("", "Cuidados e erros comuns:", ...guide.watch.map((t) => `- ${t}`));
    if (guide.remember) lines.push("", `Para memorizar: ${guide.remember}`);
  }
  if (note?.trim()) lines.push("", `Minha anotação: ${note.trim()}`);
  return lines.join("\n");
}
