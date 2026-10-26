import type { Category, Domain, Formula, FormulaVar, Line, Solver } from "@/lib/formula-engine";

/**
 * Catálogo de fórmulas. Cada `example` é verificado por testes automáticos (o resultado calculado tem de
 * bater com `expect`), então erros de digitação em contas ou textos aparecem na hora.
 *
 * Convenções: `«x»` nos passos vira o valor de x (negativo entre parênteses) e `«=x»` o valor puro. Ângulos
 * são digitados em graus e convertidos nas contas. Taxas em % são digitadas em % (10 = 10%).
 */

const tex = String.raw;

const v = (id: string, latex: string, name: string, unit?: string, domain: Domain = "any", def?: string): FormulaVar => ({
  id, latex, name, unit, domain, default: def,
});

function solver(
  label: string, needs: string[], compute: Record<string, string>, lines: Line[], answers: string[],
  checks?: Solver["checks"],
): Solver {
  return { label, needs, compute, lines, answers, checks };
}

interface Spec {
  id: string;
  title: string;
  category: Category;
  topic: string;
  latex: string;
  summary: string;
  vars: FormulaVar[];
  solvers: Solver[];
  example: Formula["example"];
}
const f = (spec: Spec): Formula => spec;


// ---------------------------------------------------------------- Matemática

