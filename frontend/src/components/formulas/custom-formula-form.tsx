"use client";

import { useState } from "react";
import { Textarea, Select } from "@/components/ui/forms";
import { PlusIcon, TrashIcon } from "@/components/ui/icons";
import { Alert, Button, Field } from "@/components/ui/primitives";
import { MAX_EXPRESSION, MAX_VARIABLES, validateDraft, type CustomDraft } from "@/lib/formula-custom";

interface Props {
  initial: CustomDraft;
  busy: boolean;
  /** Erro vindo do servidor (a validação do navegador aparece sozinha). */
  serverError?: string | null;
  onSubmit: (draft: CustomDraft) => void;
  onCancel: () => void;
}

/** Cria ou edita uma fórmula própria: nome, variáveis e a conta (calculada no navegador pelo motor da calculadora). */
export function CustomFormulaForm({ initial, busy, serverError, onSubmit, onCancel }: Props) {
  const [draft, setDraft] = useState<CustomDraft>(initial);
  const [problem, setProblem] = useState<string | null>(null);

  function setVariable(index: number, patch: Partial<CustomDraft["variables"][number]>) {
    setDraft({ ...draft, variables: draft.variables.map((v, i) => (i === index ? { ...v, ...patch } : v)) });
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const error = validateDraft(draft);
    setProblem(error);
    if (!error) onSubmit(draft);
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {(problem || serverError) && <Alert>{problem ?? serverError}</Alert>}
      <Field label="Nome da fórmula" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} maxLength={120} placeholder="Ex.: Energia potencial elástica" autoFocus />
      <Select label="Área" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value as CustomDraft["category"] })}>
        <option value="matematica">Matemática</option>
        <option value="fisica">Física</option>
        <option value="quimica">Química</option>
        <option value="outra">Outra</option>
      </Select>
      <Textarea label="Descrição (opcional)" rows={2} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} maxLength={2000} />

      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-medium">Variáveis</legend>
        <p className="text-xs text-muted">O nome é o que você usa na conta (letras, números e _; começa por letra). A descrição aparece no formulário.</p>
        {draft.variables.map((v, i) => (
          <div key={i} className="grid grid-cols-[5rem_1fr_5rem_auto] items-end gap-2">
            <Field label={i === 0 ? "Nome" : "Nome"} value={v.id} onChange={(e) => setVariable(i, { id: e.target.value })} maxLength={16} placeholder="m" autoComplete="off" aria-label={`Nome da variável ${i + 1}`} />
            <Field label="Descrição" value={v.name} onChange={(e) => setVariable(i, { name: e.target.value })} maxLength={60} placeholder="massa" aria-label={`Descrição da variável ${i + 1}`} />
            <Field label="Unidade" value={v.unit} onChange={(e) => setVariable(i, { unit: e.target.value })} maxLength={30} placeholder="kg" aria-label={`Unidade da variável ${i + 1}`} />
            <Button
              variant="ghost"
              className="px-2"
              aria-label={`Remover variável ${i + 1}`}
              onClick={() => setDraft({ ...draft, variables: draft.variables.filter((_, j) => j !== i) })}
            >
              <TrashIcon />
            </Button>
          </div>
        ))}
        {draft.variables.length < MAX_VARIABLES && (
          <Button variant="secondary" onClick={() => setDraft({ ...draft, variables: [...draft.variables, { id: "", name: "", unit: "" }] })}>
            <PlusIcon /> Adicionar variável
          </Button>
        )}
      </fieldset>

      <Field
        label="Conta"
        value={draft.expression}
        onChange={(e) => setDraft({ ...draft, expression: e.target.value })}
        maxLength={MAX_EXPRESSION}
        placeholder="m*g*h"
        autoComplete="off"
        spellCheck={false}
        hint="Use as variáveis e as funções da calculadora: + - * / ^ sqrt() sin() ln() pi... Ex.: m*g*h"
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Nome do resultado" value={draft.result_name} onChange={(e) => setDraft({ ...draft, result_name: e.target.value })} maxLength={16} placeholder="Ep" autoComplete="off" />
        <Field label="Descrição do resultado" value={draft.result_label} onChange={(e) => setDraft({ ...draft, result_label: e.target.value })} maxLength={60} placeholder="energia" />
        <Field label="Unidade do resultado" value={draft.result_unit} onChange={(e) => setDraft({ ...draft, result_unit: e.target.value })} maxLength={30} placeholder="J" />
      </div>
      <Field
        label="Equação desenhada (opcional, em LaTeX)"
        value={draft.latex}
        onChange={(e) => setDraft({ ...draft, latex: e.target.value })}
        maxLength={500}
        placeholder="E_p = m\,g\,h"
        autoComplete="off"
        spellCheck={false}
        hint="Se deixar em branco, mostramos a própria conta."
      />

      <div className="flex gap-2">
        <Button type="submit" loading={busy}>Salvar fórmula</Button>
        <Button variant="secondary" onClick={onCancel} disabled={busy}>Cancelar</Button>
      </div>
    </form>
  );
}
