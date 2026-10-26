import katex from "katex";
import { describe, expect, it } from "vitest";
import { GENERAL_METHOD, GUIDES, genericSteps, guideFor, stepsFor, type Guide } from "./formula-guides";
import { FORMULAS, formulaById } from "./formulas";

const render = (latex: string) => katex.renderToString(latex, { throwOnError: true, strict: "ignore", trust: false });

/** Todos os textos de um guia (para verificar a matemática em `$...$`). */
function texts(guide: Guide): string[] {
  return [guide.how, guide.when, ...guide.tips, ...guide.watch, guide.remember ?? "", ...Object.values(guide.solve ?? {}).flat()];
}

describe("guias didáticos", () => {
  it("toda fórmula do catálogo tem guia e não há guias órfãos", () => {
    const ids = new Set(FORMULAS.map((f) => f.id));
    expect(FORMULAS.filter((f) => !GUIDES[f.id]).map((f) => f.id)).toEqual([]);
    expect(Object.keys(GUIDES).filter((id) => !ids.has(id))).toEqual([]);
    expect(Object.keys(GUIDES)).toHaveLength(FORMULAS.length);
  });

  it.each(FORMULAS.map((f) => [f.id, f] as const))("%s: conteúdo completo e consistente", (_id, formula) => {
    const guide = GUIDES[formula.id];
    expect(guide.how.length, "como funciona").toBeGreaterThan(60);
    expect(guide.when.length, "quando usar").toBeGreaterThan(20);
    expect(guide.tips.length, "macetes").toBeGreaterThanOrEqual(2);
    expect(guide.watch.length, "cuidados").toBeGreaterThanOrEqual(1);
    for (const text of [...guide.tips, ...guide.watch]) expect(text.trim().length).toBeGreaterThan(10);
    for (const [index, steps] of Object.entries(guide.solve ?? {})) {
      expect(Number(index), "índice do solver").toBeLessThan(formula.solvers.length);
      expect(steps.length, `passos do solver ${index}`).toBeGreaterThanOrEqual(1);
    }
    for (const id of guide.related ?? []) {
      expect(FORMULAS.some((f) => f.id === id), `relacionada "${id}" não existe`).toBe(true);
      expect(id).not.toBe(formula.id);
    }
    expect(new Set(guide.related ?? []).size).toBe((guide.related ?? []).length);
  });

  it("toda matemática entre $...$ desenha em KaTeX e os cifrões fecham", () => {
    const problems: string[] = [];
    for (const [id, guide] of Object.entries(GUIDES)) {
      for (const text of texts(guide)) {
        if ((text.match(/\$/g) ?? []).length % 2 !== 0) problems.push(`${id}: cifrão sem par em "${text.slice(0, 60)}"`);
        text.split(/\$([^$]+)\$/).forEach((part, i) => {
          if (i % 2 === 1) {
            try {
              render(part);
            } catch {
              problems.push(`${id}: LaTeX inválido "${part}"`);
            }
          }
        });
      }
    }
    expect(problems).toEqual([]);
  });

  it("não deixa marcas de rascunho nem texto duplicado entre dicas", () => {
    for (const [id, guide] of Object.entries(GUIDES)) {
      for (const text of texts(guide)) expect(text, id).not.toMatch(/TODO|lorem|XXX|\?\?\?|undefined/);
      expect(new Set(guide.tips).size, `${id}: dicas repetidas`).toBe(guide.tips.length);
    }
  });
});

describe("passos de resolução", () => {
  it("usa os passos específicos quando existem", () => {
    const pit = formulaById("pitagoras")!;
    const { steps, custom } = stepsFor(pit, 1);
    expect(custom).toBe(true);
    expect(steps.length).toBeGreaterThanOrEqual(3);
    expect(steps.join(" ")).toContain("subtração");
  });

  it("roteiros curtos ganham dados no início e conferência no fim", () => {
    const { steps, custom } = stepsFor(formulaById("ondas")!, 1);
    expect(custom).toBe(true);
    expect(steps[0]).toContain("Anote os dados: período");
    expect(steps.at(-1)).toContain("Confira o resultado");
    expect(steps.length).toBe(3);
  });

  it("monta um roteiro geral com os dados do item quando não há passos específicos", () => {
    const f = formulaById("hooke")!;
    const { steps, custom } = stepsFor(f, 0);
    expect(custom).toBe(false);
    expect(steps[0]).toContain("constante da mola (N/m)");
    expect(steps[0]).toContain("deformação (m)");
    expect(steps.join(" ")).toContain(f.solvers[0].label);
    expect(steps.length).toBeGreaterThanOrEqual(6);
  });

  it("avisa as condições (valor positivo, inteiro) no roteiro geral", () => {
    const steps = genericSteps(formulaById("combinatoria")!, formulaById("combinatoria")!.solvers[0]);
    expect(steps.join(" ")).toContain("Cuidado com as condições");
    expect(steps.join(" ")).toContain("número inteiro");
    const area = genericSteps(formulaById("area-triangulo")!, formulaById("area-triangulo")!.solvers[0]);
    expect(area.join(" ")).toContain("maior que zero");
  });

  it("todo solver de todo o catálogo gera passos legíveis", () => {
    for (const f of FORMULAS) {
      f.solvers.forEach((_, i) => {
        const { steps } = stepsFor(f, i);
        expect(steps.length, `${f.id}#${i}`).toBeGreaterThanOrEqual(2);
        for (const s of steps) expect(s.trim().length).toBeGreaterThan(5);
      });
    }
  });

  it("fórmulas próprias não têm guia", () => {
    expect(guideFor({ id: "pitagoras", custom: true })).toBeUndefined();
    expect(guideFor({ id: "pitagoras" })).toBeDefined();
  });
});

describe("método geral", () => {
  it("existe para as três áreas com passos e dicas", () => {
    for (const area of ["matematica", "fisica", "quimica"] as const) {
      expect(GENERAL_METHOD[area].steps.length).toBeGreaterThanOrEqual(6);
      expect(GENERAL_METHOD[area].tips.length).toBeGreaterThanOrEqual(3);
    }
    expect(GENERAL_METHOD.fisica.tips.join(" ")).toContain("3,6");
    expect(GENERAL_METHOD.quimica.steps.join(" ")).toContain("BALANCEIE");
  });
});
