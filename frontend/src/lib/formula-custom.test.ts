import katex from "katex";
import { describe, expect, it } from "vitest";
import {
  customToFormula, draftFromCustom, draftToBody, EMPTY_DRAFT, escapeTex, formulaAsText, validateDraft, type CustomDraft,
} from "./formula-custom";
import { formulaKey, solveFormula } from "./formula-engine";
import { formulaById } from "./formulas";
import type { CustomFormulaData } from "./types";

const render = (latex: string) => katex.renderToString(latex, { throwOnError: true, strict: "ignore", trust: false });

const CUSTOM: CustomFormulaData = {
  id: "11111111-1111-1111-1111-111111111111", title: "Energia elástica", category: "fisica", latex: null, description: null,
  variables: [{ id: "k", name: "constante da mola", unit: "N/m" }, { id: "x", name: "deformação", unit: "m" }],
  expression: "k*x^2/2", result_name: "Ee", result_label: "energia", result_unit: "J",
  created_at: "2026-10-26T00:00:00Z", updated_at: "2026-10-26T00:00:00Z",
};

function draft(over: Partial<CustomDraft> = {}): CustomDraft {
  return { ...draftFromCustom(CUSTOM), ...over };
}

describe("escapeTex", () => {
  it("escapa caracteres especiais do LaTeX", () => {
    expect(escapeTex("a_b")).toBe("a\\_b");
    expect(escapeTex("50%")).toBe("50\\%");
    expect(escapeTex("x^2")).toBe("x\\textasciicircum{}2");
    expect(escapeTex("{a}&#$")).toBe("\\{a\\}\\&\\#\\$");
    expect(escapeTex("\\frac")).toBe("\\textbackslash{}frac");
    for (const text of ["a_b", "50%", "x^2", "{a}", "~", "\\x", "R$ 5 & 6 #1"]) expect(() => render(`\\texttt{${escapeTex(text)}}`), text).not.toThrow();
  });
});

describe("validateDraft", () => {
  it("aceita um rascunho completo e correto", () => {
    expect(validateDraft(draft())).toBeNull();
  });

  it("recusa o que está incompleto ou errado, com mensagem clara", () => {
    expect(validateDraft(EMPTY_DRAFT)).toBe("Dê um nome à fórmula.");
    expect(validateDraft(draft({ expression: "  " }))).toContain("Escreva a conta");
    expect(validateDraft(draft({ expression: "x".repeat(301) }))).toContain("300");
    expect(validateDraft(draft({ variables: [{ id: "1a", name: "x", unit: "" }] }))).toContain("nome inválido");
    expect(validateDraft(draft({ variables: [{ id: "pi", name: "x", unit: "" }] }))).toContain("nome inválido");
    expect(validateDraft(draft({ variables: [{ id: "a b", name: "x", unit: "" }] }))).toContain("nome inválido");
    expect(validateDraft(draft({ variables: [{ id: "k", name: "", unit: "" }] }))).toContain("nome descritivo");
    expect(validateDraft(draft({ variables: [{ id: "k", name: "a", unit: "" }, { id: "k", name: "b", unit: "" }] }))).toBe("Há variáveis com o mesmo nome.");
    expect(validateDraft(draft({ variables: Array.from({ length: 13 }, (_, i) => ({ id: `v${i}`, name: "n", unit: "" })) }))).toContain("no máximo 12");
    expect(validateDraft(draft({ result_name: "k" }))).toContain("não pode repetir");
    expect(validateDraft(draft({ result_name: "e" }))).toContain("inválido");
    expect(validateDraft(draft({ result_label: " " }))).toContain("nome ao resultado");
  });

  it("testa a conta de verdade", () => {
    expect(validateDraft(draft({ expression: "k*y" }))).toBe('A conta não funciona: "y" não existe.');
    expect(validateDraft(draft({ expression: "k +" }))).toContain("A conta não funciona");
    expect(validateDraft(draft({ expression: "import(1)" }))).toContain("A conta não funciona");
    expect(validateDraft(draft({ expression: "[k, x]" }))).toBe("A conta precisa resultar em um número.");
  });
});

