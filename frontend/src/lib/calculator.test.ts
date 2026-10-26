import { describe, expect, it } from "vitest";
import { calculate, normalizeExpression, samplePlot, type AngleMode } from "./calculator";

function calc(expression: string, angle: AngleMode = "rad", scope = new Map<string, unknown>()) {
  return calculate(expression, { angle, scope });
}
function text(expression: string, angle: AngleMode = "rad") {
  const r = calc(expression, angle);
  if (!r.ok) throw new Error(`erro em "${expression}": ${r.error}`);
  return r.text;
}
function error(expression: string) {
  const r = calc(expression);
  if (r.ok) throw new Error(`"${expression}" deveria falhar, mas deu ${r.text}`);
  return r.error;
}

describe("aritmética", () => {
  it("respeita a precedência e a associatividade", () => {
    expect(text("2+3*4")).toBe("14");
    expect(text("(2+3)*4")).toBe("20");
    expect(text("2^3^2")).toBe("512"); // potência associa à direita
    expect(text("-2^2")).toBe("-4");
    expect(text("10-4-3")).toBe("3");
    expect(text("100/4/5")).toBe("5");
  });

  it("não acumula erro de ponto flutuante na exibição", () => {
    expect(text("0.1+0.2")).toBe("0.3");
    expect(text("1/3")).toBe("0.333333333333");
  });

  it("usa notação científica só para valores extremos", () => {
    expect(text("2^40")).toBe("1099511627776");
    expect(text("10^15")).toBe("1e+15");
    expect(text("1/10^10")).toBe("1e-10");
  });

  it("trata divisão por zero e valores indefinidos", () => {
    expect(text("1/0")).toBe("∞");
    expect(text("-1/0")).toBe("-∞");
    expect(text("0/0")).toBe("indefinido");
  });

  it("calcula porcentagem, resto e fatorial", () => {
    expect(text("50%")).toBe("0.5");
    expect(text("100+10%")).toBe("110");
    expect(text("17 mod 5")).toBe("2");
    expect(text("5!")).toBe("120");
    expect(text("0!")).toBe("1");
    expect(text("20!/18!")).toBe("380");
  });
});

describe("funções", () => {
  it("raízes, módulo, arredondamento e máximo/mínimo", () => {
    expect(text("sqrt(144)")).toBe("12");
    expect(text("cbrt(27)")).toBe("3");
    expect(text("nthRoot(32, 5)")).toBe("2");
    expect(text("abs(-7.5)")).toBe("7.5");
    expect(text("round(2.567, 2)")).toBe("2.57");
    expect(text("floor(-1.2)")).toBe("-2");
    expect(text("max(3, 9, 4)")).toBe("9");
    expect(text("min(3, 9, 4)")).toBe("3");
    expect(text("gcd(12, 18)")).toBe("6");
    expect(text("lcm(4, 6)")).toBe("12");
  });

  it("log é base 10, ln é natural e log2 existe", () => {
    expect(text("log(1000)")).toBe("3");
    expect(text("ln(e)")).toBe("1");
    expect(text("log2(8)")).toBe("3");
    expect(text("exp(0)")).toBe("1");
  });

  it("combinatória e primalidade", () => {
    expect(text("combinations(5, 2)")).toBe("10");
    expect(text("permutations(5, 2)")).toBe("20");
    expect(text("isPrime(97)")).toBe("true");
    expect(text("isPrime(91)")).toBe("false");
  });

  it("estatística básica", () => {
    expect(text("mean(2, 4, 6)")).toBe("4");
    expect(text("median(1, 9, 3)")).toBe("3");
    expect(text("sum(1, 2, 3, 4)")).toBe("10");
  });
});

