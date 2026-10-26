"use client";

import { useMemo, useState } from "react";
import { ToolsNav } from "@/components/tools/tools-nav";
import { Badge, PageHeader } from "@/components/ui/forms";
import { Card, cx, Field } from "@/components/ui/primitives";
import {
  ELEMENT_CATEGORIES, ELEMENTS, electronConfiguration, normalize, type ChemElement, type ElementCategory,
} from "@/lib/elements";

const MAIN_ROWS = [1, 2, 3, 4, 5, 6, 7];
const GROUPS = Array.from({ length: 18 }, (_, i) => i + 1);

function Cell({ element, selected, dimmed, onSelect }: { element: ChemElement; selected: boolean; dimmed: boolean; onSelect: (z: number) => void }) {
  const color = ELEMENT_CATEGORIES[element.category].color;
  return (
    <button
      type="button"
      onClick={() => onSelect(element.z)}
      aria-label={`${element.name}, número atômico ${element.z}`}
      aria-pressed={selected}
      style={{ borderColor: color, backgroundColor: `${color}22` }}
      className={cx(
        "flex aspect-square min-h-11 w-full min-w-11 flex-col items-center justify-center rounded border text-center leading-none transition-opacity",
        selected && "ring-2 ring-primary",
        dimmed && "opacity-25",
      )}
    >
      <span className="text-[9px] text-muted">{element.z}</span>
      <span className="text-sm font-semibold">{element.symbol}</span>
    </button>
  );
}

export function PeriodicTableView() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ElementCategory | null>(null);
  const [selectedZ, setSelectedZ] = useState(1);

  const q = normalize(query);
  const matches = useMemo(() => {
    const result = new Set<number>();
    for (const e of ELEMENTS) {
      const byText = !q || e.symbol.toLowerCase() === q || String(e.z) === q || normalize(e.name).includes(q);
      if (byText && (!category || e.category === category)) result.add(e.z);
    }
    return result;
  }, [q, category]);

  const element = ELEMENTS[selectedZ - 1];
  const config = electronConfiguration(element.z);
  const byPosition = (period: number, group: number) => ELEMENTS.find((e) => e.period === period && e.group === group);
  const lanthanides = ELEMENTS.filter((e) => e.category === "lantanideo");
  const actinides = ELEMENTS.filter((e) => e.category === "actinideo");

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Tabela periódica" subtitle="Toque em um elemento para ver massa atômica, família, estado físico e distribuição eletrônica." />
      <ToolsNav />

      <div className="mb-4 grid gap-3 sm:grid-cols-[minmax(0,16rem)_1fr] sm:items-end">
        <Field
          label="Buscar elemento"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Nome, símbolo ou número"
          autoComplete="off"
        />
        <div role="group" aria-label="Filtrar por família" className="flex flex-wrap gap-1.5">
          {(Object.keys(ELEMENT_CATEGORIES) as ElementCategory[]).map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={category === c}
              onClick={() => setCategory(category === c ? null : c)}
              className={cx("flex min-h-8 items-center gap-1.5 rounded-full border border-line px-2.5 text-xs", category === c && "bg-surface-2 font-semibold")}
            >
              <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: ELEMENT_CATEGORIES[c].color }} />
              {ELEMENT_CATEGORIES[c].label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="min-w-0 overflow-x-auto rounded-xl border border-line bg-surface p-2">
          <div className="grid min-w-[44rem] gap-1" style={{ gridTemplateColumns: "repeat(18, minmax(0, 1fr))" }}>
            {MAIN_ROWS.flatMap((period) =>
              GROUPS.map((group) => {
                const e = byPosition(period, group);
                if (!e) {
                  // Lantanídeos (6) e actinídeos (7) entram no grupo 3 como um atalho para as linhas de baixo.
                  const marker = group === 3 && (period === 6 || period === 7);
                  return (
                    <div key={`${period}-${group}`} aria-hidden="true" className="flex aspect-square items-center justify-center text-[9px] text-muted">
                      {marker ? (period === 6 ? "57–71" : "89–103") : ""}
                    </div>
                  );
                }
                return <Cell key={e.z} element={e} selected={e.z === selectedZ} dimmed={!matches.has(e.z)} onSelect={setSelectedZ} />;
              }),
            )}
          </div>
          <div className="mt-3 grid min-w-[44rem] gap-1" style={{ gridTemplateColumns: "repeat(18, minmax(0, 1fr))" }}>
            {[lanthanides, actinides].map((row, r) => (
              <div key={r} className="contents">
                <div aria-hidden="true" className="col-span-2 flex items-center justify-end pr-1 text-[9px] text-muted">{r === 0 ? "Lantanídeos" : "Actinídeos"}</div>
                {row.map((e) => (
                  <Cell key={e.z} element={e} selected={e.z === selectedZ} dimmed={!matches.has(e.z)} onSelect={setSelectedZ} />
                ))}
                <div aria-hidden="true" className="col-span-1" />
              </div>
            ))}
          </div>
        </div>

        <Card className="min-w-0 space-y-3" aria-live="polite">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs text-muted">Nº atômico {element.z}</p>
              <h2 className="text-2xl font-semibold">{element.name}</h2>
            </div>
            <span
              className="flex h-16 w-16 items-center justify-center rounded-lg border text-3xl font-bold"
              style={{ borderColor: ELEMENT_CATEGORIES[element.category].color, backgroundColor: `${ELEMENT_CATEGORIES[element.category].color}22` }}
            >
              {element.symbol}
            </span>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
            <dt className="text-muted">Massa atômica</dt>
            <dd>{String(element.mass).replace(".", ",")} u{element.radioactive && ![90, 91, 92].includes(element.z) ? " (nº de massa do isótopo mais estável)" : ""}</dd>
            <dt className="text-muted">Família</dt>
            <dd>{ELEMENT_CATEGORIES[element.category].label}</dd>
            <dt className="text-muted">Período</dt>
            <dd>{element.period}</dd>
            <dt className="text-muted">Grupo</dt>
            <dd>{element.group ?? "—"}</dd>
            <dt className="text-muted">Estado (25 °C)</dt>
            <dd className="capitalize">{element.state}</dd>
            <dt className="text-muted">Camada de valência</dt>
            <dd>{config.valence} elétron{config.valence === 1 ? "" : "s"}</dd>
          </dl>
          {element.radioactive && <Badge tone="warning">Radioativo</Badge>}
          <div>
            <h3 className="mb-1 text-sm font-semibold">Distribuição eletrônica</h3>
            <p className="break-words rounded bg-surface-2 p-2 font-mono text-sm">{config.text}</p>
            <p className="mt-2 text-xs text-muted">
              Por camadas: {config.shells.map((s) => `${s.name} ${s.electrons}`).join(" · ")}
            </p>
            <p className="mt-2 text-xs text-muted">
              Pelo diagrama de Pauling. Alguns elementos (como Cr, Cu, Ag e Au) têm uma distribuição real ligeiramente diferente.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
