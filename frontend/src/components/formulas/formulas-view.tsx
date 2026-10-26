"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { CustomFormulaForm } from "@/components/formulas/custom-formula-form";
import { GeneralMethodCard, GuideCard, SolveSteps } from "@/components/formulas/formula-guide";
import { FormulaLessons } from "@/components/formulas/formula-lessons";
import { Tex } from "@/components/formulas/tex";
import { ToolsNav } from "@/components/tools/tools-nav";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Badge, EmptyState, Modal, PageHeader, Select, Textarea } from "@/components/ui/forms";
import { EditIcon, PlusIcon, StarIcon, TrashIcon } from "@/components/ui/icons";
import { Alert, Button, Card, cx, Field } from "@/components/ui/primitives";
import { api } from "@/lib/api";
import {
  categoryLabel, CATEGORIES, formulaKey, searchFormulas, solveFormula, type Category, type Formula,
} from "@/lib/formula-engine";
import { customToFormula, draftFromCustom, draftToBody, EMPTY_DRAFT, type CustomDraft } from "@/lib/formula-custom";
import { FORMULAS } from "@/lib/formulas";
import type { CustomFormulaData, FormulaMark } from "@/lib/types";
import { errorMessage, useApi } from "@/lib/use-api";

type Filter = Category | "todas" | "favoritas" | "minhas";