describe("ângulos", () => {
  it("graus e radianos dão resultados coerentes", () => {
    expect(text("sin(30)", "deg")).toBe("0.5");
    expect(text("cos(60)", "deg")).toBe("0.5");
    expect(text("tan(45)", "deg")).toBe("1");
    expect(text("sin(pi/6)", "rad")).toBe("0.5");
    expect(text("asin(0.5)", "deg")).toBe("30");
    expect(text("atan(1)", "deg")).toBe("45");
    expect(text("acos(0)", "rad")).toBe("1.57079632679");
    expect(text("atan2(1, 1)", "deg")).toBe("45");
  });

  it("uma unidade explícita de ângulo vale em qualquer modo", () => {
    expect(text("sin(30 deg)", "rad")).toBe("0.5");
    expect(text("sin(30 deg)", "deg")).toBe("0.5");
  });
});

describe("números complexos, matrizes e unidades", () => {
  it("raiz de negativo vira número complexo", () => {
    expect(text("sqrt(-4)")).toBe("2i");
    expect(text("(1+2i)*(3-i)")).toBe("5 + 5i");
  });

  it("matrizes: produto, determinante, inversa e transposta", () => {
    expect(text("[1,2;3,4]*[1,0;0,1]")).toBe("[[1, 2], [3, 4]]");
    expect(text("det([1,2;3,4])")).toBe("-2");
    expect(text("inv([1,2;3,4])")).toBe("[[-2, 1], [1.5, -0.5]]");
    expect(text("transpose([1,2;3,4])")).toBe("[[1, 3], [2, 4]]");
    expect(error("inv([1,2;2,4])")).toContain("inversa");
  });

  it("converte unidades", () => {
    expect(text("5 km to m")).toBe("5000 m");
    expect(text("100 degC to degF")).toBe("212 degF");
    expect(text("2 h to minutes")).toBe("120 minutes");
    expect(error("5 kg to m")).toContain("unidades");
  });

  it("frações", () => {
    expect(text("fraction(0.25)")).toBe("1/4");
    expect(text("fraction(1,3) + fraction(1,6)")).toBe("1/2");
  });
});

describe("variáveis, funções do usuário e ans", () => {
  it("guarda variáveis e funções entre cálculos", () => {
    const scope = new Map<string, unknown>();
    calc("x = 3", "rad", scope);
    expect((calc("x^2 + 1", "rad", scope) as { text: string }).text).toBe("10");
    calc("f(t) = t^2 - 4", "rad", scope);
    expect((calc("f(5)", "rad", scope) as { text: string }).text).toBe("21");
  });

  it("ans guarda o último resultado", () => {
    const scope = new Map<string, unknown>();
    calc("6*7", "rad", scope);
    expect((calc("ans + 8", "rad", scope) as { text: string }).text).toBe("50");
  });

  it("o modo graus não vaza para as variáveis do usuário", () => {
    const scope = new Map<string, unknown>();
    calc("a = 1", "deg", scope);
    expect([...scope.keys()].sort()).toEqual(["a", "ans"]);
  });
});

describe("entrada em português", () => {
  it("aceita símbolos do teclado e vírgula decimal", () => {
    expect(normalizeExpression("2×3÷4−1")).toBe("2*3/4-1");
    expect(text("2,5*2")).toBe("5");
    expect(text("3×(2+1)")).toBe("9");
    expect(text("π")).toBe("3.14159265359");
    expect(text("√16")).toBe("4");
    expect(text("√(9+16)")).toBe("5");
    expect(text("5²")).toBe("25");
  });

  it("vírgula decimal convive com funções na mesma expressão", () => {
    expect(text("sqrt(2)*sin(30)+2,5^2", "deg")).toBe("6.95710678119");
    expect(text("max(2, 5)")).toBe("5"); // dentro da função, vírgula separa argumentos
    expect(text("(1,5+2,5)*2")).toBe("8");
  });

  it("mantém a vírgula como separador em funções e matrizes", () => {
    expect(text("max(1,2)")).toBe("2");
    expect(text("det([1,2;3,4])")).toBe("-2");
  });
});