const MATEMATICA: Formula[] = [
  f({
    id: "pitagoras", title: "Teorema de Pitágoras", category: "matematica", topic: "Geometria plana",
    latex: tex`a^2 + b^2 = c^2`,
    summary: "Em um triângulo retângulo, o quadrado da hipotenusa (o lado maior, oposto ao ângulo reto) é igual à soma dos quadrados dos catetos.",
    vars: [v("a", "a", "cateto a", undefined, "pos"), v("b", "b", "cateto b", undefined, "pos"), v("c", "c", "hipotenusa c", undefined, "pos")],
    solvers: [
      solver("Hipotenusa (c)", ["a", "b"], { s: "a^2 + b^2", c: "sqrt(s)" },
        [tex`c = \sqrt{a^2 + b^2}`, tex`c = \sqrt{«a»^2 + «b»^2}`, tex`c = \sqrt{«=s»} = «=c»`], ["c"]),
      solver("Cateto a", ["b", "c"], { s: "c^2 - b^2", a: "sqrt(s)" },
        [tex`a = \sqrt{c^2 - b^2}`, tex`a = \sqrt{«c»^2 - «b»^2}`, tex`a = \sqrt{«=s»} = «=a»`], ["a"],
        [{ when: "c <= b", message: "A hipotenusa precisa ser maior que o cateto." }]),
      solver("Cateto b", ["a", "c"], { s: "c^2 - a^2", b: "sqrt(s)" },
        [tex`b = \sqrt{c^2 - a^2}`, tex`b = \sqrt{«c»^2 - «a»^2}`, tex`b = \sqrt{«=s»} = «=b»`], ["b"],
        [{ when: "c <= a", message: "A hipotenusa precisa ser maior que o cateto." }]),
    ],
    example: { solver: 0, values: { a: "3", b: "4" }, expect: { c: 5 } },
  }),
  f({
    id: "bhaskara", title: "Fórmula de Bhaskara (equação do 2º grau)", category: "matematica", topic: "Álgebra",
    latex: tex`ax^2 + bx + c = 0 \;\Rightarrow\; x = \dfrac{-b \pm \sqrt{b^2 - 4ac}}{2a}`,
    summary: "Resolve equações do tipo ax² + bx + c = 0 (com a ≠ 0). O discriminante Δ = b² − 4ac diz quantas raízes reais existem: duas (Δ > 0), uma (Δ = 0) ou nenhuma (Δ < 0).",
    vars: [v("a", "a", "coeficiente a"), v("b", "b", "coeficiente b"), v("c", "c", "coeficiente c")],
    solvers: [
      solver("Raízes (x₁ e x₂)", ["a", "b", "c"],
        { delta: "b^2 - 4*a*c", x1: "delta >= 0 ? (-b + sqrt(delta)) / (2*a) : 0", x2: "delta >= 0 ? (-b - sqrt(delta)) / (2*a) : 0" },
        [
          tex`\Delta = b^2 - 4ac`,
          tex`\Delta = «b»^2 - 4\cdot«a»\cdot«c» = «=delta»`,
          { if: "delta > 0", latex: tex`x = \dfrac{-b \pm \sqrt{\Delta}}{2a} = \dfrac{-«b» \pm \sqrt{«=delta»}}{2\cdot«a»}` },
          { if: "delta > 0", latex: tex`x_1 = «=x1» \qquad x_2 = «=x2»` },
          { if: "delta == 0", latex: tex`x = \dfrac{-b}{2a} = \dfrac{-«b»}{2\cdot«a»} = «=x1»` },
          { if: "delta < 0", latex: tex`\Delta < 0 \;\Rightarrow\; \text{a equação não tem raízes reais}` },
        ],
        ["delta", "x1", "x2"], [{ when: "a == 0", message: "Com a = 0 a equação não é do 2º grau." }]),
    ],
    example: { solver: 0, values: { a: "1", b: "-3", c: "-4" }, expect: { delta: 25, x1: 4, x2: -1 } },
  }),
  f({
    id: "soma-produto", title: "Soma e produto das raízes", category: "matematica", topic: "Álgebra",
    latex: tex`S = x_1 + x_2 = -\dfrac{b}{a} \qquad P = x_1 \cdot x_2 = \dfrac{c}{a}`,
    summary: "Relações de Girard: dá a soma e o produto das raízes de ax² + bx + c = 0 sem precisar calculá-las.",
    vars: [v("a", "a", "coeficiente a"), v("b", "b", "coeficiente b"), v("c", "c", "coeficiente c")],
    solvers: [
      solver("Soma e produto", ["a", "b", "c"], { S: "-b / a", P: "c / a" },
        [tex`S = -\dfrac{b}{a} = -\dfrac{«b»}{«a»} = «=S»`, tex`P = \dfrac{c}{a} = \dfrac{«c»}{«a»} = «=P»`], ["S", "P"],
        [{ when: "a == 0", message: "Com a = 0 a equação não é do 2º grau." }]),
    ],
    example: { solver: 0, values: { a: "2", b: "-8", c: "6" }, expect: { S: 4, P: 3 } },
  }),
  f({
    id: "vertice", title: "Vértice da parábola", category: "matematica", topic: "Funções",
    latex: tex`x_v = -\dfrac{b}{2a} \qquad y_v = -\dfrac{\Delta}{4a}`,
    summary: "Ponto de máximo (a < 0) ou de mínimo (a > 0) da função y = ax² + bx + c.",
    vars: [v("a", "a", "coeficiente a"), v("b", "b", "coeficiente b"), v("c", "c", "coeficiente c")],
    solvers: [
      solver("Vértice (xᵥ, yᵥ)", ["a", "b", "c"], { delta: "b^2 - 4*a*c", xv: "-b / (2*a)", yv: "-delta / (4*a)" },
        [tex`x_v = -\dfrac{b}{2a} = -\dfrac{«b»}{2\cdot«a»} = «=xv»`, tex`\Delta = «b»^2 - 4\cdot«a»\cdot«c» = «=delta»`, tex`y_v = -\dfrac{\Delta}{4a} = -\dfrac{«delta»}{4\cdot«a»} = «=yv»`],
        ["xv", "yv"], [{ when: "a == 0", message: "Com a = 0 não há parábola." }]),
    ],
    example: { solver: 0, values: { a: "1", b: "-4", c: "3" }, expect: { xv: 2, yv: -1 } },
  }),
  f({
    id: "area-triangulo", title: "Área do triângulo", category: "matematica", topic: "Geometria plana",
    latex: tex`A = \dfrac{b \cdot h}{2}`,
    summary: "Metade do produto da base pela altura correspondente.",
    vars: [v("A", "A", "área", "u²", "pos"), v("b", "b", "base", "u", "pos"), v("h", "h", "altura", "u", "pos")],
    solvers: [
      solver("Área (A)", ["b", "h"], { A: "b*h/2" }, [tex`A = \dfrac{b\cdot h}{2}`, tex`A = \dfrac{«b»\cdot«h»}{2} = «=A»`], ["A"]),
      solver("Altura (h)", ["A", "b"], { h: "2*A/b" }, [tex`h = \dfrac{2A}{b}`, tex`h = \dfrac{2\cdot«A»}{«b»} = «=h»`], ["h"]),
      solver("Base (b)", ["A", "h"], { b: "2*A/h" }, [tex`b = \dfrac{2A}{h}`, tex`b = \dfrac{2\cdot«A»}{«h»} = «=b»`], ["b"]),
    ],
    example: { solver: 0, values: { b: "6", h: "4" }, expect: { A: 12 } },
  }),
  f({
    id: "area-retangulo", title: "Área do retângulo", category: "matematica", topic: "Geometria plana",
    latex: tex`A = b \cdot h`,
    summary: "Produto da base pela altura.",
    vars: [v("A", "A", "área", "u²", "pos"), v("b", "b", "base", "u", "pos"), v("h", "h", "altura", "u", "pos")],
    solvers: [
      solver("Área (A)", ["b", "h"], { A: "b*h" }, [tex`A = b\cdot h`, tex`A = «b»\cdot«h» = «=A»`], ["A"]),
      solver("Altura (h)", ["A", "b"], { h: "A/b" }, [tex`h = \dfrac{A}{b}`, tex`h = \dfrac{«A»}{«b»} = «=h»`], ["h"]),
    ],
    example: { solver: 0, values: { b: "7", h: "3" }, expect: { A: 21 } },
  }),
  f({
    id: "area-trapezio", title: "Área do trapézio", category: "matematica", topic: "Geometria plana",
    latex: tex`A = \dfrac{(B + b)\cdot h}{2}`,
    summary: "Média das bases (maior B e menor b) multiplicada pela altura.",
    vars: [v("B", "B", "base maior", "u", "pos"), v("b", "b", "base menor", "u", "pos"), v("h", "h", "altura", "u", "pos")],
    solvers: [solver("Área (A)", ["B", "b", "h"], { A: "(B + b)*h/2" }, [tex`A = \dfrac{(B+b)\cdot h}{2}`, tex`A = \dfrac{(«B»+«b»)\cdot«h»}{2} = «=A»`], ["A"])],
    example: { solver: 0, values: { B: "8", b: "4", h: "5" }, expect: { A: 30 } },
  }),
  f({
    id: "area-losango", title: "Área do losango", category: "matematica", topic: "Geometria plana",
    latex: tex`A = \dfrac{D \cdot d}{2}`,
    summary: "Metade do produto das diagonais (maior D e menor d).",
    vars: [v("D", "D", "diagonal maior", "u", "pos"), v("d", "d", "diagonal menor", "u", "pos")],
    solvers: [solver("Área (A)", ["D", "d"], { A: "D*d/2" }, [tex`A = \dfrac{D\cdot d}{2}`, tex`A = \dfrac{«D»\cdot«d»}{2} = «=A»`], ["A"])],
    example: { solver: 0, values: { D: "10", d: "6" }, expect: { A: 30 } },
  }),
  f({
    id: "circulo", title: "Área e comprimento do círculo", category: "matematica", topic: "Geometria plana",
    latex: tex`A = \pi r^2 \qquad C = 2\pi r`,
    summary: "Área (A) e comprimento da circunferência (C) a partir do raio r. O diâmetro é o dobro do raio.",
    vars: [v("r", "r", "raio", "u", "pos"), v("A", "A", "área", "u²", "pos"), v("C", "C", "comprimento", "u", "pos")],
    solvers: [
      solver("Área e comprimento (a partir de r)", ["r"], { A: "pi*r^2", C: "2*pi*r" },
        [tex`A = \pi r^2 = \pi\cdot«r»^2 = «=A»`, tex`C = 2\pi r = 2\cdot\pi\cdot«r» = «=C»`], ["A", "C"]),
      solver("Raio (a partir da área)", ["A"], { r: "sqrt(A/pi)" }, [tex`r = \sqrt{\dfrac{A}{\pi}}`, tex`r = \sqrt{\dfrac{«A»}{\pi}} = «=r»`], ["r"]),
      solver("Raio (a partir do comprimento)", ["C"], { r: "C/(2*pi)" }, [tex`r = \dfrac{C}{2\pi}`, tex`r = \dfrac{«C»}{2\pi} = «=r»`], ["r"]),
    ],
    example: { solver: 0, values: { r: "5" }, expect: { A: 78.53981633974483, C: 31.41592653589793 } },
  }),
  f({
    id: "volume-cilindro", title: "Volume do cilindro", category: "matematica", topic: "Geometria espacial",
    latex: tex`V = \pi r^2 h`,
    summary: "Área da base (círculo) multiplicada pela altura.",
    vars: [v("r", "r", "raio da base", "u", "pos"), v("h", "h", "altura", "u", "pos")],
    solvers: [solver("Volume (V)", ["r", "h"], { V: "pi*r^2*h" }, [tex`V = \pi r^2 h`, tex`V = \pi\cdot«r»^2\cdot«h» = «=V»`], ["V"])],
    example: { solver: 0, values: { r: "2", h: "5" }, expect: { V: 62.83185307179586 } },
  }),
  f({
    id: "volume-cone", title: "Volume do cone", category: "matematica", topic: "Geometria espacial",
    latex: tex`V = \dfrac{\pi r^2 h}{3}`,
    summary: "Um terço do volume do cilindro de mesma base e altura.",
    vars: [v("r", "r", "raio da base", "u", "pos"), v("h", "h", "altura", "u", "pos")],
    solvers: [solver("Volume (V)", ["r", "h"], { V: "pi*r^2*h/3" }, [tex`V = \dfrac{\pi r^2 h}{3}`, tex`V = \dfrac{\pi\cdot«r»^2\cdot«h»}{3} = «=V»`], ["V"])],
    example: { solver: 0, values: { r: "3", h: "4" }, expect: { V: 37.69911184307752 } },
  }),
  f({
    id: "esfera", title: "Esfera: volume e área da superfície", category: "matematica", topic: "Geometria espacial",
    latex: tex`V = \dfrac{4}{3}\pi r^3 \qquad A = 4\pi r^2`,
    summary: "Volume (V) e área da superfície (A) de uma esfera de raio r.",
    vars: [v("r", "r", "raio", "u", "pos")],
    solvers: [solver("Volume e área (a partir de r)", ["r"], { V: "4*pi*r^3/3", A: "4*pi*r^2" },
      [tex`V = \dfrac{4}{3}\pi r^3 = \dfrac{4}{3}\cdot\pi\cdot«r»^3 = «=V»`, tex`A = 4\pi r^2 = 4\cdot\pi\cdot«r»^2 = «=A»`], ["V", "A"])],
    example: { solver: 0, values: { r: "3" }, expect: { V: 113.09733552923255, A: 113.09733552923255 } },
  }),
  f({
    id: "paralelepipedo", title: "Volume do paralelepípedo", category: "matematica", topic: "Geometria espacial",
    latex: tex`V = a \cdot b \cdot c`,
    summary: "Produto das três dimensões (comprimento, largura e altura). Para o cubo, as três são iguais.",
    vars: [v("a", "a", "comprimento", "u", "pos"), v("b", "b", "largura", "u", "pos"), v("c", "c", "altura", "u", "pos")],
    solvers: [solver("Volume (V)", ["a", "b", "c"], { V: "a*b*c" }, [tex`V = a\cdot b\cdot c`, tex`V = «a»\cdot«b»\cdot«c» = «=V»`], ["V"])],
    example: { solver: 0, values: { a: "2", b: "3", c: "4" }, expect: { V: 24 } },
  }),
  f({
    id: "lei-cossenos", title: "Lei dos cossenos", category: "matematica", topic: "Trigonometria",
    latex: tex`a^2 = b^2 + c^2 - 2bc\cos\alpha`,
    summary: "Relaciona os três lados de um triângulo qualquer com o ângulo α oposto ao lado a. Com α = 90° vira o teorema de Pitágoras.",
    vars: [v("b", "b", "lado b", "u", "pos"), v("c", "c", "lado c", "u", "pos"), v("al", "\\alpha", "ângulo α (entre b e c)", "°", "pos")],
    solvers: [solver("Lado a", ["b", "c", "al"], { s: "b^2 + c^2 - 2*b*c*cos(al*pi/180)", a: "sqrt(s)" },
      [tex`a = \sqrt{b^2 + c^2 - 2bc\cos\alpha}`, tex`a = \sqrt{«b»^2 + «c»^2 - 2\cdot«b»\cdot«c»\cdot\cos(«al»^\circ)}`, tex`a = \sqrt{«=s»} = «=a»`], ["a"],
      [{ when: "al >= 180", message: "O ângulo de um triângulo é menor que 180°." }])],
    example: { solver: 0, values: { b: "3", c: "4", al: "90" }, expect: { a: 5 } },
  }),
  f({
    id: "lei-senos", title: "Lei dos senos", category: "matematica", topic: "Trigonometria",
    latex: tex`\dfrac{a}{\sin A} = \dfrac{b}{\sin B}`,
    summary: "Em qualquer triângulo, a razão entre um lado e o seno do ângulo oposto é constante.",
    vars: [v("a", "a", "lado a", "u", "pos"), v("A", "A", "ângulo A (oposto a a)", "°", "pos"), v("B", "B", "ângulo B (oposto a b)", "°", "pos")],
    solvers: [solver("Lado b", ["a", "A", "B"], { b: "a*sin(B*pi/180)/sin(A*pi/180)" },
      [tex`b = \dfrac{a\cdot\sin B}{\sin A}`, tex`b = \dfrac{«a»\cdot\sin(«B»^\circ)}{\sin(«A»^\circ)} = «=b»`], ["b"],
      [{ when: "A >= 180 or B >= 180", message: "Os ângulos de um triângulo são menores que 180°." }])],
    example: { solver: 0, values: { a: "10", A: "30", B: "90" }, expect: { b: 20 } },
  }),
  f({
    id: "trig-retangulo", title: "Seno, cosseno e tangente (triângulo retângulo)", category: "matematica", topic: "Trigonometria",
    latex: tex`\sin\theta = \dfrac{co}{h} \quad \cos\theta = \dfrac{ca}{h} \quad \tan\theta = \dfrac{co}{ca}`,
    summary: "Razões entre os lados de um triângulo retângulo: co = cateto oposto ao ângulo θ, ca = cateto adjacente e h = hipotenusa.",
    vars: [v("h", "h", "hipotenusa", "u", "pos"), v("co", "co", "cateto oposto", "u", "pos"), v("ca", "ca", "cateto adjacente", "u", "pos"), v("th", "\\theta", "ângulo θ", "°", "pos")],
    solvers: [
      solver("Cateto oposto (com h e θ)", ["h", "th"], { co: "h*sin(th*pi/180)" }, [tex`co = h\cdot\sin\theta`, tex`co = «h»\cdot\sin(«th»^\circ) = «=co»`], ["co"], [{ when: "th >= 90", message: "Em um triângulo retângulo, θ é menor que 90°." }]),
      solver("Cateto adjacente (com h e θ)", ["h", "th"], { ca: "h*cos(th*pi/180)" }, [tex`ca = h\cdot\cos\theta`, tex`ca = «h»\cdot\cos(«th»^\circ) = «=ca»`], ["ca"], [{ when: "th >= 90", message: "Em um triângulo retângulo, θ é menor que 90°." }]),
      solver("Cateto oposto (com ca e θ)", ["ca", "th"], { co: "ca*tan(th*pi/180)" }, [tex`co = ca\cdot\tan\theta`, tex`co = «ca»\cdot\tan(«th»^\circ) = «=co»`], ["co"], [{ when: "th >= 90", message: "Em um triângulo retângulo, θ é menor que 90°." }]),
      solver("Ângulo θ (com co e ca)", ["co", "ca"], { th: "atan(co/ca)*180/pi" }, [tex`\theta = \arctan\dfrac{co}{ca}`, tex`\theta = \arctan\dfrac{«co»}{«ca»} = «=th»^\circ`], ["th"]),
    ],
    example: { solver: 3, values: { co: "1", ca: "1" }, expect: { th: 45 } },
  }),
  f({
    id: "distancia-pontos", title: "Distância entre dois pontos", category: "matematica", topic: "Geometria analítica",
    latex: tex`d = \sqrt{(x_2 - x_1)^2 + (y_2 - y_1)^2}`,
    summary: "Distância em linha reta entre os pontos (x₁, y₁) e (x₂, y₂) do plano: é o teorema de Pitágoras aplicado às diferenças das coordenadas.",
    vars: [v("x1", "x_1", "x do ponto 1"), v("y1", "y_1", "y do ponto 1"), v("x2", "x_2", "x do ponto 2"), v("y2", "y_2", "y do ponto 2")],
    solvers: [solver("Distância (d)", ["x1", "y1", "x2", "y2"], { s: "(x2 - x1)^2 + (y2 - y1)^2", d: "sqrt(s)" },
      [tex`d = \sqrt{(x_2-x_1)^2 + (y_2-y_1)^2}`, tex`d = \sqrt{(«x2»-«x1»)^2 + («y2»-«y1»)^2} = \sqrt{«=s»} = «=d»`], ["d"])],
    example: { solver: 0, values: { x1: "0", y1: "0", x2: "3", y2: "4" }, expect: { d: 5 } },
  }),
  f({
    id: "coef-angular", title: "Coeficiente angular da reta", category: "matematica", topic: "Geometria analítica",
    latex: tex`m = \dfrac{y_2 - y_1}{x_2 - x_1}`,
    summary: "Inclinação da reta que passa pelos pontos (x₁, y₁) e (x₂, y₂). Na equação y = mx + n, m é o coeficiente angular.",
    vars: [v("x1", "x_1", "x do ponto 1"), v("y1", "y_1", "y do ponto 1"), v("x2", "x_2", "x do ponto 2"), v("y2", "y_2", "y do ponto 2")],
    solvers: [solver("Coeficiente angular (m)", ["x1", "y1", "x2", "y2"], { m: "(y2 - y1)/(x2 - x1)" },
      [tex`m = \dfrac{y_2-y_1}{x_2-x_1}`, tex`m = \dfrac{«y2»-«y1»}{«x2»-«x1»} = «=m»`], ["m"],
      [{ when: "x2 == x1", message: "Com x₁ = x₂ a reta é vertical e não tem coeficiente angular." }])],
    example: { solver: 0, values: { x1: "1", y1: "2", x2: "3", y2: "6" }, expect: { m: 2 } },
  }),
  f({
    id: "porcentagem", title: "Porcentagem", category: "matematica", topic: "Matemática básica",
    latex: tex`\text{parte} = \dfrac{p}{100}\cdot\text{total}`,
    summary: "Calcula a parte, a porcentagem ou o total quando você conhece os outros dois valores.",
    vars: [v("p", "p", "porcentagem", "%"), v("total", "\\text{total}", "total", undefined, "any"), v("parte", "\\text{parte}", "parte")],
    solvers: [
      solver("Parte (quanto é p% do total)", ["p", "total"], { parte: "p/100*total" }, [tex`\text{parte} = \dfrac{p}{100}\cdot\text{total}`, tex`\text{parte} = \dfrac{«p»}{100}\cdot«total» = «=parte»`], ["parte"]),
      solver("Porcentagem (quantos % a parte é do total)", ["parte", "total"], { p: "parte/total*100" }, [tex`p = \dfrac{\text{parte}}{\text{total}}\cdot 100`, tex`p = \dfrac{«parte»}{«total»}\cdot 100 = «=p»\%`], ["p"],
        [{ when: "total == 0", message: "O total não pode ser zero." }]),
      solver("Total (a partir da parte e de p%)", ["parte", "p"], { total: "parte*100/p" }, [tex`\text{total} = \dfrac{\text{parte}\cdot 100}{p}`, tex`\text{total} = \dfrac{«parte»\cdot 100}{«p»} = «=total»`], ["total"],
        [{ when: "p == 0", message: "A porcentagem não pode ser zero." }]),
    ],
    example: { solver: 0, values: { p: "15", total: "200" }, expect: { parte: 30 } },
  }),
  f({
    id: "regra-de-tres", title: "Regra de três simples (direta)", category: "matematica", topic: "Matemática básica",
    latex: tex`\dfrac{a}{b} = \dfrac{c}{x} \;\Rightarrow\; x = \dfrac{b\cdot c}{a}`,
    summary: "Se a corresponde a b, então c corresponde a x. Vale para grandezas diretamente proporcionais (quando uma aumenta, a outra também).",
    vars: [v("a", "a", "valor a"), v("b", "b", "valor b (correspondente de a)"), v("c", "c", "valor c")],
    solvers: [solver("Valor x", ["a", "b", "c"], { x: "b*c/a" }, [tex`x = \dfrac{b\cdot c}{a}`, tex`x = \dfrac{«b»\cdot«c»}{«a»} = «=x»`], ["x"], [{ when: "a == 0", message: "O valor a não pode ser zero." }])],
    example: { solver: 0, values: { a: "2", b: "10", c: "6" }, expect: { x: 30 } },
  }),
  f({
    id: "juros-simples", title: "Juros simples", category: "matematica", topic: "Matemática financeira",
    latex: tex`J = C \cdot i \cdot t \qquad M = C + J`,
    summary: "No regime simples, os juros J incidem sempre sobre o capital inicial C, a uma taxa i por período, durante t períodos. M é o montante final.",
    vars: [v("C", "C", "capital", "R$", "pos"), v("i", "i", "taxa por período", "%", "nonneg"), v("t", "t", "tempo (períodos)", undefined, "nonneg")],
    solvers: [solver("Juros (J) e montante (M)", ["C", "i", "t"], { J: "C*i/100*t", M: "C + J" },
      [tex`J = C\cdot i\cdot t = «C»\cdot\dfrac{«i»}{100}\cdot«t» = «=J»`, tex`M = C + J = «C» + «J» = «=M»`], ["J", "M"])],
    example: { solver: 0, values: { C: "1000", i: "2", t: "6" }, expect: { J: 120, M: 1120 } },
  }),
  f({
    id: "juros-compostos", title: "Juros compostos", category: "matematica", topic: "Matemática financeira",
    latex: tex`M = C\,(1 + i)^t`,
    summary: "No regime composto, os juros de cada período incidem sobre o montante do período anterior ('juros sobre juros'). Digite a taxa em % (10 = 10%).",
    vars: [v("M", "M", "montante", "R$", "pos"), v("C", "C", "capital", "R$", "pos"), v("i", "i", "taxa por período", "%", "pos"), v("t", "t", "tempo (períodos)", undefined, "pos")],
    solvers: [
      solver("Montante (M)", ["C", "i", "t"], { M: "C*(1 + i/100)^t" }, [tex`M = C(1+i)^t`, tex`M = «C»\left(1+\dfrac{«i»}{100}\right)^{«t»} = «=M»`], ["M"]),
      solver("Capital (C)", ["M", "i", "t"], { C: "M/(1 + i/100)^t" }, [tex`C = \dfrac{M}{(1+i)^t}`, tex`C = \dfrac{«M»}{\left(1+\dfrac{«i»}{100}\right)^{«t»}} = «=C»`], ["C"]),
      solver("Tempo (t)", ["M", "C", "i"], { t: "ln(M/C)/ln(1 + i/100)" }, [tex`t = \dfrac{\ln(M/C)}{\ln(1+i)}`, tex`t = \dfrac{\ln(«M»/«C»)}{\ln(1+«i»/100)} = «=t»`], ["t"]),
      solver("Taxa (i)", ["M", "C", "t"], { i: "((M/C)^(1/t) - 1)*100" }, [tex`i = \left(\sqrt[t]{\dfrac{M}{C}} - 1\right)\cdot 100`, tex`i = \left(\left(\dfrac{«M»}{«C»}\right)^{1/«t»} - 1\right)\cdot 100 = «=i»\%`], ["i"]),
    ],
    example: { solver: 0, values: { C: "1000", i: "10", t: "2" }, expect: { M: 1210 } },
  }),
  f({
    id: "pa", title: "Progressão aritmética (PA)", category: "matematica", topic: "Sequências",
    latex: tex`a_n = a_1 + (n-1)\,r \qquad S_n = \dfrac{(a_1 + a_n)\,n}{2}`,
    summary: "Sequência em que cada termo é o anterior somado à razão r. Dá o n-ésimo termo (aₙ) e a soma dos n primeiros termos (Sₙ).",
    vars: [v("a1", "a_1", "primeiro termo"), v("r", "r", "razão"), v("n", "n", "posição / quantidade de termos", undefined, "pos"), v("an", "a_n", "n-ésimo termo")],
    solvers: [
      solver("Termo aₙ (com a₁, r e n)", ["a1", "r", "n"], { an: "a1 + (n - 1)*r" }, [tex`a_n = a_1 + (n-1)\,r`, tex`a_n = «a1» + («n»-1)\cdot«r» = «=an»`], ["an"]),
      solver("Soma Sₙ (com a₁, aₙ e n)", ["a1", "an", "n"], { Sn: "(a1 + an)*n/2" }, [tex`S_n = \dfrac{(a_1+a_n)\,n}{2}`, tex`S_n = \dfrac{(«a1»+«an»)\cdot«n»}{2} = «=Sn»`], ["Sn"]),
    ],
    example: { solver: 0, values: { a1: "2", r: "3", n: "10" }, expect: { an: 29 } },
  }),
  f({
    id: "pg", title: "Progressão geométrica (PG)", category: "matematica", topic: "Sequências",
    latex: tex`a_n = a_1\, q^{\,n-1} \qquad S_n = \dfrac{a_1\,(q^n - 1)}{q - 1}`,
    summary: "Sequência em que cada termo é o anterior multiplicado pela razão q. Dá o n-ésimo termo (aₙ) e a soma dos n primeiros termos (Sₙ, com q ≠ 1).",
    vars: [v("a1", "a_1", "primeiro termo"), v("q", "q", "razão"), v("n", "n", "posição / quantidade de termos", undefined, "pos")],
    solvers: [
      solver("Termo aₙ", ["a1", "q", "n"], { an: "a1*q^(n - 1)" }, [tex`a_n = a_1\,q^{n-1}`, tex`a_n = «a1»\cdot«q»^{«n»-1} = «=an»`], ["an"]),
      solver("Soma Sₙ", ["a1", "q", "n"], { Sn: "a1*(q^n - 1)/(q - 1)" }, [tex`S_n = \dfrac{a_1\,(q^n-1)}{q-1}`, tex`S_n = \dfrac{«a1»\cdot(«q»^{«n»}-1)}{«q»-1} = «=Sn»`], ["Sn"],
        [{ when: "q == 1", message: "Com q = 1 todos os termos são iguais: Sₙ = n · a₁." }]),
    ],
    example: { solver: 1, values: { a1: "2", q: "3", n: "5" }, expect: { Sn: 242 } },
  }),
  f({
    id: "combinatoria", title: "Arranjo e combinação", category: "matematica", topic: "Análise combinatória",
    latex: tex`A_{n,p} = \dfrac{n!}{(n-p)!} \qquad C_{n,p} = \dfrac{n!}{p!\,(n-p)!}`,
    summary: "Arranjo: escolhas de p entre n elementos em que a ordem importa. Combinação: a ordem não importa.",
    vars: [v("n", "n", "total de elementos", undefined, "nonnegint"), v("p", "p", "elementos escolhidos", undefined, "nonnegint")],
    solvers: [solver("Arranjo e combinação", ["n", "p"], { Anp: "n!/(n - p)!", Cnp: "combinations(n, p)" },
      [tex`A_{n,p} = \dfrac{«n»!}{(«n»-«p»)!} = «=Anp»`, tex`C_{n,p} = \dfrac{«n»!}{«p»!\,(«n»-«p»)!} = «=Cnp»`], ["Anp", "Cnp"],
      [{ when: "p > n", message: "p não pode ser maior que n." }, { when: "n > 20", message: "Use n até 20 (acima disso os números ficam grandes demais)." }])],
    example: { solver: 0, values: { n: "5", p: "2" }, expect: { Anp: 20, Cnp: 10 } },
  }),
];

