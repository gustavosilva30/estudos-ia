import {
  absDependencies,
  acosDependencies,
  acoshDependencies,
  addDependencies,
  asinDependencies,
  asinhDependencies,
  atan2Dependencies,
  atanDependencies,
  atanhDependencies,
  cbrtDependencies,
  ceilDependencies,
  combinationsDependencies,
  complexDependencies,
  conjDependencies,
  cosDependencies,
  coshDependencies,
  create,
  crossDependencies,
  cubeDependencies,
  detDependencies,
  divideDependencies,
  dotDependencies,
  dotDivideDependencies,
  dotMultiplyDependencies,
  dotPowDependencies,
  eDependencies,
  evaluateDependencies,
  expDependencies,
  factorialDependencies,
  fixDependencies,
  floorDependencies,
  fractionDependencies,
  gammaDependencies,
  gcdDependencies,
  hypotDependencies,
  iDependencies,
  imDependencies,
  invDependencies,
  isPrimeDependencies,
  lcmDependencies,
  log10Dependencies,
  log2Dependencies,
  logDependencies,
  matrixDependencies,
  maxDependencies,
  meanDependencies,
  medianDependencies,
  minDependencies,
  modDependencies,
  multiplyDependencies,
  nthRootDependencies,
  permutationsDependencies,
  piDependencies,
  powDependencies,
  prodDependencies,
  reDependencies,
  roundDependencies,
  signDependencies,
  sinDependencies,
  sinhDependencies,
  sqrtDependencies,
  squareDependencies,
  stdDependencies,
  subtractDependencies,
  sumDependencies,
  tanDependencies,
  tanhDependencies,
  toDependencies,
  traceDependencies,
  transposeDependencies,
  unaryMinusDependencies,
  unitDependencies,
  varianceDependencies,
  argDependencies,
  format as formatValue,
  type MathJsInstance,
} from "mathjs";

/**
 * Motor da calculadora. Roda inteiramente no navegador, sem IA e sem `eval`.
 *
 * Segurança: só as funções listadas abaixo existem para quem digita a expressão (nada de `import`, `createUnit`,
 * `evaluate`, `parse`, `simplify`, e sem funções que criam matrizes ou intervalos gigantes, como `ones` ou `1:1e9`).
 * O tamanho da expressão também é limitado.
 */

export type AngleMode = "deg" | "rad";
export const MAX_EXPRESSION_LENGTH = 500;
export const MAX_FACTORIAL = 170; // acima disso o resultado já é infinito em ponto flutuante

const math: MathJsInstance = create({
  absDependencies, acosDependencies, acoshDependencies, addDependencies, asinDependencies, asinhDependencies,
  atan2Dependencies, atanDependencies, atanhDependencies, cbrtDependencies, ceilDependencies,
  combinationsDependencies, complexDependencies, conjDependencies, cosDependencies, coshDependencies,
  crossDependencies, cubeDependencies, detDependencies, divideDependencies, dotDependencies,
  dotDivideDependencies, dotMultiplyDependencies, dotPowDependencies, eDependencies, evaluateDependencies,
  expDependencies, factorialDependencies, fixDependencies, floorDependencies, fractionDependencies,
  gammaDependencies, gcdDependencies, hypotDependencies, iDependencies, imDependencies, invDependencies,
  isPrimeDependencies, lcmDependencies, log10Dependencies, log2Dependencies, logDependencies, matrixDependencies,
  maxDependencies, meanDependencies, medianDependencies, minDependencies, modDependencies, multiplyDependencies,
  nthRootDependencies, permutationsDependencies, piDependencies, powDependencies, prodDependencies,
  reDependencies, roundDependencies, signDependencies, sinDependencies, sinhDependencies, sqrtDependencies,
  squareDependencies, stdDependencies, subtractDependencies, sumDependencies, tanDependencies, tanhDependencies,
  toDependencies, traceDependencies, transposeDependencies, unaryMinusDependencies, unitDependencies,
  varianceDependencies, argDependencies,
});

