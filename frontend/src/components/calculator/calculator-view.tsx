"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FunctionPlot } from "@/components/calculator/function-plot";
import { ToolsNav } from "@/components/tools/tools-nav";
import { PageHeader } from "@/components/ui/forms";
import { Button, Card, cx } from "@/components/ui/primitives";
import { calculate, type AngleMode } from "@/lib/calculator";

interface HistoryItem {
  expr: string;
  result: string;
}

const HISTORY_KEY = "estudos-ia:calculadora:historico";
const MAX_HISTORY = 50;

interface Key {
  label: string;
  /** Texto inserido na expressão (padrão: o próprio rótulo). */
  insert?: string;
  aria?: string;
  tone?: "num" | "op" | "fn" | "action";
}

const SCIENTIFIC: Key[] = ([
  { label: "sin", insert: "sin(" }, { label: "cos", insert: "cos(" }, { label: "tan", insert: "tan(" },
  { label: "sin⁻¹", insert: "asin(", aria: "arco seno" }, { label: "cos⁻¹", insert: "acos(", aria: "arco cosseno" }, { label: "tan⁻¹", insert: "atan(", aria: "arco tangente" },
  { label: "ln", insert: "ln(", aria: "logaritmo natural" }, { label: "log", insert: "log(", aria: "logaritmo base 10" }, { label: "eˣ", insert: "exp(", aria: "e elevado a" },
  { label: "√", insert: "sqrt(", aria: "raiz quadrada" }, { label: "x²", insert: "^2", aria: "ao quadrado" }, { label: "xʸ", insert: "^", aria: "potência" },
  { label: "n!", insert: "!", aria: "fatorial" }, { label: "|x|", insert: "abs(", aria: "valor absoluto" }, { label: "mod", insert: " mod " },
  { label: "π", insert: "pi", aria: "pi" }, { label: "e", insert: "e", aria: "número de Euler" }, { label: "ans", insert: "ans", aria: "último resultado" },
] as Key[]).map((k): Key => ({ tone: "fn", ...k }));

const MAIN: Key[] = ([
  { label: "AC", tone: "action", aria: "limpar tudo" }, { label: "⌫", tone: "action", aria: "apagar" }, { label: "(", tone: "op" }, { label: ")", tone: "op" },
  { label: "7" }, { label: "8" }, { label: "9" }, { label: "÷", insert: "/", tone: "op", aria: "dividir" },
  { label: "4" }, { label: "5" }, { label: "6" }, { label: "×", insert: "*", tone: "op", aria: "multiplicar" },
  { label: "1" }, { label: "2" }, { label: "3" }, { label: "−", insert: "-", tone: "op", aria: "subtrair" },
  { label: "0" }, { label: "." }, { label: "%", tone: "op", aria: "porcentagem" }, { label: "+", tone: "op", aria: "somar" },
] as Key[]).map((k): Key => ({ tone: "num", ...k }));

const TONES: Record<NonNullable<Key["tone"]>, string> = {
  num: "bg-surface border border-line hover:bg-surface-2",
  op: "bg-primary-soft text-fg hover:bg-surface-2 border border-line",
  fn: "bg-surface-2 border border-line hover:bg-primary-soft text-[13px]",
  action: "bg-danger-soft text-danger border border-line hover:opacity-90",
};

function loadHistory(): HistoryItem[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((i): i is HistoryItem => typeof i?.expr === "string" && typeof i?.result === "string")
      .slice(0, MAX_HISTORY);
  } catch {
    return [];
  }
}

function saveHistory(items: HistoryItem[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(items));
  } catch {
    /* sem armazenamento (janela privada etc.): o histórico só vale nesta visita */
  }
}