// ---------------------------------------------------------------- Física

const FISICA: Formula[] = [
  f({
    id: "velocidade-media", title: "Velocidade média", category: "fisica", topic: "Cinemática",
    latex: tex`v = \dfrac{\Delta s}{\Delta t}`,
    summary: "Razão entre o deslocamento Δs e o intervalo de tempo Δt. Use unidades coerentes (m e s dão m/s; km e h dão km/h). Para converter: km/h ÷ 3,6 = m/s.",
    vars: [v("v", "v", "velocidade média", "m/s"), v("ds", "\\Delta s", "deslocamento", "m"), v("dt", "\\Delta t", "intervalo de tempo", "s", "pos")],
    solvers: [
      solver("Velocidade (v)", ["ds", "dt"], { v: "ds/dt" }, [tex`v = \dfrac{\Delta s}{\Delta t}`, tex`v = \dfrac{«ds»}{«dt»} = «=v»`], ["v"]),
      solver("Deslocamento (Δs)", ["v", "dt"], { ds: "v*dt" }, [tex`\Delta s = v\cdot\Delta t`, tex`\Delta s = «v»\cdot«dt» = «=ds»`], ["ds"]),
      solver("Tempo (Δt)", ["ds", "v"], { dt: "ds/v" }, [tex`\Delta t = \dfrac{\Delta s}{v}`, tex`\Delta t = \dfrac{«ds»}{«v»} = «=dt»`], ["dt"], [{ when: "v == 0", message: "A velocidade não pode ser zero." }]),
    ],
    example: { solver: 0, values: { ds: "100", dt: "20" }, expect: { v: 5 } },
  }),
  f({
    id: "mru", title: "Movimento uniforme (MRU)", category: "fisica", topic: "Cinemática",
    latex: tex`s = s_0 + v\,t`,
    summary: "Posição de um corpo com velocidade constante: parte de s₀ e avança v a cada unidade de tempo.",
    vars: [v("s", "s", "posição final", "m"), v("s0", "s_0", "posição inicial", "m"), v("v", "v", "velocidade", "m/s"), v("t", "t", "tempo", "s", "nonneg")],
    solvers: [
      solver("Posição (s)", ["s0", "v", "t"], { s: "s0 + v*t" }, [tex`s = s_0 + v\,t`, tex`s = «s0» + «v»\cdot«t» = «=s»`], ["s"]),
      solver("Tempo (t)", ["s", "s0", "v"], { t: "(s - s0)/v" }, [tex`t = \dfrac{s - s_0}{v}`, tex`t = \dfrac{«s» - «s0»}{«v»} = «=t»`], ["t"], [{ when: "v == 0", message: "A velocidade não pode ser zero." }]),
      solver("Velocidade (v)", ["s", "s0", "t"], { v: "(s - s0)/t" }, [tex`v = \dfrac{s - s_0}{t}`, tex`v = \dfrac{«s» - «s0»}{«t»} = «=v»`], ["v"], [{ when: "t == 0", message: "O tempo não pode ser zero." }]),
    ],
    example: { solver: 0, values: { s0: "10", v: "5", t: "4" }, expect: { s: 30 } },
  }),
  f({
    id: "mruv-velocidade", title: "MRUV: velocidade em função do tempo", category: "fisica", topic: "Cinemática",
    latex: tex`v = v_0 + a\,t`,
    summary: "Velocidade de um corpo com aceleração constante a, partindo de v₀.",
    vars: [v("v", "v", "velocidade final", "m/s"), v("v0", "v_0", "velocidade inicial", "m/s"), v("a", "a", "aceleração", "m/s²"), v("t", "t", "tempo", "s", "nonneg")],
    solvers: [
      solver("Velocidade (v)", ["v0", "a", "t"], { v: "v0 + a*t" }, [tex`v = v_0 + a\,t`, tex`v = «v0» + «a»\cdot«t» = «=v»`], ["v"]),
      solver("Aceleração (a)", ["v", "v0", "t"], { a: "(v - v0)/t" }, [tex`a = \dfrac{v - v_0}{t}`, tex`a = \dfrac{«v» - «v0»}{«t»} = «=a»`], ["a"], [{ when: "t == 0", message: "O tempo não pode ser zero." }]),
      solver("Tempo (t)", ["v", "v0", "a"], { t: "(v - v0)/a" }, [tex`t = \dfrac{v - v_0}{a}`, tex`t = \dfrac{«v» - «v0»}{«a»} = «=t»`], ["t"], [{ when: "a == 0", message: "A aceleração não pode ser zero." }]),
    ],
    example: { solver: 0, values: { v0: "2", a: "3", t: "4" }, expect: { v: 14 } },
  }),
  f({
    id: "mruv-posicao", title: "MRUV: posição em função do tempo", category: "fisica", topic: "Cinemática",
    latex: tex`s = s_0 + v_0 t + \dfrac{a\,t^2}{2}`,
    summary: "Posição de um corpo com aceleração constante.",
    vars: [v("s0", "s_0", "posição inicial", "m"), v("v0", "v_0", "velocidade inicial", "m/s"), v("a", "a", "aceleração", "m/s²"), v("t", "t", "tempo", "s", "nonneg")],
    solvers: [solver("Posição (s)", ["s0", "v0", "a", "t"], { s: "s0 + v0*t + a*t^2/2" },
      [tex`s = s_0 + v_0 t + \dfrac{a t^2}{2}`, tex`s = «s0» + «v0»\cdot«t» + \dfrac{«a»\cdot«t»^2}{2} = «=s»`], ["s"])],
    example: { solver: 0, values: { s0: "0", v0: "2", a: "4", t: "3" }, expect: { s: 24 } },
  }),
  f({
    id: "torricelli", title: "Equação de Torricelli", category: "fisica", topic: "Cinemática",
    latex: tex`v^2 = v_0^2 + 2\,a\,\Delta s`,
    summary: "Relaciona velocidades, aceleração e deslocamento sem precisar do tempo (aceleração constante).",
    vars: [v("v", "v", "velocidade final", "m/s", "nonneg"), v("v0", "v_0", "velocidade inicial", "m/s"), v("a", "a", "aceleração", "m/s²"), v("ds", "\\Delta s", "deslocamento", "m")],
    solvers: [
      solver("Velocidade final (v)", ["v0", "a", "ds"], { s: "v0^2 + 2*a*ds", v: "sqrt(s)" }, [tex`v = \sqrt{v_0^2 + 2a\Delta s}`, tex`v = \sqrt{«v0»^2 + 2\cdot«a»\cdot«ds»} = \sqrt{«=s»} = «=v»`], ["v"],
        [{ when: "v0^2 + 2*a*ds < 0", message: "Com estes valores o corpo não chega a esse deslocamento." }]),
      solver("Deslocamento (Δs)", ["v", "v0", "a"], { ds: "(v^2 - v0^2)/(2*a)" }, [tex`\Delta s = \dfrac{v^2 - v_0^2}{2a}`, tex`\Delta s = \dfrac{«v»^2 - «v0»^2}{2\cdot«a»} = «=ds»`], ["ds"], [{ when: "a == 0", message: "A aceleração não pode ser zero." }]),
    ],
    example: { solver: 0, values: { v0: "0", a: "2", ds: "9" }, expect: { v: 6 } },
  }),
  f({
    id: "queda-livre", title: "Queda livre", category: "fisica", topic: "Cinemática",
    latex: tex`h = \dfrac{g\,t^2}{2} \qquad v = g\,t`,
    summary: "Corpo abandonado a partir do repouso, sem resistência do ar. Use g ≈ 9,8 m/s² (ou 10 m/s² nos exercícios).",
    vars: [v("h", "h", "altura percorrida", "m", "nonneg"), v("t", "t", "tempo de queda", "s", "nonneg"), v("g", "g", "gravidade", "m/s²", "pos", "9.8")],
    solvers: [
      solver("Altura (h) e velocidade final", ["g", "t"], { h: "g*t^2/2", vf: "g*t" }, [tex`h = \dfrac{g\,t^2}{2} = \dfrac{«g»\cdot«t»^2}{2} = «=h»`, tex`v = g\,t = «g»\cdot«t» = «=vf»`], ["h", "vf"]),
      solver("Tempo de queda (t)", ["g", "h"], { t: "sqrt(2*h/g)", vf: "g*t" }, [tex`t = \sqrt{\dfrac{2h}{g}} = \sqrt{\dfrac{2\cdot«h»}{«g»}} = «=t»`, tex`v = g\,t = «g»\cdot«t» = «=vf»`], ["t", "vf"]),
    ],
    example: { solver: 0, values: { g: "10", t: "2" }, expect: { h: 20, vf: 20 } },
  }),
  f({
    id: "newton-2", title: "Segunda lei de Newton", category: "fisica", topic: "Dinâmica",
    latex: tex`F = m\,a`,
    summary: "A força resultante sobre um corpo é o produto da massa pela aceleração. Com m em kg e a em m/s², F sai em newtons (N).",
    vars: [v("F", "F", "força resultante", "N"), v("m", "m", "massa", "kg", "pos"), v("a", "a", "aceleração", "m/s²")],
    solvers: [
      solver("Força (F)", ["m", "a"], { F: "m*a" }, [tex`F = m\,a`, tex`F = «m»\cdot«a» = «=F»`], ["F"]),
      solver("Massa (m)", ["F", "a"], { m: "F/a" }, [tex`m = \dfrac{F}{a}`, tex`m = \dfrac{«F»}{«a»} = «=m»`], ["m"], [{ when: "a == 0", message: "A aceleração não pode ser zero." }]),
      solver("Aceleração (a)", ["F", "m"], { a: "F/m" }, [tex`a = \dfrac{F}{m}`, tex`a = \dfrac{«F»}{«m»} = «=a»`], ["a"]),
    ],
    example: { solver: 0, values: { m: "10", a: "3" }, expect: { F: 30 } },
  }),
  f({
    id: "peso", title: "Peso", category: "fisica", topic: "Dinâmica",
    latex: tex`P = m\,g`,
    summary: "Força com que a gravidade atrai um corpo de massa m. Massa (kg) não é peso (N).",
    vars: [v("P", "P", "peso", "N"), v("m", "m", "massa", "kg", "pos"), v("g", "g", "gravidade", "m/s²", "pos", "9.8")],
    solvers: [
      solver("Peso (P)", ["m", "g"], { P: "m*g" }, [tex`P = m\,g`, tex`P = «m»\cdot«g» = «=P»`], ["P"]),
      solver("Massa (m)", ["P", "g"], { m: "P/g" }, [tex`m = \dfrac{P}{g}`, tex`m = \dfrac{«P»}{«g»} = «=m»`], ["m"]),
    ],
    example: { solver: 0, values: { m: "5", g: "10" }, expect: { P: 50 } },
  }),
  f({
    id: "hooke", title: "Lei de Hooke (mola)", category: "fisica", topic: "Dinâmica",
    latex: tex`F = k\,x`,
    summary: "A força elástica é proporcional à deformação x da mola; k é a constante elástica.",
    vars: [v("F", "F", "força elástica", "N"), v("k", "k", "constante da mola", "N/m", "pos"), v("x", "x", "deformação", "m")],
    solvers: [
      solver("Força (F)", ["k", "x"], { F: "k*x" }, [tex`F = k\,x`, tex`F = «k»\cdot«x» = «=F»`], ["F"]),
      solver("Deformação (x)", ["F", "k"], { x: "F/k" }, [tex`x = \dfrac{F}{k}`, tex`x = \dfrac{«F»}{«k»} = «=x»`], ["x"]),
    ],
    example: { solver: 0, values: { k: "100", x: "0.2" }, expect: { F: 20 } },
  }),
  f({
    id: "trabalho", title: "Trabalho de uma força", category: "fisica", topic: "Energia",
    latex: tex`W = F\,d\cos\theta`,
    summary: "Trabalho (em joules) realizado por uma força F sobre um deslocamento d, com θ o ângulo entre a força e o deslocamento.",
    vars: [v("F", "F", "força", "N"), v("d", "d", "deslocamento", "m"), v("th", "\\theta", "ângulo entre F e d", "°", "nonneg", "0")],
    solvers: [solver("Trabalho (W)", ["F", "d", "th"], { W: "F*d*cos(th*pi/180)" }, [tex`W = F\,d\cos\theta`, tex`W = «F»\cdot«d»\cdot\cos(«th»^\circ) = «=W»`], ["W"])],
    example: { solver: 0, values: { F: "10", d: "5", th: "60" }, expect: { W: 25 } },
  }),
  f({
    id: "energia-cinetica", title: "Energia cinética", category: "fisica", topic: "Energia",
    latex: tex`E_c = \dfrac{m\,v^2}{2}`,
    summary: "Energia associada ao movimento: cresce com o quadrado da velocidade.",
    vars: [v("Ec", "E_c", "energia cinética", "J", "nonneg"), v("m", "m", "massa", "kg", "pos"), v("v", "v", "velocidade", "m/s")],
    solvers: [
      solver("Energia (Ec)", ["m", "v"], { Ec: "m*v^2/2" }, [tex`E_c = \dfrac{m\,v^2}{2}`, tex`E_c = \dfrac{«m»\cdot«v»^2}{2} = «=Ec»`], ["Ec"]),
      solver("Velocidade (v)", ["Ec", "m"], { v: "sqrt(2*Ec/m)" }, [tex`v = \sqrt{\dfrac{2E_c}{m}}`, tex`v = \sqrt{\dfrac{2\cdot«Ec»}{«m»}} = «=v»`], ["v"]),
      solver("Massa (m)", ["Ec", "v"], { m: "2*Ec/v^2" }, [tex`m = \dfrac{2E_c}{v^2}`, tex`m = \dfrac{2\cdot«Ec»}{«v»^2} = «=m»`], ["m"], [{ when: "v == 0", message: "A velocidade não pode ser zero." }]),
    ],
    example: { solver: 0, values: { m: "2", v: "3" }, expect: { Ec: 9 } },
  }),
  f({
    id: "energia-potencial", title: "Energia potencial gravitacional", category: "fisica", topic: "Energia",
    latex: tex`E_p = m\,g\,h`,
    summary: "Energia armazenada por um corpo de massa m a uma altura h.",
    vars: [v("Ep", "E_p", "energia potencial", "J"), v("m", "m", "massa", "kg", "pos"), v("g", "g", "gravidade", "m/s²", "pos", "9.8"), v("h", "h", "altura", "m")],
    solvers: [
      solver("Energia (Ep)", ["m", "g", "h"], { Ep: "m*g*h" }, [tex`E_p = m\,g\,h`, tex`E_p = «m»\cdot«g»\cdot«h» = «=Ep»`], ["Ep"]),
      solver("Altura (h)", ["Ep", "m", "g"], { h: "Ep/(m*g)" }, [tex`h = \dfrac{E_p}{m\,g}`, tex`h = \dfrac{«Ep»}{«m»\cdot«g»} = «=h»`], ["h"]),
    ],
    example: { solver: 0, values: { m: "2", g: "10", h: "5" }, expect: { Ep: 100 } },
  }),
  f({
    id: "potencia-mecanica", title: "Potência", category: "fisica", topic: "Energia",
    latex: tex`P = \dfrac{W}{\Delta t}`,
    summary: "Rapidez com que um trabalho (ou energia) é realizado. 1 watt = 1 joule por segundo.",
    vars: [v("P", "P", "potência", "W"), v("W", "W", "trabalho / energia", "J"), v("dt", "\\Delta t", "intervalo de tempo", "s", "pos")],
    solvers: [
      solver("Potência (P)", ["W", "dt"], { P: "W/dt" }, [tex`P = \dfrac{W}{\Delta t}`, tex`P = \dfrac{«W»}{«dt»} = «=P»`], ["P"]),
      solver("Trabalho (W)", ["P", "dt"], { W: "P*dt" }, [tex`W = P\cdot\Delta t`, tex`W = «P»\cdot«dt» = «=W»`], ["W"]),
    ],
    example: { solver: 0, values: { W: "500", dt: "10" }, expect: { P: 50 } },
  }),
  f({
    id: "pressao", title: "Pressão", category: "fisica", topic: "Hidrostática",
    latex: tex`p = \dfrac{F}{A}`,
    summary: "Força aplicada por unidade de área. Em pascal (Pa): N/m².",
    vars: [v("p", "p", "pressão", "Pa"), v("F", "F", "força", "N"), v("A", "A", "área", "m²", "pos")],
    solvers: [
      solver("Pressão (p)", ["F", "A"], { p: "F/A" }, [tex`p = \dfrac{F}{A}`, tex`p = \dfrac{«F»}{«A»} = «=p»`], ["p"]),
      solver("Força (F)", ["p", "A"], { F: "p*A" }, [tex`F = p\cdot A`, tex`F = «p»\cdot«A» = «=F»`], ["F"]),
    ],
    example: { solver: 0, values: { F: "100", A: "2" }, expect: { p: 50 } },
  }),
  f({
    id: "empuxo", title: "Empuxo (Arquimedes)", category: "fisica", topic: "Hidrostática",
    latex: tex`E = \rho\,g\,V`,
    summary: "Força de baixo para cima sobre um corpo mergulhado em um fluido: densidade do fluido × gravidade × volume deslocado.",
    vars: [v("rho", "\\rho", "densidade do fluido", "kg/m³", "pos"), v("g", "g", "gravidade", "m/s²", "pos", "9.8"), v("V", "V", "volume deslocado", "m³", "pos")],
    solvers: [solver("Empuxo (E)", ["rho", "g", "V"], { E: "rho*g*V" }, [tex`E = \rho\,g\,V`, tex`E = «rho»\cdot«g»\cdot«V» = «=E»`], ["E"])],
    example: { solver: 0, values: { rho: "1000", g: "10", V: "0.002" }, expect: { E: 20 } },
  }),
  f({
    id: "calor-sensivel", title: "Calor sensível", category: "fisica", topic: "Termologia",
    latex: tex`Q = m\,c\,\Delta T`,
    summary: "Quantidade de calor para variar a temperatura de uma massa m, com calor específico c, em ΔT graus.",
    vars: [v("Q", "Q", "calor", "cal"), v("m", "m", "massa", "g", "pos"), v("c", "c", "calor específico", "cal/g·°C", "pos"), v("dT", "\\Delta T", "variação de temperatura", "°C")],
    solvers: [
      solver("Calor (Q)", ["m", "c", "dT"], { Q: "m*c*dT" }, [tex`Q = m\,c\,\Delta T`, tex`Q = «m»\cdot«c»\cdot«dT» = «=Q»`], ["Q"]),
      solver("Variação de temperatura (ΔT)", ["Q", "m", "c"], { dT: "Q/(m*c)" }, [tex`\Delta T = \dfrac{Q}{m\,c}`, tex`\Delta T = \dfrac{«Q»}{«m»\cdot«c»} = «=dT»`], ["dT"]),
    ],
    example: { solver: 0, values: { m: "200", c: "1", dT: "10" }, expect: { Q: 2000 } },
  }),
  f({
    id: "ohm", title: "Primeira lei de Ohm", category: "fisica", topic: "Eletricidade",
    latex: tex`U = R\,i`,
    summary: "A tensão (ddp) U em um resistor é o produto da resistência R pela corrente i.",
    vars: [v("U", "U", "tensão", "V"), v("R", "R", "resistência", "Ω", "pos"), v("i", "i", "corrente", "A")],
    solvers: [
      solver("Tensão (U)", ["R", "i"], { U: "R*i" }, [tex`U = R\,i`, tex`U = «R»\cdot«i» = «=U»`], ["U"]),
      solver("Resistência (R)", ["U", "i"], { R: "U/i" }, [tex`R = \dfrac{U}{i}`, tex`R = \dfrac{«U»}{«i»} = «=R»`], ["R"], [{ when: "i == 0", message: "A corrente não pode ser zero." }]),
      solver("Corrente (i)", ["U", "R"], { i: "U/R" }, [tex`i = \dfrac{U}{R}`, tex`i = \dfrac{«U»}{«R»} = «=i»`], ["i"]),
    ],
    example: { solver: 0, values: { R: "10", i: "2" }, expect: { U: 20 } },
  }),
  f({
    id: "potencia-eletrica", title: "Potência elétrica", category: "fisica", topic: "Eletricidade",
    latex: tex`P = U\,i \;=\; R\,i^2 \;=\; \dfrac{U^2}{R}`,
    summary: "Energia elétrica transformada por segundo. Em watts (W) com U em volts e i em ampères.",
    vars: [v("U", "U", "tensão", "V"), v("i", "i", "corrente", "A"), v("R", "R", "resistência", "Ω", "pos")],
    solvers: [
      solver("Potência (com U e i)", ["U", "i"], { P: "U*i" }, [tex`P = U\,i`, tex`P = «U»\cdot«i» = «=P»`], ["P"]),
      solver("Potência (com R e i)", ["R", "i"], { P: "R*i^2" }, [tex`P = R\,i^2`, tex`P = «R»\cdot«i»^2 = «=P»`], ["P"]),
      solver("Potência (com U e R)", ["U", "R"], { P: "U^2/R" }, [tex`P = \dfrac{U^2}{R}`, tex`P = \dfrac{«U»^2}{«R»} = «=P»`], ["P"]),
    ],
    example: { solver: 0, values: { U: "220", i: "5" }, expect: { P: 1100 } },
  }),
  f({
    id: "ondas", title: "Equação fundamental das ondas", category: "fisica", topic: "Ondulatória",
    latex: tex`v = \lambda\,f \qquad f = \dfrac{1}{T}`,
    summary: "Velocidade da onda = comprimento de onda × frequência. A frequência é o inverso do período T.",
    vars: [v("v", "v", "velocidade", "m/s"), v("lam", "\\lambda", "comprimento de onda", "m", "pos"), v("f", "f", "frequência", "Hz", "pos"), v("T", "T", "período", "s", "pos")],
    solvers: [
      solver("Velocidade (v)", ["lam", "f"], { v: "lam*f" }, [tex`v = \lambda\,f`, tex`v = «lam»\cdot«f» = «=v»`], ["v"]),
      solver("Frequência (a partir do período)", ["T"], { f: "1/T" }, [tex`f = \dfrac{1}{T}`, tex`f = \dfrac{1}{«T»} = «=f»`], ["f"]),
      solver("Período (a partir da frequência)", ["f"], { T: "1/f" }, [tex`T = \dfrac{1}{f}`, tex`T = \dfrac{1}{«f»} = «=T»`], ["T"]),
    ],
    example: { solver: 1, values: { T: "0.5" }, expect: { f: 2 } },
  }),
];