// Guarda o que este módulo precisa e bloqueia, para as expressões, TODA função fora da lista abaixo (incluindo as
// que o motor cria só por dependência interna, como `identity`, que alocaria uma matriz gigante). As dependências
// internas do motor não passam pelo nome e continuam funcionando.
const evaluateInternal = math.evaluate.bind(math);
const parseInternal = math.parse.bind(math);
const importInternal = math.import.bind(math);
// Estas servem ao próprio motor enquanto o bloqueio é aplicado: ficam por último ou fora da lista.
const ENGINE_INTERNALS = new Set(["import", "typed", "create", "factory", "emit", "on", "off", "once"]);
const blocked = () => {
  throw new Error("Função não permitida.");
};
const ALLOWED = new Set(
  (
    "abs acos acosh add arg asin asinh atan atan2 atanh cbrt ceil combinations complex conj cos cosh cross cube det " +
    "divide dot dotDivide dotMultiply dotPow exp factorial fix floor fraction gamma gcd hypot im inv isPrime lcm log " +
    "log10 log2 matrix max mean median min mod multiply nthRoot permutations pow prod re round sign sin sinh sqrt " +
    "square std subtract sum tan tanh to trace transpose unaryMinus unit variance"
  ).split(" "),
);
const MAX_COMBINATORIAL = 10_000; // C(1e9, 5e8) levaria minutos: números de combinatória ficam limitados

function guardedCombinatorial(name: "combinations" | "permutations") {
  const original = math[name] as (...args: unknown[]) => unknown;
  return (...args: unknown[]) => {
    if (args.some((a) => typeof a === "number" && Math.abs(a) > MAX_COMBINATORIAL)) {
      throw new Error("Função não permitida: número grande demais.");
    }
    return original(...args);
  };
}

const overrides: Record<string, unknown> = {};
for (const key of Object.keys(math)) {
  // Classes internas (Unit, Matrix...) começam com maiúscula e o motor precisa delas; funções começam com minúscula.
  if (/^[a-z]/.test(key) && typeof (math as unknown as Record<string, unknown>)[key] === "function" && !ALLOWED.has(key) && !ENGINE_INTERNALS.has(key)) {
    overrides[key] = blocked;
  }
}
overrides.combinations = guardedCombinatorial("combinations");
overrides.permutations = guardedCombinatorial("permutations");
importInternal(overrides, { override: true });
importInternal({ import: blocked }, { override: true }); // por último: impede que expressões reconfigurem o motor

type Num = number;
const toRad = (x: Num) => (x * Math.PI) / 180;
const toDeg = (x: Num) => (x * 180) / Math.PI;

const TRIG_NAMES = new Set(["sin", "cos", "tan", "asin", "acos", "atan", "atan2"]);

/** Em graus, as funções trigonométricas convertem a entrada (e a saída, nas inversas). Outros tipos seguem o padrão. */
function trigScope(mode: AngleMode): Record<string, (...args: unknown[]) => unknown> {
  if (mode === "rad") return {};
  const direct = (name: "sin" | "cos" | "tan") => (x: unknown) =>
    typeof x === "number" ? (math[name] as (v: unknown) => unknown)(toRad(x)) : (math[name] as (v: unknown) => unknown)(x);
  const inverse = (name: "asin" | "acos" | "atan") => (x: unknown) => {
    const result = (math[name] as (v: unknown) => unknown)(x);
    return typeof result === "number" ? toDeg(result) : result;
  };
  return {
    sin: direct("sin"), cos: direct("cos"), tan: direct("tan"),
    asin: inverse("asin"), acos: inverse("acos"), atan: inverse("atan"),
    atan2: (y: unknown, x: unknown) => {
      const r = (math.atan2 as (a: unknown, b: unknown) => unknown)(y, x);
      return typeof r === "number" ? toDeg(r) : r;
    },
  };
}

