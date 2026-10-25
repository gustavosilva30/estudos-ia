"use client";

import { useState } from "react";
import { Alert, Button, Card } from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Badge, EmptyState, Textarea } from "@/components/ui/forms";
import { EditIcon, PlusIcon, TrashIcon } from "@/components/ui/icons";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { errorMessage } from "@/lib/use-api";
import type { Material } from "@/lib/types";

const MAX_TEXT = 100_000;

interface Props {
  lessonId: string;
  materials: Material[];
  onChanged: () => void;
}

export function MaterialsPanel({ lessonId, materials, onChanged }: Props) {
  const [adding, setAdding] = useState(false);
  const [toDelete, setToDelete] = useState<Material | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove(material: Material) {
    setBusy(true);
    setError(null);
    try {
      await api(`/materials/${material.id}`, { method: "DELETE" });
      setToDelete(null);
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Alert tone="info">
        O texto original é sempre preservado: a IA nunca o altera nem o substitui. Resultados são salvos à parte,
        como resumos.
      </Alert>
      {error && <Alert>{error}</Alert>}

      {materials.length === 0 && !adding && (
        <EmptyState
          title="Nenhum texto salvo nesta aula"
          action={
            <Button onClick={() => setAdding(true)}>
              <PlusIcon /> Adicionar texto
            </Button>
          }
        >
          Cole ou digite o conteúdo da aula para poder usar a IA.
        </EmptyState>
      )}

      {materials.map((m, index) => (
        <MaterialCard
          key={m.id}
          material={m}
          label={`Texto ${index + 1}`}
          onSaved={onChanged}
          onDelete={() => setToDelete(m)}
        />
      ))}

      {adding ? (
        <NewMaterial
          lessonId={lessonId}
          onCancel={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            onChanged();
          }}
        />
      ) : (
        materials.length > 0 && (
          <Button variant="secondary" onClick={() => setAdding(true)}>
            <PlusIcon /> Adicionar outro texto
          </Button>
        )
      )}

      <ConfirmDialog
        open={toDelete !== null}
        title="Excluir este texto?"
        description="As gerações de IA feitas a partir dele também serão apagadas. Resumos que você já salvou continuam existindo. Esta ação não pode ser desfeita."
        loading={busy}
        onCancel={() => setToDelete(null)}
        onConfirm={() => toDelete && remove(toDelete)}
      />
    </div>
  );
}

function MaterialCard({
  material,
  label,
  onSaved,
  onDelete,
}: {
  material: Material;
  label: string;
  onSaved: () => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(material.content);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await api(`/materials/${material.id}`, { method: "PATCH", body: { content: text } });
      setEditing(false);
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold">{label}</h3>
          <Badge>{material.origin === "pasted" ? "colado" : "digitado"}</Badge>
          <span className="text-xs text-muted">atualizado em {formatDateTime(material.updated_at)}</span>
        </div>
        {!editing && (
          <div className="flex gap-1">
            <Button variant="ghost" className="min-h-9" onClick={() => { setText(material.content); setEditing(true); }}>
              <EditIcon /> Editar
            </Button>
            <Button variant="ghost" className="min-h-9" onClick={onDelete} aria-label={`Excluir ${label}`}>
              <TrashIcon />
            </Button>
          </div>
        )}
      </div>

      {editing ? (
        <div className="space-y-3">
          {error && <Alert>{error}</Alert>}
          <Textarea
            label="Texto"
            rows={14}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="font-mono"
            error={text.length > MAX_TEXT ? `Máximo de ${MAX_TEXT.toLocaleString("pt-BR")} caracteres.` : null}
            hint={`${text.length.toLocaleString("pt-BR")} / ${MAX_TEXT.toLocaleString("pt-BR")} caracteres`}
          />
          <div className="flex gap-2">
            <Button onClick={save} loading={busy} disabled={!text.trim() || text.length > MAX_TEXT}>
              Salvar
            </Button>
            <Button variant="secondary" onClick={() => setEditing(false)} disabled={busy}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-surface-2 p-3 font-sans text-sm leading-relaxed">
          {material.content}
        </pre>
      )}
    </Card>
  );
}

function NewMaterial({
  lessonId,
  onCancel,
  onSaved,
}: {
  lessonId: string;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [text, setText] = useState("");
  const [pasted, setPasted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await api(`/lessons/${lessonId}/materials`, {
        method: "POST",
        body: { content: text, origin: pasted ? "pasted" : "typed" },
      });
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-3">
      {error && <Alert>{error}</Alert>}
      <Textarea
        label="Novo texto"
        rows={12}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onPaste={(e) => {
          if (e.clipboardData.getData("text").length > 20) setPasted(true);
        }}
        className="font-mono"
        autoFocus
        error={text.length > MAX_TEXT ? `Máximo de ${MAX_TEXT.toLocaleString("pt-BR")} caracteres.` : null}
        hint={`${text.length.toLocaleString("pt-BR")} / ${MAX_TEXT.toLocaleString("pt-BR")} caracteres`}
      />
      <div className="flex gap-2">
        <Button onClick={save} loading={busy} disabled={!text.trim() || text.length > MAX_TEXT}>
          Salvar texto
        </Button>
        <Button variant="secondary" onClick={onCancel} disabled={busy}>
          Cancelar
        </Button>
      </div>
    </Card>
  );
}