describe("erros", () => {
  it("devolvem mensagens claras em português, sem lançar", () => {
    expect(error("2+")).toBe("Expressão incompleta.");
    expect(error("(2+3")).toBe("Expressão incompleta.");
    expect(error("foo + 1")).toBe('"foo" não existe.');
    expect(error("blah(3)")).toContain("não existe");
    expect(error("sqrt()")).toBe("Argumentos inválidos para a função.");
    expect(error("2 $ 3")).toBe("Expressão inválida.");
  });

  it("expressão vazia não é erro a mostrar", () => {
    const r = calc("   ");
    expect(r.ok).toBe(false);
    expect(!r.ok && r.empty).toBe(true);
  });

  it("recusa expressões longas demais", () => {
    expect(error("1+".repeat(300) + "1")).toContain("longa demais");
  });
});

describe("segurança e limites", () => {
  it.each([
    "import({x: 1})",
    "createUnit('foo')",
    "evaluate('1+1')",
    "parse('1+1')",
    "simplify('x+x')",
    "config()",
    "ones(3)",
    "zeros(3)",
    "range(1, 10)",
    "1:100000000",
    "identity(100000)",
  ])("não permite %s", (expression) => {
    expect(calc(expression).ok).toBe(false);
  });

  it("não alcança o JavaScript do navegador", () => {
    for (const expression of ["constructor", "toString", "__proto__", "[].constructor", "x.constructor.constructor('return 1')()", "this", "window", "globalThis"]) {
      expect(calc(expression).ok, expression).toBe(false);
    }
  });

  it("cálculos gigantes terminam rápido", () => {
    const started = performance.now();
    for (const expression of ["10^10^10", "1000000000!", "(2^40)!", "combinations(1e9, 5e8)", "2^1000000", "factorial(1e308)"]) {
      calc(expression);
    }
    expect(performance.now() - started).toBeLessThan(2000);
  });

  it("fatorial muito grande dá infinito sem travar", () => {
    expect(text("171!")).toBe("∞");
    expect(text("1000000000!")).toBe("∞");
  });
});

describe("gráfico de funções", () => {
  it("amostra a função e calcula a faixa de y", () => {
    const r = samplePlot("x^2", -2, 2, { angle: "rad", samples: 5 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.points.map((p) => p.y)).toEqual([4, 1, 0, 1, 4]);
    expect([r.data.yMin, r.data.yMax]).toEqual([0, 4]);
  });

  it("marca como sem valor o que está fora do domínio ou é complexo", () => {
    const r = samplePlot("sqrt(x)", -2, 2, { angle: "rad", samples: 5 });
    expect(r.ok && r.data.points.map((p) => p.y)).toEqual([null, null, 0, 1, expect.closeTo(1.414, 2)]);
    const d = samplePlot("1/x", -1, 1, { angle: "rad", samples: 3 });
    expect(d.ok && d.data.points[1].y).toBeNull(); // 1/0 é infinito
  });

  it("aceita y = e respeita o modo graus", () => {
    const r = samplePlot("y = sin(x)", 0, 90, { angle: "deg", samples: 3 });
    expect(r.ok && r.data.points.map((p) => Math.round((p.y ?? 0) * 1000) / 1000)).toEqual([0, 0.707, 1]);
  });

  it("recusa intervalo inválido, expressão errada e função sem valores reais", () => {
    expect(samplePlot("x", 5, 1, { angle: "rad" }).ok).toBe(false);
    const bad = samplePlot("x +", -1, 1, { angle: "rad" });
    expect(!bad.ok && bad.error).toBe("Expressão incompleta.");
    const unknown = samplePlot("foo(x)", -1, 1, { angle: "rad" });
    expect(!unknown.ok && unknown.error).toContain("não existe");
    expect(samplePlot("sqrt(-1-x^2)", -1, 1, { angle: "rad" }).ok).toBe(false);
  });

  it("limita a quantidade de pontos", () => {
    const r = samplePlot("x", 0, 1, { angle: "rad", samples: 1_000_000 });
    expect(r.ok && r.data.points.length).toBe(2000);
  });
});