export function FormulasView() {
  const initialKey = useSearchParams().get("f");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("todas");
  const [selectedKey, setSelectedKey] = useState<string | null>(initialKey);
  const [editing, setEditing] = useState<CustomFormulaData | "new" | null>(null);

  const marksApi = useApi<FormulaMark[]>("/formulas/marks");
  const customApi = useApi<CustomFormulaData[]>("/formulas/custom");
  const marks = useMemo(() => new Map((marksApi.data ?? []).map((m) => [m.formula_key, m])), [marksApi.data]);
  const customs = useMemo(() => customApi.data ?? [], [customApi.data]);
  const all = useMemo(() => [...FORMULAS, ...customs.map(customToFormula)], [customs]);

  const results = useMemo(() => {
    const category: Category | "todas" = filter === "favoritas" || filter === "minhas" ? "todas" : filter;
    return searchFormulas(all, query, category).filter((f) => {
      if (filter === "favoritas") return marks.get(formulaKey(f))?.is_favorite;
      if (filter === "minhas") return f.custom;
      return true;
    });
  }, [all, query, filter, marks]);

  const selected = all.find((f) => formulaKey(f) === selectedKey) ?? null;

  function select(key: string | null) {
    setSelectedKey(key);
    // Mantém o endereço compartilhável (/formulas?f=...) sem recarregar a página.
    window.history.replaceState(null, "", key ? `/formulas?f=${encodeURIComponent(key)}` : "/formulas");
  }

  const filters: { id: Filter; label: string }[] = [
    { id: "todas", label: "Todas" },
    ...CATEGORIES.map((c) => ({ id: c.id as Filter, label: c.label })),
    { id: "favoritas", label: "Favoritas" },
    { id: "minhas", label: "Minhas" },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-2">
      <PageHeader
        title="Fórmulas"
        subtitle="Consulte fórmulas de Matemática, Física e Química e resolva passo a passo, sem IA. Favorite, anote, crie as suas e vincule às aulas."
        actions={
          <Button onClick={() => setEditing("new")}>
            <PlusIcon /> Nova fórmula
          </Button>
        }
      />
      <ToolsNav />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <div className={cx("min-w-0 space-y-3", selected && "hidden lg:block")}>
          <Field label="Buscar fórmula" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ex.: pitágoras, juros, ohm…" autoComplete="off" />
          <div role="group" aria-label="Filtro" className="flex flex-wrap gap-1.5">
            {filters.map((c) => (
              <button
                key={c.id}
                type="button"
                aria-pressed={filter === c.id}
                onClick={() => setFilter(c.id)}
                className={cx("min-h-9 rounded-full border border-line px-3 text-sm font-medium", filter === c.id ? "bg-primary text-primary-fg" : "hover:bg-surface-2")}
              >
                {c.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted">{results.length} {results.length === 1 ? "fórmula" : "fórmulas"}</p>

          {results.length === 0 ? (
            <EmptyState
              title={filter === "favoritas" ? "Nenhuma fórmula favorita" : filter === "minhas" ? "Você ainda não criou fórmulas" : "Nenhuma fórmula encontrada"}
              action={filter === "minhas" ? <Button onClick={() => setEditing("new")}>Criar a primeira</Button> : undefined}
            >
              {filter === "favoritas" ? "Toque na estrela de uma fórmula para guardá-la aqui." : filter === "minhas" ? "Crie fórmulas com a sua própria conta e use-as como as do catálogo." : "Tente outra palavra ou escolha “Todas”."}
            </EmptyState>
          ) : (
            <ul className="space-y-1.5" aria-label="Fórmulas">
              {results.map((f) => {
                const key = formulaKey(f);
                const mark = marks.get(key);
                return (
                  <li key={key}>
                    <button
                      type="button"
                      onClick={() => select(key)}
                      aria-current={selectedKey === key ? "true" : undefined}
                      className={cx("w-full rounded-lg border border-line p-3 text-left transition-colors hover:bg-surface-2", selectedKey === key && "border-primary bg-primary-soft")}
                    >
                      <span className="flex items-center gap-2 font-medium">
                        <span className="flex-1">{f.title}</span>
                        {mark?.is_favorite && <StarIcon width={14} height={14} aria-label="Favorita" style={{ fill: "currentColor" }} className="shrink-0 text-primary" />}
                        {f.custom && <Badge tone="primary">própria</Badge>}
                      </span>
                      <span className="block text-xs text-muted">{categoryLabel(f.category)} · {f.topic}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className={cx("min-w-0", !selected && "hidden lg:block")}>
          {selected ? (
            <FormulaDetail
              key={selectedKey}
              formula={selected}
              mark={marks.get(formulaKey(selected))}
              custom={selected.custom ? customs.find((c) => c.id === selected.id) : undefined}
              onMarksChanged={marksApi.reload}
              onBack={() => select(null)}
              onOpen={select}
              onEdit={(c) => setEditing(c)}
              onDeleted={() => {
                select(null);
                customApi.reload();
                marksApi.reload();
              }}
            />
          ) : (
            <GeneralMethodCard category={filter} />
          )}
        </div>
      </div>

      <Modal open={editing !== null} title={editing === "new" || editing === null ? "Nova fórmula" : "Editar fórmula"} onClose={() => setEditing(null)}>
        {editing !== null && (
          <CustomFormulaEditor
            existing={editing === "new" ? null : editing}
            onCancel={() => setEditing(null)}
            onSaved={(saved) => {
              setEditing(null);
              customApi.reload();
              select(`c:${saved.id}`);
              setFilter("todas");
            }}
          />
        )}
      </Modal>
    </div>
  );
}

function CustomFormulaEditor({ existing, onCancel, onSaved }: { existing: CustomFormulaData | null; onCancel: () => void; onSaved: (c: CustomFormulaData) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(draft: CustomDraft) {
    setBusy(true);
    setError(null);
    try {
      const saved = await api<CustomFormulaData>(existing ? `/formulas/custom/${existing.id}` : "/formulas/custom", {
        method: existing ? "PUT" : "POST",
        body: draftToBody(draft),
      });
      onSaved(saved);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return <CustomFormulaForm initial={existing ? draftFromCustom(existing) : EMPTY_DRAFT} busy={busy} serverError={error} onSubmit={(d) => void save(d)} onCancel={onCancel} />;
}

interface DetailProps {
  formula: Formula;
  mark: FormulaMark | undefined;
  custom: CustomFormulaData | undefined;
  onMarksChanged: () => void;
  onBack: () => void;
  onOpen: (key: string) => void;
  onEdit: (custom: CustomFormulaData) => void;
  onDeleted: () => void;
}

function FormulaDetail({ formula, mark, custom, onMarksChanged, onBack, onOpen, onEdit, onDeleted }: DetailProps) {
  const key = formulaKey(formula);
  const [solverIndex, setSolverIndex] = useState(0);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(formula.vars.filter((v) => v.default).map((v) => [v.id, v.default as string])),
  );
  const [note, setNote] = useState(mark?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<"fav" | "note" | "delete" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const solver = formula.solvers[solverIndex];
  const byId = new Map(formula.vars.map((v) => [v.id, v]));
  const outcome = useMemo(() => solveFormula(formula, solver, values), [formula, solver, values]);
  const favorite = mark?.is_favorite ?? false;
  const noteChanged = note.trim() !== (mark?.note ?? "");

  async function putMark(body: { is_favorite?: boolean; note?: string }, kind: "fav" | "note") {
    setSaving(kind);
    setError(null);
    try {
      await api<FormulaMark>(`/formulas/marks/${key}`, { method: "PUT", body });
      onMarksChanged();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(null);
    }
  }

  async function remove() {
    if (!custom) return;
    setSaving("delete");
    try {
      await api(`/formulas/custom/${custom.id}`, { method: "DELETE" });
      onDeleted();
    } catch (err) {
      setError(errorMessage(err));
      setSaving(null);
      setConfirmDelete(false);
    }
  }

  function fillExample() {
    if (!formula.example) return;
    setSolverIndex(formula.example.solver);
    setValues((current) => ({ ...current, ...formula.example!.values }));
  }

  return (
    <div className="space-y-4">
      <Button variant="ghost" className="lg:hidden" onClick={onBack}>
        ← Voltar à lista
      </Button>
      {error && <Alert>{error}</Alert>}

      <Card className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="mr-auto text-lg font-semibold">{formula.title}</h2>
          <Badge tone="primary">{categoryLabel(formula.category)}</Badge>
          <Badge>{formula.topic}</Badge>
          <Button
            variant="ghost"
            className="min-h-9 px-2"
            aria-pressed={favorite}
            aria-label={favorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
            loading={saving === "fav"}
            onClick={() => void putMark({ is_favorite: !favorite }, "fav")}
          >
            <StarIcon style={favorite ? { fill: "currentColor" } : undefined} className={favorite ? "text-primary" : undefined} />
          </Button>
          {custom && (
            <>
              <Button variant="ghost" className="min-h-9 px-2" aria-label="Editar fórmula" onClick={() => onEdit(custom)}>
                <EditIcon />
              </Button>
              <Button variant="ghost" className="min-h-9 px-2" aria-label="Excluir fórmula" onClick={() => setConfirmDelete(true)}>
                <TrashIcon />
              </Button>
            </>
          )}
        </div>
        <div className="overflow-x-auto rounded-lg bg-surface-2 px-3 py-4 text-center text-sm">
          <Tex display>{formula.latex}</Tex>
        </div>
        <p className="text-sm">{formula.summary}</p>
        <table className="w-full text-sm">
          <caption className="sr-only">Variáveis da fórmula</caption>
          <tbody>
            {formula.vars.map((v) => (
              <tr key={v.id} className="border-t border-line">
                <th scope="row" className="w-24 py-1.5 text-left font-normal">
                  <Tex>{v.latex}</Tex>
                </th>
                <td className="py-1.5">{v.name}</td>
                <td className="py-1.5 text-right text-muted">{v.unit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <GuideCard formula={formula} onOpen={onOpen} />

      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">Resolver passo a passo</h3>
          {formula.example && (
            <Button variant="secondary" className="min-h-8 px-3" onClick={fillExample}>
              Usar exemplo
            </Button>
          )}
        </div>

        {formula.solvers.length > 1 && (
          <Select label="O que você quer descobrir?" value={solverIndex} onChange={(e) => setSolverIndex(Number(e.target.value))}>
            {formula.solvers.map((s, i) => (
              <option key={s.label} value={i}>
                {s.label}
              </option>
            ))}
          </Select>
        )}

        <SolveSteps formula={formula} solverIndex={solverIndex} />

        <div className="grid gap-3 sm:grid-cols-2">
          {solver.needs.map((id) => {
            const v = byId.get(id)!;
            return (
              <Field
                key={id}
                label={`${v.name}${v.unit ? ` (${v.unit})` : ""}`}
                inputMode="decimal"
                autoComplete="off"
                value={values[id] ?? ""}
                onChange={(e) => setValues({ ...values, [id]: e.target.value })}
                placeholder="0"
                maxLength={30}
              />
            );
          })}
        </div>

        <div aria-live="polite" className="space-y-2">
          {outcome.status === "incomplete" && (
            <p className="text-sm text-muted">Preencha {outcome.missing.length === 1 ? "o campo que falta" : "os campos que faltam"} para ver a conta.</p>
          )}
          {outcome.status === "error" && <Alert>{outcome.message}</Alert>}
          {outcome.status === "ok" && (
            <ol className="space-y-1 rounded-lg bg-surface-2 p-3" aria-label="Passos da solução">
              {outcome.lines.map((line, i) => (
                <li key={i} className={cx("overflow-x-auto py-1", i === outcome.lines.length - 1 && "border-t border-line pt-2 font-semibold text-primary")}>
                  <Tex display>{line}</Tex>
                </li>
              ))}
            </ol>
          )}
        </div>
      </Card>

      <Card className="space-y-3">
        <Textarea label="Minha anotação" rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={5000} placeholder="Dicas, quando usar, pegadinhas…" />
        <Button variant="secondary" disabled={!noteChanged} loading={saving === "note"} onClick={() => void putMark({ note: note.trim() }, "note")}>
          Salvar anotação
        </Button>
      </Card>

      <Card>
        <FormulaLessons formula={formula} note={mark?.note ?? null} />
      </Card>

      <ConfirmDialog
        open={confirmDelete}
        title="Excluir esta fórmula?"
        description="A fórmula, a sua anotação e os vínculos com aulas serão apagados. Esta ação não pode ser desfeita."
        loading={saving === "delete"}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => void remove()}
      />
    </div>
  );
}
