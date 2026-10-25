"use client";

import { useState } from "react";
import { Alert, Button, Field } from "@/components/ui/primitives";
import { Modal, Textarea } from "@/components/ui/forms";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/use-api";
import type { Subject } from "@/lib/types";

export const SUBJECT_COLORS = ["#3b82f6", "#22aa55", "#d97706", "#dc2626", "#9333ea", "#0891b2", "#db2777", "#64748b"];

interface Props {
  open: boolean;
  subject?: Subject;
  onClose: () => void;
  onSaved: (subject: Subject) => void;
}

export function SubjectFormModal({ open, subject, onClose, onSaved }: Props) {
  return (
    <Modal open={open} title={subject ? "Editar matéria" : "Nova matéria"} onClose={onClose}>
      {/* O formulário só existe com o modal aberto, então o estado reinicia a cada abertura. */}
      <SubjectForm subject={subject} onClose={onClose} onSaved={onSaved} />
    </Modal>
  );
}

function SubjectForm({ subject, onClose, onSaved }: Omit<Props, "open">) {
  const [name, setName] = useState(subject?.name ?? "");
  const [color, setColor] = useState<string | null>(subject?.color ?? SUBJECT_COLORS[0]);
  const [description, setDescription] = useState(subject?.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const body = { name: name.trim(), color, description: description.trim() || null };
      const saved = subject
        ? await api<Subject>(`/subjects/${subject.id}`, { method: "PATCH", body })
        : await api<Subject>("/subjects", { method: "POST", body });
      onSaved(saved);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && <Alert>{error}</Alert>}
      <Field label="Nome" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">Cor</legend>
        <div className="flex flex-wrap gap-2">
          {SUBJECT_COLORS.map((c) => (
            <label key={c} className="cursor-pointer">
              <input
                type="radio"
                name="cor"
                value={c}
                checked={color === c}
                onChange={() => setColor(c)}
                className="peer sr-only"
              />
              <span
                className="block h-8 w-8 rounded-full ring-offset-2 ring-offset-surface peer-checked:ring-2 peer-checked:ring-fg peer-focus-visible:ring-2 peer-focus-visible:ring-primary"
                style={{ backgroundColor: c }}
              />
              <span className="sr-only">{c}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <Textarea
        label="Descrição (opcional)"
        rows={3}
        maxLength={2000}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          Cancelar
        </Button>
        <Button type="submit" loading={busy}>
          Salvar
        </Button>
      </div>
    </form>
  );
}