/**
 * Vírgula entre dígitos vira ponto decimal (2,5), exceto quando separa argumentos: dentro de uma chamada de função
 * `max(1,2)` ou de uma matriz `[1,2;3,4]`. Parênteses comuns e o nível principal usam a vírgula como decimal.
 */
function decimalCommas(s: string): string {
  const stack: boolean[] = []; // true = delimitador cuja vírgula separa argumentos
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "(") stack.push(/[A-Za-z_]\w*\s*$/.test(out));
    else if (c === "[") stack.push(true);
    else if (c === ")" || c === "]") stack.pop();
    const separator = stack.length > 0 && stack[stack.length - 1];
    out += c === "," && !separator && /\d/.test(s[i - 1] ?? "") && /\d/.test(s[i + 1] ?? "") ? "." : c;
  }
  return out;
}

/** Deixa o que a pessoa digita no formato do motor: símbolos do teclado, vírgula decimal e atalhos. */
export function normalizeExpression(input: string): string {
  const s = input
    .replace(/[×·]/g, "*")
    .replace(/÷/g, "/")
    .replace(/[−–]/g, "-")
    .replace(/π/g, "pi")
    .replace(/√\s*\(/g, "sqrt(")
    .replace(/√\s*([0-9.]+|[a-z]+)/gi, "sqrt($1)")
    .replace(/²/g, "^2")
    .replace(/³/g, "^3")
    // "ln" é o logaritmo natural (log do motor) e "log" é de base 10, como nas calculadoras comuns.
    .replace(/\blog\s*\(/gi, "\u0001(")
    .replace(/\bln\s*\(/gi, "log(")
    .replace(/\u0001\(/g, "log10(");
  // Vírgula entre dígitos é decimal (2,5), exceto quando há chamada de função ou matriz (max(1,2), [1,2]).
  return decimalCommas(s);
}

export type EvalResult =
  | { ok: true; text: string; value: unknown }
  | { ok: false; error: string; empty?: boolean };

function describeError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  const symbol = /Undefined symbol (\S+)/.exec(message)?.[1];
  if (symbol) return /^[A-Za-z_]\w*$/.test(symbol) ? `"${symbol}" não existe.` : "Expressão inválida.";
  if (/Undefined function (\w+)/.test(message)) return `A função "${/Undefined function (\w+)/.exec(message)![1]}" não existe.`;
  if (/Unexpected end of expression|Value expected|Parenthesis \) expected/i.test(message)) return "Expressão incompleta.";
  if (/Unexpected type of argument|Too (few|many) arguments/i.test(message)) return "Argumentos inválidos para a função.";
  if (/Unexpected operator|Unexpected part|Syntax error|Unexpected character|Invalid left hand|is not allowed|not allowed/i.test(message)) {
    return /não permitida|not allowed/i.test(message) ? "Esta função não é permitida." : "Expressão inválida.";
  }
  if (/Dimension mismatch|Units do not match|Cannot convert/i.test(message)) return "As unidades ou dimensões não combinam.";
  if (/Cannot calculate inverse|Cannot calculate determinant|singular/i.test(message)) return "A matriz não tem inversa.";
  return "Não foi possível calcular.";
}

/** Formata para exibição: 12 dígitos significativos, notação científica só para valores muito grandes/pequenos. */
export function formatResult(value: unknown): string {
  if (typeof value === "number") {
    if (Number.isNaN(value)) return "indefinido";
    if (!Number.isFinite(value)) return value > 0 ? "∞" : "-∞";
  }
  if (typeof value === "number" && Number.isSafeInteger(value) && Math.abs(value) < 1e15) return String(value);
  if (value === undefined || value === null) return "";
  if (typeof value === "function") return "função definida";
  return formatValue(value as never, { precision: 12, lowerExp: -9, upperExp: 12 });
}

/**
 * Calcula uma expressão. `scope` guarda variáveis (x = 3, f(x) = x^2) e `ans`; é alterado pelas atribuições.
 * Erros viram mensagens em português; nunca lançam.
 */
export function calculate(
  input: string,
  options: { angle: AngleMode; scope: Map<string, unknown> },
): EvalResult {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, error: "", empty: true };
  if (trimmed.length > MAX_EXPRESSION_LENGTH) return { ok: false, error: `Expressão longa demais (máx. ${MAX_EXPRESSION_LENGTH} caracteres).` };
  const expression = normalizeExpression(trimmed);
  const factorials = [...expression.matchAll(/(\d+(?:\.\d+)?)\s*!/g)].map((m) => Number(m[1]));
  if (factorials.some((n) => n > MAX_FACTORIAL)) return { ok: true, value: Infinity, text: "∞" };
  // Um escopo temporário por cálculo: variáveis do usuário valem, mas as funções de ângulo não são "salvas" nele.
  const scope = new Map<string, unknown>(options.scope);
  for (const [name, fn] of Object.entries(trigScope(options.angle))) scope.set(name, fn);
  try {
    const value = evaluateInternal(expression, scope);
    // Guarda só as variáveis do usuário (não as funções de ângulo do modo graus).
    for (const [name, v] of scope) if (!TRIG_NAMES.has(name)) options.scope.set(name, v);
    const text = formatResult(value);
    if (value !== undefined && typeof value !== "function") options.scope.set("ans", value);
    return { ok: true, value, text };
  } catch (err) {
    return { ok: false, error: describeError(err) };
  }
}

// ---------- gráfico ----------

export interface PlotPoint {
  x: number;
  y: number | null; // null = sem valor (fora do domínio, infinito ou complexo): quebra a linha
}

export interface PlotData {
  points: PlotPoint[];
  yMin: number;
  yMax: number;
}

/** Amostra f(x) entre xMin e xMax. Expressão em `x`, por exemplo "sin(x)/x" ou "x^2 - 4". */
export function samplePlot(
  input: string,
  xMin: number,
  xMax: number,
  options: { angle: AngleMode; samples?: number; scope?: Map<string, unknown> },
): { ok: true; data: PlotData } | { ok: false; error: string } {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, error: "" };
  if (trimmed.length > MAX_EXPRESSION_LENGTH) return { ok: false, error: "Expressão longa demais." };
  if (!Number.isFinite(xMin) || !Number.isFinite(xMax) || xMin >= xMax) return { ok: false, error: "O intervalo de x é inválido." };
  const samples = Math.min(Math.max(options.samples ?? 400, 2), 2000);
  let compiled: { evaluate: (scope: Map<string, unknown>) => unknown };
  try {
    compiled = parseInternal(normalizeExpression(trimmed.replace(/^\s*(y|f\(x\))\s*=/i, ""))).compile() as typeof compiled;
  } catch (err) {
    return { ok: false, error: describeError(err) };
  }
  const scope = new Map<string, unknown>(options.scope ?? []);
  for (const [name, fn] of Object.entries(trigScope(options.angle))) scope.set(name, fn);
  const points: PlotPoint[] = [];
  let yMin = Infinity;
  let yMax = -Infinity;
  let failures = 0;
  for (let i = 0; i < samples; i++) {
    const x = xMin + ((xMax - xMin) * i) / (samples - 1);
    scope.set("x", x);
    let y: number | null = null;
    try {
      const v = compiled.evaluate(scope);
      if (typeof v === "number" && Number.isFinite(v)) y = v;
    } catch {
      failures++;
      if (failures === 1 && i === 0 && samples > 1) {
        // Erro já no primeiro ponto costuma ser expressão inválida (não domínio): confirma em mais um ponto.
        scope.set("x", xMin + (xMax - xMin) / 2);
        try {
          compiled.evaluate(scope);
        } catch (err2) {
          return { ok: false, error: describeError(err2) };
        }
      }
    }
    if (y !== null) {
      yMin = Math.min(yMin, y);
      yMax = Math.max(yMax, y);
    }
    points.push({ x, y });
  }
  if (!Number.isFinite(yMin)) return { ok: false, error: "A função não tem valores reais nesse intervalo." };
  return { ok: true, data: { points, yMin, yMax } };
}
