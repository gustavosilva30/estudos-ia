"use client";

import { useState } from "react";
import { ToolsNav } from "@/components/tools/tools-nav";
import { PageHeader, Select } from "@/components/ui/forms";
import { Button, Card, cx, Field } from "@/components/ui/primitives";
import {
  QUANTITIES, TEMPERATURE_UNITS, convert, convertTemperature, formatConverted, parseNumber, type TemperatureUnit,
} from "@/lib/converter";

const ALL = [...QUANTITIES.map((q) => ({ id: q.id, label: q.label })), { id: "temperatura", label: "Temperatura" }];

export function ConverterView() {
  const [quantityId, setQuantityId] = useState("comprimento");
  const [fromId, setFromId] = useState("m");
  const [toId, setToId] = useState("km");
  const [text, setText] = useState("1");

  const isTemp = quantityId === "temperatura";
  const quantity = QUANTITIES.find((q) => q.id === quantityId);
  const units = isTemp ? TEMPERATURE_UNITS.map((t) => ({ id: t.id, label: t.label, symbol: t.symbol })) : (quantity?.units ?? []);

  function selectQuantity(id: string) {
    setQuantityId(id);
    const list = id === "temperatura" ? TEMPERATURE_UNITS.map((t) => t.id as string) : (QUANTITIES.find((q) => q.id === id)?.units.map((u) => u.id) ?? []);
    setFromId(list[0]);
    setToId(list[1] ?? list[0]);
  }

  const value = parseNumber(text);
  const fromQuantityUnit = quantity?.units.find((u) => u.id === fromId);

  // Valor da pessoa expresso em cada unidade da grandeza (cálculo barato: não precisa de memoização).
  const converted = (targetId: string): number | null => {
    if (value === null) return null;
    if (isTemp) return convertTemperature(value, fromId as TemperatureUnit, targetId as TemperatureUnit);
    const target = quantity?.units.find((u) => u.id === targetId);
    return fromQuantityUnit && target ? convert(value, fromQuantityUnit, target) : null;
  };
  const result = converted(toId);
  const fromUnit = units.find((u) => u.id === fromId);
  const toUnit = units.find((u) => u.id === toId);
  const table = value === null ? [] : units.map((u) => ({ unit: u, value: converted(u.id) ?? Number.NaN }));

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Conversor de unidades" subtitle="Converta entre unidades de comprimento, massa, tempo, temperatura, pressão, energia, dados e mais." />
      <ToolsNav />
      <div role="group" aria-label="Grandeza" className="mb-4 flex flex-wrap gap-1.5">
        {ALL.map((q) => (
          <button
            key={q.id}
            type="button"
            aria-pressed={quantityId === q.id}
            onClick={() => selectQuantity(q.id)}
            className={cx("min-h-9 rounded-full border border-line px-3 text-sm font-medium", quantityId === q.id ? "bg-primary text-primary-fg" : "hover:bg-surface-2")}
          >
            {q.label}
          </button>
        ))}
      </div>

      <Card className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_1fr] sm:items-end">
          <Field label="Valor" inputMode="decimal" value={text} onChange={(e) => setText(e.target.value)} placeholder="1" autoComplete="off" error={text.trim() !== "" && value === null ? "Digite um número." : null} />
          <Select label="De" value={fromId} onChange={(e) => setFromId(e.target.value)}>
            {units.map((u) => (
              <option key={u.id} value={u.id}>{u.label} ({u.symbol})</option>
            ))}
          </Select>
          <Button
            variant="secondary"
            className="sm:mb-0"
            aria-label="Inverter as unidades"
            onClick={() => {
              setFromId(toId);
              setToId(fromId);
            }}
          >
            ⇄
          </Button>
          <Select label="Para" value={toId} onChange={(e) => setToId(e.target.value)}>
            {units.map((u) => (
              <option key={u.id} value={u.id}>{u.label} ({u.symbol})</option>
            ))}
          </Select>
        </div>

        <div aria-live="polite" className="rounded-lg bg-surface-2 p-4 text-center">
          {result === null ? (
            <p className="text-muted">Digite um valor para converter.</p>
          ) : (
            <p className="text-lg">
              <span className="text-muted">{formatConverted(value as number)} {fromUnit?.symbol} =</span>{" "}
              <span className="text-2xl font-semibold text-primary">{formatConverted(result)}</span>{" "}
              <span>{toUnit?.symbol}</span>
            </p>
          )}
        </div>

        {table.length > 0 && (
          <details>
            <summary className="cursor-pointer text-sm font-medium">Ver em todas as unidades</summary>
            <table className="mt-2 w-full text-sm">
              <caption className="sr-only">Valor em todas as unidades</caption>
              <tbody>
                {table.map((row) => (
                  <tr key={row.unit.id} className="border-t border-line">
                    <th scope="row" className="py-1.5 text-left font-normal text-muted">{row.unit.label}</th>
                    <td className="py-1.5 text-right font-mono">{formatConverted(row.value)} {row.unit.symbol}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        )}
      </Card>
    </div>
  );
}
