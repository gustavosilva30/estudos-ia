"use client";

import { useState } from "react";
import { Alert, Button, Card } from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState, Textarea } from "@/components/ui/forms";
import { EditIcon, TrashIcon } from "@/components/ui/icons";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { errorMessage } from "@/lib/use-api";
import type { Note } from "@/lib/types";

const MAX_NOTE = 20_000;

export function NotesPanel({ lessonId, notes, onChanged }: { lessonId: string; notes: Note[]; onChanged: () => void }) {
  const [text, setText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [toDelete, setToDelete] = useState<Note | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {error && <Alert>{error}</Alert>}
      <Card className="space-y-3">
        <Textarea
          label="Nova anotação pessoal"
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={MAX_NOTE}
        />
        <Button
          loading={busy}
          disabled={!text.trim()}
          onClick={() =>
            run(async () => {
              await api(`/lessons/${lessonId}/notes`, { method: "POST", body: { content: text } });
              setText("");
            })
          }
        >
          Adicionar anotação
        </Button>
      </Card>

      {notes.length === 0 && <EmptyState title="Nenhuma anotação">Registre dúvidas, lembretes e observações da aula.</EmptyState>}

      {notes.map((note) => (
        <Card key={note.id}>
          {editingId === note.id ? (
            <div className="space-y-3">
              <Textarea label="Anotação" rows={4} value={editText} onChange={(e) => setEditText(e.target.value)} maxLength={MAX_NOTE} />
              <div className="flex gap-2">
                <Button
                  loading={busy}
                  disabled={!editText.trim()}
                  onClick={() =>
                    run(async () => {
                      await api(`/notes/${note.id}`, { method: "PATCH", body: { content: editText } });
                      setEditingId(null);
                    })
                  }
                >
                  Salvar
                </Button>
                <Button variant="secondary" onClick={() => setEditingId(null)} disabled={busy}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <>
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{note.content}</p>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-muted">{formatDateTime(note.updated_at)}</span>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    className="min-h-9"
                    aria-label="Editar anotação"
                    onClick={() => {
                      setEditingId(note.id);
                      setEditText(note.content);
                    }}
                  >
                    <EditIcon />
                  </Button>
                  <Button variant="ghost" className="min-h-9" aria-label="Excluir anotação" onClick={() => setToDelete(note)}>
                    <TrashIcon />
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>
      ))}

      <ConfirmDialog
        open={toDelete !== null}
        title="Excluir anotação?"
        description="Esta ação não pode ser desfeita."
        loading={busy}
        onCancel={() => setToDelete(null)}
        onConfirm={() =>
          run(async () => {
            if (toDelete) await api(`/notes/${toDelete.id}`, { method: "DELETE" });
            setToDelete(null);
          })
        }
      />
    </div>
  );
}
