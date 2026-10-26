import katex from "katex";
import { describe, expect, it } from "vitest";
import { CATEGORIES, searchFormulas, solveFormula, texNumber, type Formula } from "./formula-engine";
import { FORMULAS, formulaById } from "./formulas";

const render = (latex: string) => katex.renderToString(latex, { throwOnError: true, strict: "ignore", trust: false });

function run(formula: Formula, solverIndex: number, values: Record<string, string>) {
  return solveFormula(formula, formula.solvers[solverIndex], values);
}
function ok(formula: Formula, solverIndex: number, values: Record<string, string>) {
  const r = run(formula, solverIndex, values);
  if (r.status !== "ok") throw new Error(`${formula.id}: ${JSON.stringify(r)}`);
  return r;
}

describe("catálogo", () => {
  it("tem fórmulas das três áreas e ids únicos", () => {
    expect(new Set(FORMULAS.map((f) => f.id)).size).toBe(FORMULAS.length);
    for (const c of CATEGORIES) expect(FORMULAS.some((f) => f.category === c.id), c.id).toBe(true);
    expect(new Set(FORMULAS.map((f) => f.title)).size).toBe(FORMULAS.length);
    expect(FORMULAS.length).toBeGreaterThanOrEqual(100);
    for (const name of ["pitagoras", "bhaskara", "juros-compostos", "newton-2", "ohm", "mol"]) expect(formulaById(name)).toBeDefined();
  });

  it.each(FORMULAS.map((f) => [f.id, f] as const))("%s: estrutura consistente", (_id, formula) => {
    const ids = new Set(formula.vars.map((v) => v.id));
    expect(ids.size).toBe(formula.vars.length);
    expect(formula.title && formula.summary && formula.topic).toBeTruthy();
    expect(() => render(formula.latex)).not.toThrow();
    for (const v of formula.vars) expect(() => render(v.latex), `${formula.id}.${v.id}`).not.toThrow();
    for (const solver of formula.solvers) {
      for (const need of solver.needs) expect(ids.has(need), `${formula.id}: "${need}" não é variável`).toBe(true);
      const names = new Set([...solver.needs, ...Object.keys(solver.compute)]);
      for (const answer of solver.answers) expect(names.has(answer), `${formula.id}: resposta ${answer}`).toBe(true);
      for (const line of solver.lines) {
        const template = typeof line === "string" ? line : line.latex;
        for (const match of template.matchAll(/«=?([A-Za-z_]\w*)»/g)) {
          expect(names.has(match[1]), `${formula.id}: «${match[1]}» desconhecido em "${solver.label}"`).toBe(true);
        }
      }
    }
    expect(formula.example!.solver).toBeLessThan(formula.solvers.length);
  });

  it.each(FORMULAS.map((f) => [f.id, f] as const))("%s: o exemplo resolve ao resultado esperado e desenha em LaTeX", (_id, formula) => {
    const example = formula.example!;
    const result = ok(formula, example.solver, example.values);
    for (const [name, expected] of Object.entries(example.expect)) {
      const actual = result.values[name] as number;
      // Tolerância relativa: vale para valores muito pequenos (10⁻¹⁹) e muito grandes.
      expect(Math.abs(actual - expected) / Math.max(Math.abs(expected), 1e-300), `${formula.id}.${name}: ${actual} ≠ ${expected}`).toBeLessThan(1e-9);
    }
    expect(result.lines.length).toBeGreaterThan(0);
    for (const line of result.lines) expect(() => render(line), line).not.toThrow();
  });
});