export function CalculatorView() {
  const input = useRef<HTMLInputElement>(null);
  // Variáveis (x = 3, f(t) = ...) e "ans": em estado, para a prévia ao vivo enxergá-las.
  const [vars, setVars] = useState(() => new Map<string, unknown>());
  const [expr, setExpr] = useState("");
  const [angle, setAngle] = useState<AngleMode>("deg");
  const [tab, setTab] = useState<"calc" | "graph">("calc");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [shown, setShown] = useState<{ expr: string; result: string; error?: boolean } | null>(null);
  const [memory, setMemory] = useState<number | null>(null);

  useEffect(() => {
    // localStorage só existe no navegador: carrega depois da primeira renderização.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHistory(loadHistory());
  }, []);

  // Prévia ao vivo: calcula numa cópia, sem gravar variáveis nem "ans".
  const preview = useMemo(() => {
    const r = calculate(expr, { angle, scope: new Map(vars) });
    return r.ok ? { text: r.text } : { error: r.error };
  }, [expr, angle, vars]);

  function insert(text: string) {
    const el = input.current;
    const start = expr === "" ? 0 : (el?.selectionStart ?? expr.length);
    const end = expr === "" ? 0 : (el?.selectionEnd ?? expr.length);
    const base = expr === "" && shown && !shown.error && /^(\^|[+\-*/%!]|\s*mod)/.test(text) ? "ans" : expr;
    const s = base === expr ? start : base.length;
    const e2 = base === expr ? end : base.length;
    setExpr(base.slice(0, s) + text + base.slice(e2));
    const caret = s + text.length;
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(caret, caret);
    });
  }

  function backspace() {
    const el = input.current;
    const start = el?.selectionStart ?? expr.length;
    const end = el?.selectionEnd ?? expr.length;
    const from = start === end ? Math.max(0, start - 1) : start;
    setExpr(expr.slice(0, from) + expr.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(from, from);
    });
  }

  function equals() {
    const nextVars = new Map(vars);
    const r = calculate(expr, { angle, scope: nextVars });
    if (!r.ok) {
      if (!r.empty) setShown({ expr, result: r.error, error: true });
      return;
    }
    setVars(nextVars);
    setShown({ expr, result: r.text });
    const item = { expr: expr.trim(), result: r.text };
    const next = [item, ...history.filter((h) => h.expr !== item.expr || h.result !== item.result)].slice(0, MAX_HISTORY);
    setHistory(next);
    saveHistory(next);
    setExpr(""); // o resultado fica no visor; um operador digitado em seguida continua a partir dele (ans)
  }

  function clearAll() {
    setExpr("");
    setShown(null);
    input.current?.focus();
  }

  function memoryOp(op: "M+" | "M-" | "MR" | "MC") {
    if (op === "MC") return setMemory(null);
    if (op === "MR") return memory !== null && insert(String(memory));
    const base = calculate(expr || "ans", { angle, scope: new Map(vars) });
    const value = base.ok && typeof base.value === "number" ? base.value : null;
    if (value === null) return;
    setMemory((memory ?? 0) + (op === "M+" ? value : -value));
  }

  function press(key: Key) {
    if (key.label === "AC") return clearAll();
    if (key.label === "⌫") return backspace();
    insert(key.insert ?? key.label);
  }

  function clearHistory() {
    setHistory([]);
    saveHistory([]);
  }

  const display = shown && expr === "" ? shown : null;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <PageHeader
        title="Calculadora"
        subtitle="Científica, sem IA: roda no seu navegador. Aceita expressões completas, variáveis, matrizes, números complexos, unidades e gráficos."
      />

      <ToolsNav />

      <div role="tablist" aria-label="Modo" className="inline-flex rounded-lg border border-line p-0.5">
        {([["calc", "Calculadora"], ["graph", "Gráfico"]] as const).map(([id, name]) => (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cx("min-h-9 rounded-md px-4 text-sm font-medium", tab === id ? "bg-primary text-primary-fg" : "hover:bg-surface-2")}
          >
            {name}
          </button>
        ))}
      </div>

      {tab === "graph" ? (
        <Card className="space-y-3">
          <AngleToggle angle={angle} onChange={setAngle} />
          <FunctionPlot angle={angle} />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
          <Card className="min-w-0 space-y-4">
            <div className="min-w-0 rounded-lg bg-surface-2 p-3">
              {display && (
                <p className="truncate text-right text-sm text-muted" title={display.expr}>
                  {display.expr}
                </p>
              )}
              <label htmlFor="calc-expr" className="sr-only">
                Expressão
              </label>
              <input
                id="calc-expr"
                ref={input}
                value={expr}
                onChange={(e) => setExpr(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    equals();
                  } else if (e.key === "Escape") clearAll();
                }}
                placeholder="0"
                maxLength={500}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                inputMode="text"
                className="w-full min-w-0 bg-transparent text-right text-2xl font-medium outline-none placeholder:text-muted"
              />
              <p
                aria-live="polite"
                className={cx(
                  "mt-1 min-h-7 break-all text-right text-xl",
                  display?.error || (!display && "error" in preview && preview.error) ? "text-danger text-base" : "text-primary",
                )}
              >
                {display ? display.result : "text" in preview ? `= ${preview.text}` : preview.error}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <AngleToggle angle={angle} onChange={setAngle} />
              <div className="flex items-center gap-1 text-xs" role="group" aria-label="Memória">
                {(["MC", "MR", "M+", "M-"] as const).map((op) => (
                  <Button key={op} variant="secondary" className="min-h-8 px-2.5" onClick={() => memoryOp(op)} aria-label={`memória ${op}`}>
                    {op}
                  </Button>
                ))}
                {memory !== null && <span className="ml-1 text-muted" title="Valor na memória">M = {String(Number(memory.toPrecision(10)))}</span>}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Funções científicas">
                {SCIENTIFIC.map((k) => (
                  <KeyButton key={k.label} k={k} onPress={press} />
                ))}
              </div>
              <div className="grid grid-cols-4 gap-1.5" role="group" aria-label="Teclado numérico">
                {MAIN.map((k) => (
                  <KeyButton key={k.label} k={k} onPress={press} />
                ))}
                <button
                  type="button"
                  onClick={equals}
                  aria-label="calcular"
                  className="col-span-4 min-h-11 rounded-lg bg-primary text-lg font-semibold text-primary-fg hover:bg-primary-hover"
                >
                  =
                </button>
              </div>
            </div>

            <details className="text-sm text-muted">
              <summary className="cursor-pointer font-medium text-fg">Exemplos e dicas</summary>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li><code>2,5 × (3 + 4)^2</code>: vírgula ou ponto como decimal; <code>×</code> e <code>÷</code> funcionam.</li>
                <li><code>100 + 10%</code> = 110; <code>17 mod 5</code>; <code>12!</code>; <code>combinations(5, 2)</code>.</li>
                <li><code>x = 3</code> guarda a variável; <code>f(t) = t^2 - 4</code> cria uma função; <code>ans</code> é o último resultado.</li>
                <li><code>5 km to m</code>, <code>100 degC to degF</code>: conversão de unidades.</li>
                <li><code>det([1,2;3,4])</code>, <code>inv([1,2;3,4])</code>, <code>[1,2;3,4]*[1,0;0,1]</code>: matrizes.</li>
                <li><code>sqrt(-4)</code>, <code>(1+2i)*(3-i)</code>: números complexos; <code>fraction(0.25)</code>: frações.</li>
              </ul>
            </details>
          </Card>

          <Card className="min-w-0 max-h-[32rem] space-y-2 overflow-auto lg:max-h-none">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Histórico</h2>
              {history.length > 0 && (
                <Button variant="ghost" className="min-h-8 px-2 text-xs" onClick={clearHistory}>
                  Limpar
                </Button>
              )}
            </div>
            {history.length === 0 ? (
              <p className="text-sm text-muted">Os cálculos feitos com “=” aparecem aqui.</p>
            ) : (
              <ul className="space-y-1">
                {history.map((h, i) => (
                  <li key={`${h.expr}-${i}`}>
                    <button
                      type="button"
                      onClick={() => {
                        setShown(null);
                        setExpr(h.expr);
                        input.current?.focus();
                      }}
                      className="w-full rounded-md px-2 py-1.5 text-left hover:bg-surface-2"
                      title="Usar de novo"
                    >
                      <span className="block truncate text-sm text-muted">{h.expr}</span>
                      <span className="block truncate font-medium">= {h.result}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

function KeyButton({ k, onPress }: { k: Key; onPress: (k: Key) => void }) {
  return (
    <button
      type="button"
      aria-label={k.aria}
      onClick={() => onPress(k)}
      className={cx("min-h-11 rounded-lg text-base font-medium transition-colors", TONES[k.tone ?? "num"])}
    >
      {k.label}
    </button>
  );
}

function AngleToggle({ angle, onChange }: { angle: AngleMode; onChange: (m: AngleMode) => void }) {
  return (
    <div role="radiogroup" aria-label="Unidade de ângulo" className="inline-flex rounded-lg border border-line p-0.5 text-sm">
      {([["deg", "Graus"], ["rad", "Radianos"]] as const).map(([id, name]) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={angle === id}
          onClick={() => onChange(id)}
          className={cx("min-h-8 rounded-md px-3 font-medium", angle === id ? "bg-primary text-primary-fg" : "hover:bg-surface-2")}
        >
          {name}
        </button>
      ))}
    </div>
  );
}
