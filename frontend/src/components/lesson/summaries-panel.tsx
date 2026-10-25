"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Button, Card, Field, Skeleton } from "@/components/ui/primitives";
import { Badge, EmptyState, Modal, Textarea } from "@/components/ui/forms";
import { PlusIcon, StarIcon } from "@/components/ui/icons";
import { api } from "@/lib/api";
import { formatDateTime, SUMMARY_KIND_LABELS } from "@/lib/format";
import { errorMessage, useApi } from "@/lib/use-api";
import type { Page, Summary, SummaryItem } from "@/lib/types";

export function SummariesPanel({ lessonId }: { lessonId: string }) {
  const summaries = useApi<Page<SummaryItem>>(`/summaries?lesson_id=${lessonId}&page_size=100`);
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="secondary" onClick={() => setCreating(true)}>
          <PlusIcon /> Criar resumo manual
        </Button>
      </div>

      {summaries.error && <Alert>{summaries.error}</Alert>}
      {!summaries.data && summaries.loading && <Skeleton className="h-24" />}
      {summaries.data?.items.length === 0 && (
        <EmptyState title="Nenhum resumo desta aula">
          Gere um resultado na aba IA e salve-o, ou escreva um resumo seu.
        </EmptyState>
      )}
      {summaries.data && summaries.data.items.length > 0 && (
        <Card className="p-0">
          <ul className="divide-y divide-line">
            {summaries.data.items.map((s) => (
              <li key={s.id}>
                <Link href={`/resumos/${s.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-surface-2">
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 font-medium">
                      {s.is_favorite && <StarIcon width={14} height={14} aria-label="Favorito" className="text-primary" />}
                      <span className="truncate">{s.title}</span>
                    </span>
                    <span className="mt-0.5 flex items-center gap-2 text-xs text-muted">
                      <Badge>{SUMMARY_KIND_LABELS[s.kind] ?? s.kind}</Badge>
                      versão {s.current_version}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-muted">{formatDateTime(s.updated_at)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Modal open={creating} title="Novo resumo" onClose={() => setCreating(false)}>
        <ManualSummaryForm lessonId={lessonId} onClose={() => setCreating(false)} />
      </Modal>
    </div>
  );
}

function ManualSummaryForm({ lessonId, onClose }: { lessonId: string; onClose: () => void }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const summary = await api<Summary>("/summaries", {
        method: "POST",
        body: { lesson_id: lessonId, title: title.trim(), content },
      });
      router.push(`/resumos/${summary.id}`);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && <Alert>{error}</Alert>}
      <Field label="Título" required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
      <Textarea
        label="Conteúdo (aceita Markdown)"
        required
        rows={8}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        hint="Use ## para títulos e - para listas."
      />
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          Cancelar
        </Button>
        <Button type="submit" loading={busy} disabled={!title.trim() || !content.trim()}>
          Criar e editar
        </Button>
      </div>
    </form>
  );
}
