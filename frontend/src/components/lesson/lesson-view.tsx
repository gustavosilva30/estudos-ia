"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Button, Field, Skeleton } from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Modal, PageHeader, Select, SubjectDot, Textarea } from "@/components/ui/forms";
import { EditIcon, StarIcon, TrashIcon } from "@/components/ui/icons";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { errorMessage, useApi } from "@/lib/use-api";
import type { Folder, LessonDetail, Page, Subject } from "@/lib/types";
import { AiPanel } from "./ai-panel";
import { MaterialsPanel } from "./materials-panel";
import { NotesPanel } from "./notes-panel";
import { SummariesPanel } from "./summaries-panel";

type Tab = "texto" | "anotacoes" | "ia" | "resumos";

export function LessonView({ id }: { id: string }) {
  const router = useRouter();
  const lesson = useApi<LessonDetail>(`/lessons/${id}`);
  const subject = useApi<Subject>(lesson.data ? `/subjects/${lesson.data.subject_id}` : null);
  const [tab, setTab] = useState<Tab>("texto");
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (lesson.error) {
    return (
      <div className="space-y-4">
        <Alert>{lesson.error}</Alert>
        <Link href="/biblioteca" className="text-primary hover:underline">
          Voltar para a biblioteca
        </Link>
      </div>
    );
  }
  if (!lesson.data) return <Skeleton className="h-48" />;
  const l = lesson.data;

  async function run(action: () => Promise<void>) {
    setError(null);
    setBusy(true);
    try {
      await action();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "texto", label: `Texto original (${l.materials.length})` },
    { id: "anotacoes", label: `Anotações (${l.notes.length})` },
    { id: "ia", label: "IA" },
    { id: "resumos", label: "Resumos" },
  ];

  return (
    <div>
      <PageHeader
        title={l.title}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {subject.data && (
              <Link href={`/materias/${subject.data.id}`} className="flex items-center gap-1.5 text-primary hover:underline">
                <SubjectDot color={subject.data.color} />
                {subject.data.name}
              </Link>
            )}
            {l.lesson_date && <span>· aula de {formatDate(l.lesson_date)}</span>}
          </span>
        }
        actions={
          <>
            <Button
              variant="secondary"
              aria-pressed={l.is_favorite}
              loading={busy}
              onClick={() =>
                run(async () => {
                  await api(`/lessons/${l.id}`, { method: "PATCH", body: { is_favorite: !l.is_favorite } });
                  lesson.reload();
                })
              }
            >
              <StarIcon style={l.is_favorite ? { fill: "currentColor" } : undefined} />
              {l.is_favorite ? "Favorita" : "Favoritar"}
            </Button>
            <Button variant="secondary" onClick={() => setEditing(true)}>
              <EditIcon /> Editar
            </Button>
            <Button variant="secondary" onClick={() => setDeleting(true)} aria-label="Excluir aula">
              <TrashIcon /> Excluir
            </Button>
          </>
        }
      />
      {error && (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      )}
      {l.observations && (
        <p className="-mt-3 mb-6 max-w-2xl whitespace-pre-wrap rounded-lg bg-surface-2 px-3 py-2 text-sm">{l.observations}</p>
      )}

      <div role="tablist" aria-label="Seções da aula" className="mb-5 flex gap-1 overflow-x-auto border-b border-line">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px min-h-10 shrink-0 border-b-2 px-4 text-sm font-medium ${tab === t.id ? "border-primary text-fg" : "border-transparent text-muted hover:text-fg"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {tab === "texto" && <MaterialsPanel lessonId={l.id} materials={l.materials} onChanged={lesson.reload} />}
        {tab === "anotacoes" && <NotesPanel lessonId={l.id} notes={l.notes} onChanged={lesson.reload} />}
        {tab === "ia" && <AiPanel materials={l.materials} />}
        {tab === "resumos" && <SummariesPanel lessonId={l.id} />}
      </div>

      <Modal open={editing} title="Editar aula" onClose={() => setEditing(false)}>
        <EditLessonForm
          lesson={l}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            lesson.reload();
          }}
        />
      </Modal>

      <ConfirmDialog
        open={deleting}
        title="Excluir aula?"
        description={`A aula "${l.title}" será excluída junto com seus textos, anotações, gerações de IA e resumos. Esta ação não pode ser desfeita.`}
        loading={busy}
        onCancel={() => setDeleting(false)}
        onConfirm={() =>
          run(async () => {
            await api(`/lessons/${l.id}`, { method: "DELETE" });
            router.replace(`/materias/${l.subject_id}`);
          })
        }
      />
    </div>
  );
}

function EditLessonForm({
  lesson,
  onClose,
  onSaved,
}: {
  lesson: LessonDetail;
  onClose: () => void;
  onSaved: () => void;
}) {
  const subjects = useApi<Page<Subject>>("/subjects?page_size=100&include_archived=true");
  const [title, setTitle] = useState(lesson.title);
  const [subjectId, setSubjectId] = useState(lesson.subject_id);
  const [folderId, setFolderId] = useState(lesson.folder_id ?? "");
  const [date, setDate] = useState(lesson.lesson_date ?? "");
  const [observations, setObservations] = useState(lesson.observations ?? "");
  const folders = useApi<Folder[]>(`/folders?subject_id=${subjectId}`);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api(`/lessons/${lesson.id}`, {
        method: "PATCH",
        body: {
          title: title.trim(),
          subject_id: subjectId,
          folder_id: folderId || null,
          lesson_date: date || null,
          observations: observations.trim() || null,
        },
      });
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && <Alert>{error}</Alert>}
      <Field label="Título" required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
      <Select
        label="Matéria"
        value={subjectId}
        onChange={(e) => {
          setSubjectId(e.target.value);
          setFolderId("");
        }}
      >
        {subjects.data?.items.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
        {!subjects.data && <option value={lesson.subject_id}>Carregando…</option>}
      </Select>
      <Select label="Pasta" value={folderId} onChange={(e) => setFolderId(e.target.value)}>
        <option value="">Sem pasta</option>
        {folders.data?.map((f) => (
          <option key={f.id} value={f.id}>
            {f.name}
          </option>
        ))}
      </Select>
      <Field label="Data da aula" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      <Textarea label="Observações" rows={3} maxLength={5000} value={observations} onChange={(e) => setObservations(e.target.value)} />
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
