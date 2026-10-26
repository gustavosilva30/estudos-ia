import type { Category, Formula, Solver } from "@/lib/formula-engine";
import { GUIDES_FISICA } from "@/lib/guides-fis";
import { GUIDES_MATEMATICA } from "@/lib/guides-mat";
import { GUIDES_QUIMICA } from "@/lib/guides-qui";

/**
 * Conteúdo didático de cada fórmula do catálogo. Textos aceitam matemática entre `$...$` (LaTeX), por exemplo
 * "a hipotenusa é $c$". Evite usar `$` para dinheiro: escreva "reais".
 */
export interface Guide {
  /** Como a fórmula funciona e de onde vem (2 a 4 frases). */
  how: string;
  /** Quando usar (e quando NÃO usar). */
  when: string;
  /** Macetes e facilitadores. */
  tips: string[];
  /** Regras, condições e erros comuns. */
  watch: string[];
  /** Frase curta para memorizar. */
  remember?: string;
  /** Passos específicos por solver (índice do solver). Sem isso, mostramos passos gerais montados automaticamente. */
  solve?: Record<number, string[]>;
  /** Ids de fórmulas relacionadas (para estudar junto). */
  related?: string[];
}

export const GUIDES: Record<string, Guide> = { ...GUIDES_MATEMATICA, ...GUIDES_FISICA, ...GUIDES_QUIMICA };

export function guideFor(formula: Pick<Formula, "id" | "custom">): Guide | undefined {
  return formula.custom ? undefined : GUIDES[formula.id];
}

/** Método geral de resolução, mostrado quando nenhuma fórmula está aberta. */
export const GENERAL_METHOD: Record<Exclude<Category, "outra">, { title: string; steps: string[]; tips: string[] }> = {
  matematica: {
    title: "Como resolver problemas de Matemática",
    steps: [
      "Leia o enunciado duas vezes e diga com as suas palavras o que se pede.",
      "Faça um desenho ou esquema sempre que houver figuras, trajetos ou conjuntos.",
      "Liste os dados e dê um nome (letra) a cada um, inclusive à incógnita.",
      "Escolha a fórmula que liga os dados ao que se pede e confira as condições dela (por exemplo, triângulo retângulo).",
      "Isole a incógnita ANTES de substituir os números: fica mais fácil achar erros.",
      "Substitua os valores usando parênteses nos negativos e calcule na ordem: parênteses, potências e raízes, multiplicação e divisão, soma e subtração.",
      "Teste a resposta: ela faz sentido (lado positivo, probabilidade entre 0 e 1, raiz que satisfaz a equação)?",
    ],
    tips: [
      "Unidades primeiro: não misture centímetros com metros nem graus com radianos.",
      "Em equações, a resposta pode ser conferida substituindo-a de volta: é a melhor prova.",
      "Arredonde só no final; use as casas decimais da calculadora durante as contas.",
      "Quando travar, tente um caso simples (números pequenos) para enxergar o padrão.",
    ],
  },
  fisica: {
    title: "Como resolver problemas de Física",
    steps: [
      "Leia o enunciado e identifique o fenômeno (movimento, força, energia, calor, eletricidade...).",
      "Desenhe a situação e marque as grandezas: forças, velocidades, sentidos e referenciais.",
      "Liste os dados COM UNIDADES e converta tudo para o Sistema Internacional (m, kg, s, N, J, W, K...).",
      "Escolha a fórmula pelo que se conhece e pelo que se pede (cada fórmula liga certas grandezas).",
      "Isole a grandeza desejada, substitua os valores e calcule.",
      "Confira a unidade do resultado: ela deve ser a da grandeza pedida (por exemplo, N para força).",
      "Julgue a ordem de grandeza: um carro a 3000 m/s ou uma massa negativa indicam erro de conta ou de unidade.",
    ],
    tips: [
      "km/h para m/s: divida por 3,6. De m/s para km/h: multiplique por 3,6.",
      "Dimensões ajudam: a unidade dos dois lados da fórmula precisa ser a mesma.",
      "Use g = 9,8 m/s² (ou 10 m/s², se o enunciado mandar) e deixe isso claro na resposta.",
      "Sinais importam: defina o sentido positivo no começo e mantenha até o fim.",
    ],
  },
  quimica: {
    title: "Como resolver problemas de Química",
    steps: [
      "Leia o enunciado e identifique o assunto (soluções, gases, estequiometria, termoquímica, equilíbrio...).",
      "Escreva (e BALANCEIE) a equação química quando houver reação.",
      "Liste os dados com unidades e consulte as massas atômicas na tabela periódica quando precisar.",
      "Converta tudo para mol sempre que possível: o mol é a 'moeda' que liga massa, volume de gás e partículas.",
      "Escolha a fórmula ou a regra de três adequada e isole a incógnita.",
      "Use temperatura em kelvin (K = °C + 273) nas fórmulas dos gases e pressão e volume em unidades coerentes com R.",
      "Confira a unidade e o sentido do resultado (concentração positiva, pH entre 0 e 14 em água a 25 °C, rendimento até 100%).",
    ],
    tips: [
      "Massa molar = soma das massas atômicas dos átomos da fórmula (ex.: H₂O = 2·1 + 16 = 18 g/mol).",
      "1 mol = 6,02 · 10²³ entidades e, nas CNTP, 22,4 L de gás.",
      "Em estequiometria, os coeficientes da equação balanceada são a proporção em MOL.",
      "Diluir não muda a quantidade de soluto: o que muda é o volume e, portanto, a concentração.",
    ],
  },
};

