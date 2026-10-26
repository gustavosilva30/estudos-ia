"use client";

import { useMemo, useState } from "react";
import { Alert, Field } from "@/components/ui/primitives";
import { samplePlot, type AngleMode, type PlotPoint } from "@/lib/calculator";

const W = 640;
const H = 360;
const PAD = { left: 44, right: 12, top: 12, bottom: 28 };

/** Passo "redondo" (1, 2 ou 5 × 10ⁿ) para os rótulos dos eixos. */
export function niceStep(range: number, targetTicks = 6): number {
  const raw = range / targetTicks;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const f = raw / pow;
  return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * pow;
}

function ticks(min: number, max: number): number[] {
  const step = niceStep(max - min);
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step) out.push(Math.abs(v) < step * 1e-9 ? 0 : v);
  return out;
}

const label = (v: number) => String(Number(v.toPrecision(6)));

/** Divide a curva onde não há valor (assíntotas, fora do domínio) para não ligar pontos que não se conectam. */
export function segments(points: PlotPoint[]): PlotPoint[][] {
  const out: PlotPoint[][] = [];
  let current: PlotPoint[] = [];
  for (const p of points) {
    if (p.y === null) {
      if (current.length) out.push(current);
      current = [];
    } else current.push(p);
  }
  if (current.length) out.push(current);
  return out;
}

export function FunctionPlot({ angle, initial = "sin(x)" }: { angle: AngleMode; initial?: string }) {
  const [expr, setExpr] = useState(initial);
  // Sem valor digitado, o intervalo acompanha o modo de ângulo (em graus, sin(x) só "aparece" em centenas de x).
  const [xMinEdited, setXMin] = useState<string | null>(null);
  const [xMaxEdited, setXMax] = useState<string | null>(null);
  const xMin = xMinEdited ?? (angle === "deg" ? "-360" : "-10");
  const xMax = xMaxEdited ?? (angle === "deg" ? "360" : "10");

  const plot = useMemo(() => samplePlot(expr, Number(xMin), Number(xMax), { angle, samples: 500 }), [expr, xMin, xMax, angle]);

  let body: React.ReactNode;
  if (!plot.ok) {
    body = plot.error ? <Alert>{plot.error}</Alert> : <p className="text-sm text-muted">Digite uma função de x.</p>;
  } else {
    const x0 = Number(xMin);
    const x1 = Number(xMax);
    let { yMin, yMax } = plot.data;
    // Assíntotas deixam y enorme: limita a janela ao que cabe, mantendo a parte "legível" da curva.
    const spanCap = 1e6;
    yMin = Math.max(yMin, -spanCap);
    yMax = Math.min(yMax, spanCap);
    if (yMax - yMin < 1e-9) {
      yMin -= 1;
      yMax += 1;
    }
    const pad = (yMax - yMin) * 0.06;
    yMin -= pad;
    yMax += pad;
    const sx = (x: number) => PAD.left + ((x - x0) / (x1 - x0)) * (W - PAD.left - PAD.right);
    const sy = (y: number) => H - PAD.bottom - ((y - yMin) / (yMax - yMin)) * (H - PAD.top - PAD.bottom);
    const xs = ticks(x0, x1);
    const ys = ticks(yMin, yMax);
    const axisX = yMin <= 0 && yMax >= 0 ? sy(0) : null;
    const axisY = x0 <= 0 && x1 >= 0 ? sx(0) : null;
    body = (
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Gráfico de ${expr}`} className="w-full rounded-lg border border-line bg-surface">
        {xs.map((v) => (
          <g key={`x${v}`}>
            <line x1={sx(v)} x2={sx(v)} y1={PAD.top} y2={H - PAD.bottom} stroke="currentColor" opacity="0.1" />
            <text x={sx(v)} y={H - 10} textAnchor="middle" fontSize="11" fill="currentColor" opacity="0.7">{label(v)}</text>
          </g>
        ))}
        {ys.map((v) => (
          <g key={`y${v}`}>
            <line y1={sy(v)} y2={sy(v)} x1={PAD.left} x2={W - PAD.right} stroke="currentColor" opacity="0.1" />
            <text x={PAD.left - 6} y={sy(v) + 4} textAnchor="end" fontSize="11" fill="currentColor" opacity="0.7">{label(v)}</text>
          </g>
        ))}
        {axisX !== null && <line x1={PAD.left} x2={W - PAD.right} y1={axisX} y2={axisX} stroke="currentColor" opacity="0.55" />}
        {axisY !== null && <line x1={axisY} x2={axisY} y1={PAD.top} y2={H - PAD.bottom} stroke="currentColor" opacity="0.55" />}
        {segments(plot.data.points).map((seg, i) => (
          <polyline
            key={i}
            fill="none"
            stroke="var(--primary)"
            strokeWidth="2"
            strokeLinejoin="round"
            points={seg.map((p) => `${sx(p.x).toFixed(1)},${Math.max(-1e4, Math.min(1e4, sy(p.y as number))).toFixed(1)}`).join(" ")}
          />
        ))}
      </svg>
    );
  }

  return (
    <div className="space-y-3">
      <Field
        label="Função de x"
        value={expr}
        onChange={(e) => setExpr(e.target.value)}
        placeholder="x^2 - 4"
        maxLength={200}
        autoComplete="off"
        spellCheck={false}
        hint="Exemplos: sin(x), x^3 - 2x, 1/x, sqrt(x), exp(-x^2). Usa o modo de ângulo da calculadora."
      />
      <div className="grid grid-cols-2 gap-3">
        <Field label="x mínimo" type="number" value={xMin} onChange={(e) => setXMin(e.target.value)} />
        <Field label="x máximo" type="number" value={xMax} onChange={(e) => setXMax(e.target.value)} />
      </div>
      {body}
    </div>
  );
}
