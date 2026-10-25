"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Alert, Button, Card, Skeleton } from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Badge, EmptyState, Modal, PageHeader, Pagination, Select, SubjectDot } from "@/components/ui/forms";
import { EditIcon, FolderIcon, PlusIcon, StarIcon, TrashIcon } from "@/components/ui/icons";
import { Field } from "@/components/ui/primitives";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { errorMessage, useApi } from "@/lib/use-api";
import type { Folder, LessonListItem, Page, Subject } from "@/lib/types";
import { SubjectFormModal } from "./subject-form";

interface FolderNode extends Folder {
  depth: number;
}

function flatten(folders: Folder[]): FolderNode[] {
  const children = new Map<string | null, Folder[]>();
  for (const f of folders) children.set(f.parent_id, [...(children.get(f.parent_id) ?? []), f]);
  const out: FolderNode[] = [];
  const visit = (parent: string | null, depth: number) => {
    for (const f of (children.get(parent) ?? []).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))) {
      out.push({ ...f, depth });
      visit(f.id, depth + 1);
    }
  };
  visit(null, 0);
  return out;
}

export function SubjectView({ id }: { id: string }) {
  const router = useRouter();
  const subject = useApi<Subject>(`/subjects/${id}`);
  const folders = useApi<Folder[]>(`/folders?subject_id=${id}`);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const lessons = useApi<Page<LessonListItem>>(
    `/lessons?subject_id=${id}&page=${page}&page_size=20${folderId ? `&folder_id=${folderId}` : ""}`,
  );

  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [folderModal, setFolderModal] = useState<{ folder?: Folder } | null>(null);
  const [folderToDelete, setFolderToDelete] = useState<Folder | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const tree = useMemo(() => flatten(folders.data ?? []), [folders.data]);

  async function run(action: () => Promise<void>) {
    setActionError(null);
    setBusy(true);
    try {
      await action();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (subject.error) {
    return (
      <div className="space-y-4">
        <Alert>{subject.error}</Alert>
        <Link href="/materias" className="text-primary hover:underline">
          Voltar para as matérias
        </Link>
      </div>
    );
  }
  if (!subject.data) return <Skeleton className="h-40" />;
  const s = subject.data;

  return (
    <div>
      <PageHeader
        title={s.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <SubjectDot color={s.color} />
            {s.lesson_count} {s.lesson_count === 1 ? "aula" : "aulas"}
            {s.is_archived && <Badge>Arquivada</Badge>}
            <Link href="/materias" className="text-primary hover:underline">
              Todas as matérias
            </Link>
          </span>
        }
        actions={
          <>
            <Link
              href={`/aulas/nova?materia=${s.id}${folderId ? `&pasta=${folderId}` : ""}`}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-fg hover:bg-primary-hover"
            >
              <PlusIcon /> Nova aula
            </Link>
            <Button variant="secondary" onClick={() => setEditing(true)}>
              <EditIcon /> Editar
            </Button>
            <Button
              variant="secondary"
              loading={busy}
              onClick={() =>
                run(async () => {
                  await api(`/subjects/${s.id}`, { method: "PATCH", body: { is_archived: !s.is_archived } });
                  subject.reload();
                })
              }
            >
              {s.is_archived ? "Desarquivar" : "Arquivar"}
            </Button>
            <Button variant="secondary" onClick={() => setDeleting(true)} aria-label="Excluir matéria">
              <TrashIcon /> Excluir
            </Button>
          </>
        }
      />
      {s.description && <p className="-mt-3 mb-6 max-w-2xl text-sm text-muted">{s.description}</p>}
      {actionError && (
        <div className="mb-4">
          <Alert>{actionError}</Alert>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
        <aside aria-label="Pastas">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-semibold">Pastas</h2>
            <Button variant="ghost" className="min-h-8 px-2" onClick={() => setFolderModal({})} aria-label="Nova pasta">
              <PlusIcon />
            </Button>
          </div>
          <ul className="space-y-0.5">
            <li>
              <button
                type="button"
                onClick={() => {
                  setFolderId(null);
                  setPage(1);
                }}
                aria-pressed={folderId === null}
                className={`flex min-h-9 w-full items-center rounded-lg px-3 text-left text-sm ${folderId === null ? "bg-primary-soft font-medium" : "hover:bg-surface-2"}`}
              >
                Todas as aulas
              </button>
            </li>
            {tree.map((f) => (
              <li key={f.id} className="group flex items-center" style={{ paddingLeft: `${f.depth * 14}px` }}>
                <button
                  type="button"
                  onClick={() => {
                    setFolderId(f.id);
                    setPage(1);
                  }}
                  aria-pressed={folderId === f.id}
                  className={`flex min-h-9 flex-1 items-center gap-2 truncate rounded-lg px-3 text-left text-sm ${folderId === f.id ? "bg-primary-soft font-medium" : "hover:bg-surface-2"}`}
                >
                  <FolderIcon width={16} height={16} />
                  <span className="truncate">{f.name}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFolderModal({ folder: f })}
                  aria-label={`Editar pasta ${f.name}`}
                  className="rounded p-1.5 text-muted hover:bg-surface-2 hover:text-fg"
                >
                  <EditIcon width={15} height={15} />
                </button>
                <button
                  type="button"
                  onClick={() => setFolderToDelete(f)}
                  aria-label={`Excluir pasta ${f.name}`}
                  className="rounded p-1.5 text-muted hover:bg-surface-2 hover:text-danger"
                >
                  <TrashIcon width={15} height={15} />
                </button>
              </li>
            ))}
          </ul>
          {folders.data?.length === 0 && <p className="mt-2 px-3 text-xs text-muted">Nenhuma pasta criada.</p>}
        </aside>

        <section aria-label="Aulas">
          {lessons.error && <Alert>{lessons.error}</Alert>}
          {!lessons.data && lessons.loading && <Skeleton className="h-40" />}
          {lessons.data && lessons.data.items.length === 0 && (
            <EmptyState title="Nenhuma aula aqui">
              {folderId ? "Esta pasta não tem aulas." : "Crie a primeira aula desta matéria."}
            </EmptyState>
          )}
          {lessons.data && lessons.data.items.length > 0 && (
            <Card className="p-0">
              <ul className="divide-y divide-line">
                {lessons.data.items.map((lesson) => (
                  <li key={lesson.id}>
                    <Link
                      href={`/aulas/${lesson.id}`}
                      className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-surface-2"
                    >
                      <span className="flex min-w-0 items-center gap-2 font-medium">
                        {lesson.is_favorite && <StarIcon width={14} height={14} aria-label="Favorita" className="text-primary" />}
                        <span className="truncate">{lesson.title}</span>
                      </span>
                      <span className="shrink-0 text-xs text-muted">
                        {lesson.lesson_date ? formatDate(lesson.lesson_date) : formatDate(lesson.updated_at)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {lessons.data && <Pagination page={page} pageSize={20} total={lessons.data.total} onChange={setPage} />}
        </section>
      </div>

      <SubjectFormModal
        open={editing}
        subject={s}
        onClose={() => setEditing(false)}
        onSaved={() => {
          setEditing(false);
          subject.reload();
        }}
      />

      <FolderFormModal
        state={folderModal}
        subjectId={s.id}
        folders={tree}
        onClose={() => setFolderModal(null)}
        onSaved={() => {
          setFolderModal(null);
          folders.reload();
        }}
      />

      <ConfirmDialog
        open={deleting}
        title="Excluir matéria?"
        description={`A matéria "${s.name}" será excluída junto com ${s.lesson_count} ${s.lesson_count === 1 ? "aula" : "aulas"}, seus textos, anotações, resumos e pastas. Esta ação não pode ser desfeita.`}
        loading={busy}
        onCancel={() => setDeleting(false)}
        onConfirm={() =>
          run(async () => {
            await api(`/subjects/${s.id}`, { method: "DELETE" });
            router.replace("/materias");
          })
        }
      />

      <ConfirmDialog
        open={folderToDelete !== null}
        title="Excluir pasta?"
        description={`A pasta "${folderToDelete?.name ?? ""}" será excluída, mas as aulas e subpastas dentro dela não: elas passam para o nível acima.`}
        loading={busy}
        onCancel={() => setFolderToDelete(null)}
        onConfirm={() =>
          run(async () => {
            if (!folderToDelete) return;
            await api(`/folders/${folderToDelete.id}`, { method: "DELETE" });
            if (folderId === folderToDelete.id) setFolderId(null);
            setFolderToDelete(null);
            folders.reload();
            lessons.reload();
          })
        }
      />
    </div>
  );
}

function FolderFormModal({
  state,
  subjectId,
  folders,
  onClose,
  onSaved,
}: {
  state: { folder?: Folder } | null;
  subjectId: string;
  folders: FolderNode[];
  onClose: () => void;
  onSaved: () => void;
}) {
  return (
    <Modal open={state !== null} title={state?.folder ? "Editar pasta" : "Nova pasta"} onClose={onClose}>
      {state && <FolderForm folder={state.folder} subjectId={subjectId} folders={folders} onClose={onClose} onSaved={onSaved} />}
    </Modal>
  );
}

function FolderForm({
  folder,
  subjectId,
  folders,
  onClose,
  onSaved,
}: {
  folder?: Folder;
  subjectId: string;
  folders: FolderNode[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(folder?.name ?? "");
  const [parentId, setParentId] = useState(folder?.parent_id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (folder) {
        await api(`/folders/${folder.id}`, { method: "PATCH", body: { name: name.trim(), parent_id: parentId || null } });
      } else {
        await api("/folders", { method: "POST", body: { subject_id: subjectId, name: name.trim(), parent_id: parentId || null } });
      }
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && <Alert>{error}</Alert>}
      <Field label="Nome da pasta" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      <Select label="Dentro de" value={parentId} onChange={(e) => setParentId(e.target.value)}>
        <option value="">(raiz da matéria)</option>
        {folders
          .filter((f) => f.id !== folder?.id)
          .map((f) => (
            <option key={f.id} value={f.id}>
              {"— ".repeat(f.depth)}
              {f.name}
            </option>
          ))}
      </Select>
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