/** Passos gerais para um solver, montados a partir das variáveis e das unidades dele. */
export function genericSteps(formula: Formula, solver: Solver): string[] {
  const byId = new Map(formula.vars.map((v) => [v.id, v]));
  const data = solver.needs.map((id) => {
    const v = byId.get(id)!;
    return `${v.name}${v.unit ? ` (${v.unit})` : ""}`;
  });
  const conditions = solver.needs
    .map((id) => byId.get(id)!)
    .filter((v) => v.domain === "pos" || v.domain === "nonnegint")
    .map((v) => `${v.name} ${v.domain === "pos" ? "precisa ser maior que zero" : "precisa ser um número inteiro, zero ou maior"}`);
  const steps = [
    `Anote os dados que você precisa: ${data.join("; ")}.`,
    "Confira as unidades e converta o que for necessário para que todas sejam compatíveis.",
    `Escreva a fórmula isolando o que você quer descobrir (${solver.label}).`,
    "Substitua os valores (use parênteses nos números negativos).",
    "Calcule na ordem certa: parênteses, potências e raízes, multiplicação e divisão, soma e subtração.",
    "Confira o resultado: unidade correta, sinal coerente e ordem de grandeza razoável.",
  ];
  if (conditions.length) steps.splice(2, 0, `Cuidado com as condições: ${conditions.join("; ")}.`);
  return steps;
}

/** Passos específicos (quando o guia os traz) ou gerais. */
export function stepsFor(formula: Formula, solverIndex: number): { steps: string[]; custom: boolean } {
  const specific = guideFor(formula)?.solve?.[solverIndex];
  if (!specific) return { steps: genericSteps(formula, formula.solvers[solverIndex]), custom: false };
  if (specific.length >= 3) return { steps: specific, custom: true };
  // Roteiros curtos ganham o começo (dados e unidades) e o fim (conferência) para ficarem completos.
  const solver = formula.solvers[solverIndex];
  const names = solver.needs.map((id) => formula.vars.find((v) => v.id === id)?.name ?? id);
  return {
    steps: [
      `Anote os dados: ${names.join("; ")} (todos na mesma base de unidades).`,
      ...specific,
      "Confira o resultado: unidade correta, sinal coerente e ordem de grandeza razoável.",
    ],
    custom: true,
  };
}