describe("customToFormula", () => {
  const formula = customToFormula(CUSTOM);

  it("vira uma fórmula do mesmo formato do catálogo", () => {
    expect(formula.custom).toBe(true);
    expect(formulaKey(formula)).toBe(`c:${CUSTOM.id}`);
    expect(formulaKey({ id: "ohm" })).toBe("b:ohm");
    expect(formula.example).toBeUndefined();
    expect(formula.vars.map((v) => v.id)).toEqual(["k", "x", "Ee"]);
    expect(formula.solvers).toHaveLength(1);
    expect(() => render(formula.latex)).not.toThrow();
  });

  it("resolve com passos que desenham em LaTeX", () => {
    const outcome = solveFormula(formula, formula.solvers[0], { k: "100", x: "0.2" });
    expect(outcome.status).toBe("ok");
    if (outcome.status !== "ok") return;
    expect(outcome.values.Ee).toBeCloseTo(2);
    expect(outcome.lines).toHaveLength(3);
    expect(outcome.lines[1]).toContain("100*0.2\\textasciicircum{}2/2"); // conta com os valores no lugar das variáveis
    expect(outcome.lines[2]).toContain("= 2\\ \\text{J}");
    for (const line of outcome.lines) expect(() => render(line), line).not.toThrow();
  });

  it("valores negativos entram entre parênteses e campos vazios pedem preenchimento", () => {
    const outcome = solveFormula(formula, formula.solvers[0], { k: "100", x: "-3" });
    expect(outcome.status === "ok" && outcome.lines[1]).toContain("(-3)");
    expect(solveFormula(formula, formula.solvers[0], { k: "100", x: "" })).toEqual({ status: "incomplete", missing: ["x"] });
  });

  it("usa o LaTeX informado e a descrição, quando existirem", () => {
    const f = customToFormula({ ...CUSTOM, latex: "E = \\tfrac{1}{2}kx^2", description: "Energia de uma mola." });
    expect(f.latex).toBe("E = \\tfrac{1}{2}kx^2");
    expect(f.summary).toBe("Energia de uma mola.");
    expect(customToFormula({ ...CUSTOM, category: "outra" }).topic).toBe("Fórmulas próprias");
  });

  it("variáveis com _ e expressões com caracteres especiais continuam desenhando", () => {
    const f = customToFormula({ ...CUSTOM, variables: [{ id: "m_1", name: "massa", unit: null }], expression: "m_1*2", result_name: "m_total", result_unit: "kg%" });
    const outcome = solveFormula(f, f.solvers[0], { m_1: "4" });
    expect(outcome.status === "ok" && outcome.values.m_total).toBe(8);
    if (outcome.status === "ok") for (const line of outcome.lines) expect(() => render(line), line).not.toThrow();
  });
});

describe("rascunho ↔ servidor", () => {
  it("ida e volta, com campos vazios virando null", () => {
    expect(draftToBody(draftFromCustom(CUSTOM))).toMatchObject({
      title: "Energia elástica", latex: null, description: null, expression: "k*x^2/2", result_name: "Ee",
      variables: [{ id: "k", name: "constante da mola", unit: "N/m" }, { id: "x", name: "deformação", unit: "m" }],
    });
    expect(draftToBody({ ...EMPTY_DRAFT, title: "  A  ", variables: [{ id: " m ", name: " massa ", unit: " " }] }).variables).toEqual([{ id: "m", name: "massa", unit: null }]);
  });
});

describe("formulaAsText", () => {
  it("resume a fórmula para a IA estudar (equação, variáveis, exemplo e anotação)", () => {
    const text = formulaAsText(formulaById("pitagoras")!, "  só em triângulo retângulo ");
    expect(text).toContain("Fórmula: Teorema de Pitágoras");
    expect(text).toContain("Área: Matemática · Geometria plana");
    expect(text).toContain("$$a^2 + b^2 = c^2$$");
    expect(text).toContain("- cateto a: $a$");
    expect(text).toContain("Exemplo (Hipotenusa (c)): cateto a = 3; cateto b = 4.");
    expect(text).toContain("Minha anotação: só em triângulo retângulo");
  });

  it("não quebra para fórmulas próprias (sem exemplo) nem sem anotação", () => {
    const text = formulaAsText(customToFormula(CUSTOM));
    expect(text).toContain("Fórmula: Energia elástica");
    expect(text).not.toContain("Exemplo");
    expect(text).not.toContain("anotação");
    expect(text).toContain("(N/m)");
  });
});