// ---------------------------------------------------------------- Química

const QUIMICA: Formula[] = [
  f({
    id: "densidade", title: "Densidade", category: "quimica", topic: "Propriedades da matéria",
    latex: tex`d = \dfrac{m}{V}`,
    summary: "Massa por unidade de volume (por exemplo, g/cm³ ou kg/m³). É característica de cada substância.",
    vars: [v("d", "d", "densidade", "g/cm³", "pos"), v("m", "m", "massa", "g", "pos"), v("V", "V", "volume", "cm³", "pos")],
    solvers: [
      solver("Densidade (d)", ["m", "V"], { d: "m/V" }, [tex`d = \dfrac{m}{V}`, tex`d = \dfrac{«m»}{«V»} = «=d»`], ["d"]),
      solver("Massa (m)", ["d", "V"], { m: "d*V" }, [tex`m = d\cdot V`, tex`m = «d»\cdot«V» = «=m»`], ["m"]),
      solver("Volume (V)", ["m", "d"], { V: "m/d" }, [tex`V = \dfrac{m}{d}`, tex`V = \dfrac{«m»}{«d»} = «=V»`], ["V"]),
    ],
    example: { solver: 0, values: { m: "200", V: "50" }, expect: { d: 4 } },
  }),
  f({
    id: "mol", title: "Quantidade de matéria (mol)", category: "quimica", topic: "Estequiometria",
    latex: tex`n = \dfrac{m}{M}`,
    summary: "Número de mols (n) é a massa da amostra (m) dividida pela massa molar (M). 1 mol ≈ 6,02 × 10²³ entidades.",
    vars: [v("n", "n", "quantidade de matéria", "mol", "pos"), v("m", "m", "massa", "g", "pos"), v("M", "M", "massa molar", "g/mol", "pos")],
    solvers: [
      solver("Mols (n)", ["m", "M"], { n: "m/M", N: "n*6.02e23" }, [tex`n = \dfrac{m}{M}`, tex`n = \dfrac{«m»}{«M»} = «=n»\ \text{mol}`, tex`N = n\cdot 6{,}02\times 10^{23} = «=N»\ \text{entidades}`], ["n"]),
      solver("Massa (m)", ["n", "M"], { m: "n*M" }, [tex`m = n\cdot M`, tex`m = «n»\cdot«M» = «=m»`], ["m"]),
      solver("Massa molar (M)", ["m", "n"], { M: "m/n" }, [tex`M = \dfrac{m}{n}`, tex`M = \dfrac{«m»}{«n»} = «=M»`], ["M"]),
    ],
    example: { solver: 0, values: { m: "36", M: "18" }, expect: { n: 2 } },
  }),
  f({
    id: "concentracao-molar", title: "Concentração molar (molaridade)", category: "quimica", topic: "Soluções",
    latex: tex`\mathcal{M} = \dfrac{n}{V}`,
    summary: "Mols de soluto por litro de solução (mol/L).",
    vars: [v("C", "\\mathcal{M}", "molaridade", "mol/L", "pos"), v("n", "n", "mols de soluto", "mol", "pos"), v("V", "V", "volume da solução", "L", "pos")],
    solvers: [
      solver("Molaridade", ["n", "V"], { C: "n/V" }, [tex`\mathcal{M} = \dfrac{n}{V}`, tex`\mathcal{M} = \dfrac{«n»}{«V»} = «=C»\ \text{mol/L}`], ["C"]),
      solver("Mols de soluto (n)", ["C", "V"], { n: "C*V" }, [tex`n = \mathcal{M}\cdot V`, tex`n = «C»\cdot«V» = «=n»`], ["n"]),
      solver("Volume (V)", ["n", "C"], { V: "n/C" }, [tex`V = \dfrac{n}{\mathcal{M}}`, tex`V = \dfrac{«n»}{«C»} = «=V»`], ["V"]),
    ],
    example: { solver: 0, values: { n: "2", V: "4" }, expect: { C: 0.5 } },
  }),
  f({
    id: "diluicao", title: "Diluição de soluções", category: "quimica", topic: "Soluções",
    latex: tex`C_1 V_1 = C_2 V_2`,
    summary: "Ao diluir, a quantidade de soluto não muda: concentração inicial × volume inicial = concentração final × volume final.",
    vars: [v("C1", "C_1", "concentração inicial", "mol/L", "pos"), v("V1", "V_1", "volume inicial", "L", "pos"), v("C2", "C_2", "concentração final", "mol/L", "pos"), v("V2", "V_2", "volume final", "L", "pos")],
    solvers: [
      solver("Concentração final (C₂)", ["C1", "V1", "V2"], { C2: "C1*V1/V2" }, [tex`C_2 = \dfrac{C_1 V_1}{V_2}`, tex`C_2 = \dfrac{«C1»\cdot«V1»}{«V2»} = «=C2»`], ["C2"]),
      solver("Volume final (V₂)", ["C1", "V1", "C2"], { V2: "C1*V1/C2" }, [tex`V_2 = \dfrac{C_1 V_1}{C_2}`, tex`V_2 = \dfrac{«C1»\cdot«V1»}{«C2»} = «=V2»`], ["V2"]),
    ],
    example: { solver: 0, values: { C1: "2", V1: "0.5", V2: "2" }, expect: { C2: 0.5 } },
  }),
  f({
    id: "ph", title: "pH e pOH", category: "quimica", topic: "Equilíbrio químico",
    latex: tex`\text{pH} = -\log[\text{H}^+] \qquad \text{pH} + \text{pOH} = 14`,
    summary: "Mede a acidez de uma solução a 25 °C: pH < 7 é ácida, 7 é neutra e > 7 é básica. [H⁺] é a concentração de íons H⁺ em mol/L.",
    vars: [v("H", "[\\text{H}^+]", "concentração de H⁺", "mol/L", "pos"), v("pH", "\\text{pH}", "pH", undefined, "any")],
    solvers: [
      solver("pH (a partir de [H⁺])", ["H"], { pH: "-log(H)", pOH: "14 - pH" },
        [tex`\text{pH} = -\log[\text{H}^+] = -\log(«H») = «=pH»`, tex`\text{pOH} = 14 - \text{pH} = «=pOH»`], ["pH", "pOH"]),
      solver("[H⁺] (a partir do pH)", ["pH"], { H: "10^(-pH)" }, [tex`[\text{H}^+] = 10^{-\text{pH}}`, tex`[\text{H}^+] = 10^{-«pH»} = «=H»\ \text{mol/L}`], ["H"]),
    ],
    example: { solver: 0, values: { H: "0.001" }, expect: { pH: 3, pOH: 11 } },
  }),
  f({
    id: "gases-ideais", title: "Equação dos gases ideais", category: "quimica", topic: "Gases",
    latex: tex`P\,V = n\,R\,T`,
    summary: "Relaciona pressão, volume, mols e temperatura de um gás ideal. Com R = 0,082 use P em atm, V em litros e T em kelvin (K = °C + 273).",
    vars: [v("P", "P", "pressão", "atm", "pos"), v("V", "V", "volume", "L", "pos"), v("n", "n", "mols", "mol", "pos"), v("T", "T", "temperatura", "K", "pos"), v("R", "R", "constante dos gases", "atm·L/(mol·K)", "pos", "0.082")],
    solvers: [
      solver("Pressão (P)", ["n", "R", "T", "V"], { P: "n*R*T/V" }, [tex`P = \dfrac{n\,R\,T}{V}`, tex`P = \dfrac{«n»\cdot«R»\cdot«T»}{«V»} = «=P»`], ["P"]),
      solver("Volume (V)", ["n", "R", "T", "P"], { V: "n*R*T/P" }, [tex`V = \dfrac{n\,R\,T}{P}`, tex`V = \dfrac{«n»\cdot«R»\cdot«T»}{«P»} = «=V»`], ["V"]),
      solver("Temperatura (T)", ["P", "V", "n", "R"], { T: "P*V/(n*R)" }, [tex`T = \dfrac{P\,V}{n\,R}`, tex`T = \dfrac{«P»\cdot«V»}{«n»\cdot«R»} = «=T»`], ["T"]),
      solver("Mols (n)", ["P", "V", "R", "T"], { n: "P*V/(R*T)" }, [tex`n = \dfrac{P\,V}{R\,T}`, tex`n = \dfrac{«P»\cdot«V»}{«R»\cdot«T»} = «=n»`], ["n"]),
    ],
    example: { solver: 0, values: { n: "2", R: "0.082", T: "300", V: "24.6" }, expect: { P: 2 } },
  }),
];

export const FORMULAS: Formula[] = [...MATEMATICA, ...FISICA, ...QUIMICA];

export function formulaById(id: string): Formula | undefined {
  return FORMULAS.find((formula) => formula.id === id);
}