describe("resolvedor", () => {
  const pit = formulaById("pitagoras")!;

  it("mostra os passos com os valores substituídos", () => {
    const r = ok(pit, 0, { a: "3", b: "4" });
    expect(r.lines).toEqual(["c = \\sqrt{a^2 + b^2}", "c = \\sqrt{3^2 + 4^2}", "c = \\sqrt{25} = 5"]);
  });

  it("resolve cada incógnita do teorema de Pitágoras", () => {
    expect(ok(pit, 1, { b: "12", c: "13" }).values.a).toBeCloseTo(5);
    expect(ok(pit, 2, { a: "6", c: "10" }).values.b).toBeCloseTo(8);
  });

  it("aceita vírgula decimal", () => {
    expect(ok(pit, 0, { a: "1,5", b: "2" }).values.c).toBeCloseTo(2.5);
  });

  it("avisa o que falta e valores inválidos", () => {
    expect(run(pit, 0, { a: "3", b: "" })).toEqual({ status: "incomplete", missing: ["b"] });
    expect(run(pit, 0, { a: "3", b: "abc" })).toMatchObject({ status: "error", message: expect.stringContaining("não é um número válido") });
    expect(run(pit, 0, { a: "-3", b: "4" })).toMatchObject({ status: "error", message: expect.stringContaining("maior que zero") });
    expect(run(pit, 0, { a: "Infinity", b: "4" })).toMatchObject({ status: "error" });
  });

  it("aplica as condições de cada conta", () => {
    expect(run(pit, 1, { b: "12", c: "5" })).toMatchObject({ status: "error", message: "A hipotenusa precisa ser maior que o cateto." });
    expect(run(formulaById("regra-de-tres")!, 0, { a: "0", b: "1", c: "2" })).toMatchObject({ status: "error" });
    expect(run(formulaById("combinatoria")!, 0, { n: "3", p: "5" })).toMatchObject({ status: "error", message: "p não pode ser maior que n." });
    expect(run(formulaById("combinatoria")!, 0, { n: "2.5", p: "1" })).toMatchObject({ status: "error" });
    expect(run(formulaById("energia-cinetica")!, 1, { Ec: "-4", m: "2" })).toMatchObject({ status: "error" });
  });

  it("Bhaskara: duas raízes, uma raiz e nenhuma raiz real", () => {
    const b = formulaById("bhaskara")!;
    const two = ok(b, 0, { a: "1", b: "-3", c: "-4" });
    expect(two.lines).toContain("x_1 = 4 \\qquad x_2 = -1");
    expect(two.lines).toContain("\\Delta = (-3)^2 - 4\\cdot1\\cdot(-4) = 25");
    const one = ok(b, 0, { a: "1", b: "-2", c: "1" });
    expect(one.values).toMatchObject({ delta: 0, x1: 1 });
    expect(one.lines.some((l) => l.startsWith("x = \\dfrac{-b}{2a}"))).toBe(true);
    const none = ok(b, 0, { a: "1", b: "0", c: "1" });
    expect(none.lines.some((l) => l.includes("não tem raízes reais"))).toBe(true);
    expect(none.lines.some((l) => l.startsWith("x_1"))).toBe(false);
    expect(run(b, 0, { a: "0", b: "2", c: "1" })).toMatchObject({ status: "error" });
  });

  it("raízes não inteiras e coeficientes negativos", () => {
    const r = ok(formulaById("bhaskara")!, 0, { a: "2", b: "3", c: "-1" });
    expect(r.values.x1).toBeCloseTo(0.280776, 5);
    expect(r.values.x2).toBeCloseTo(-1.780776, 5);
  });

  it("converte ângulos em graus e taxas em %", () => {
    expect(ok(formulaById("trig-retangulo")!, 0, { h: "10", th: "30" }).values.co).toBeCloseTo(5);
    expect(ok(formulaById("trig-retangulo")!, 1, { h: "10", th: "60" }).values.ca).toBeCloseTo(5);
    expect(ok(formulaById("trig-retangulo")!, 2, { ca: "10", th: "45" }).values.co).toBeCloseTo(10);
    const jc = formulaById("juros-compostos")!;
    expect(ok(jc, 1, { M: "1210", i: "10", t: "2" }).values.C).toBeCloseTo(1000);
    expect(ok(jc, 2, { M: "1210", C: "1000", i: "10" }).values.t).toBeCloseTo(2);
    expect(ok(jc, 3, { M: "1210", C: "1000", t: "2" }).values.i).toBeCloseTo(10);
  });

  it("outras fórmulas: gases, pH, porcentagem e física", () => {
    expect(ok(formulaById("gases-ideais")!, 1, { n: "2", R: "0.082", T: "300", P: "2" }).values.V).toBeCloseTo(24.6);
    expect(ok(formulaById("ph")!, 1, { pH: "3" }).values.H).toBeCloseTo(0.001);
    expect(ok(formulaById("porcentagem")!, 1, { parte: "30", total: "200" }).values.p).toBeCloseTo(15);
    expect(ok(formulaById("porcentagem")!, 2, { parte: "30", p: "15" }).values.total).toBeCloseTo(200);
    expect(ok(formulaById("torricelli")!, 1, { v: "6", v0: "0", a: "2" }).values.ds).toBeCloseTo(9);
    expect(ok(formulaById("queda-livre")!, 1, { g: "10", h: "20" }).values.t).toBeCloseTo(2);
    expect(ok(formulaById("pa")!, 1, { a1: "2", an: "29", n: "10" }).values.Sn).toBe(155);
    expect(ok(formulaById("pg")!, 0, { a1: "2", q: "3", n: "5" }).values.an).toBe(162);
  });
});

describe("formatação", () => {
  it("usa 6 algarismos significativos e potência de dez para extremos", () => {
    expect(texNumber(1 / 3)).toBe("0.333333");
    expect(texNumber(5)).toBe("5");
    expect(texNumber(0)).toBe("0");
    expect(texNumber(1234567890)).toBe("1.23457 \\times 10^{9}");
    expect(texNumber(0.00001234)).toBe("1.234 \\times 10^{-5}");
    expect(texNumber(-2.5)).toBe("-2.5");
  });
});

describe("busca", () => {
  it("ignora acentos e maiúsculas e combina palavras", () => {
    expect(searchFormulas(FORMULAS, "PITAGORAS", "todas").map((f) => f.id)).toContain("pitagoras");
    expect(searchFormulas(FORMULAS, "pitagoras hipotenusa", "todas").map((f) => f.id)).toContain("pitagoras");
    expect(searchFormulas(FORMULAS, "pitagoras juros", "todas")).toEqual([]);
    expect(searchFormulas(FORMULAS, "juros", "todas").map((f) => f.id)).toEqual(expect.arrayContaining(["juros-simples", "juros-compostos"]));
    expect(searchFormulas(FORMULAS, "", "fisica").every((f) => f.category === "fisica")).toBe(true);
    expect(searchFormulas(FORMULAS, "juros", "fisica")).toEqual([]);
  });

  it("encontra pelo nome de uma variável", () => {
    expect(searchFormulas(FORMULAS, "hipotenusa", "todas").map((f) => f.id)).toContain("pitagoras");
  });
});
