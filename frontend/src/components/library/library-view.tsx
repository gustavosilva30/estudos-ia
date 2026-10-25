"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Alert, Button, Card, Field, Skeleton } from "@/components/ui/primitives";
import { Badge, EmptyState, PageHeader, Pagination, Select, SubjectDot } from "@/components/ui/forms";
import { PlusIcon, StarIcon } from "@/components/ui/icons";
import { api } from "@/lib/api";
import { formatDate, formatDateTime, SUMMARY_KIND_LABELS } from "@/lib/format";
import { errorMessage, useApi, useDebounced } from "@/lib/use-api";
import type { LessonListItem, Page, Subject, SummaryItem } from "@/lib/types";

const PAGE_SIZE = 20;

const LESSON_SORTS = [
  { value: "updated_at:desc", label: "Mais recentes" },
  { value: "updated_at:asc", label: "Menos recentes" },
  { value: "title:asc", label: "Título (A–Z)" },
  { value: "title:desc", label: "Título (Z–A)" },
  { value: "lesson_date:desc", label: "Data da aula (mais nova)" },
  { value: "lesson_date:asc", label: "Data da aula (mais antiga)" },
];

type Tab = "aulas" | "resumos";

export function LibraryView() {
  const initialQuery = useSearchParams().get("q") ?? "";
  const [tab, setTab] = useState<Tab>("aulas");
  const [q, setQ] = useState(initialQuery);
  const [favorite, setFavorite] = useState(false);

  return (
    <div>
      <PageHeader
        title="Biblioteca"
        subtitle="Todas as suas aulas e resumos."
        actions={
          <Link
            href="/aulas/nova"
            className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-fg hover:bg-primary-hover"
          >
            <PlusIcon /> Nova aula
          </Link>
        }
      />

      <div role="tablist" aria-label="Tipo de conteúdo" className="mb-4 flex gap-1 border-b border-line">
        {(["aulas", "resumos"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            type="button"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`-mb-px min-h-10 border-b-2 px-4 text-sm font-medium ${tab === t ? "border-primary text-fg" : "border-transparent text-muted hover:text-fg"}`}
          >
            {t === "aulas" ? "Aulas" : "Resumos"}
          </button>
        ))}
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <Field
          label="Pesquisar"
          type="search"
          placeholder={tab === "aulas" ? "Título ou palavras do texto…" : "Título ou conteúdo do resumo…"}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          maxLength={200}
        />
        <label className="inline-flex min-h-10 items-center gap-2 text-sm">
          <input type="checkbox" checked={favorite} onChange={(e) => setFavorite(e.target.checked)} />
          Só favoritos
        </label>
      </div>

      {tab === "aulas" ? <LessonsTab q={q} favorite={favorite} /> : <SummariesTab q={q} favorite={favorite} />}
    </div>
  );
}

function LessonsTab({ q, favorite }: { q: string; favorite: boolean }) {
  const debouncedQ = useDebounced(q.trim());
  const [subjectId, setSubjectId] = useState("");
  const [sortValue, setSortValue] = useState(LESSON_SORTS[0].value);
  const [page, setPage] = useState(1);
  const [actionError, setActionError] = useState<string | null>(null);
  const subjects = useApi<Page<Subject>>("/subjects?page_size=100&include_archived=true");

  const [sort, order] = sortValue.split(":");
  const params = new URLSearchParams({ page: String(page), page_size: String(PAGE_SIZE), sort, order });
  if (debouncedQ) params.set("q", debouncedQ);
  if (subjectId) params.set("subject_id", subjectId);
  if (favorite) params.set("favorite", "true");
  const lessons = useApi<Page<LessonListItem>>(`/lessons?${params}`);

  async function toggleFavorite(lesson: LessonListItem) {
    setActionError(null);
    const next = !lesson.is_favorite;
    lessons.mutate((p) => ({ ...p, items: p.items.map((i) => (i.id === lesson.id ? { ...i, is_favorite: next } : i)) }));
    try {
      await api(`/lessons/${lesson.id}`, { method: "PATCH", body: { is_favorite: next } });
    } catch (err) {
      setActionError(errorMessage(err));
      lessons.reload();
    }
  }

  const filtered = Boolean(debouncedQ || subjectId || favorite);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Select label="Matéria" value={subjectId} onChange={(e) => { setSubjectId(e.target.value); setPage(1); }}>
          <option value="">Todas as matérias</option>
          {subjects.data?.items.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
              {s.is_archived ? " (arquivada)" : ""}
            </option>
          ))}
        </Select>
        <Select label="Ordenar por" value={sortValue} onChange={(e) => { setSortValue(e.target.value); setPage(1); }}>
          {LESSON_SORTS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </div>

      {actionError && <Alert>{actionError}</Alert>}
      {lessons.error && (
        <div className="space-y-3">
          <Alert>{lessons.error}</Alert>
          <Button variant="secondary" onClick={lessons.reload}>
            Tentar novamente
          </Button>
        </div>
      )}
      {!lessons.data && lessons.loading && <Skeleton className="h-48" />}

      {lessons.data && lessons.data.items.length === 0 && (
        <EmptyState
          title={filtered ? "Nada encontrado" : "Sua biblioteca está vazia"}
          action={
            !filtered && (
              <Link href="/aulas/nova" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-fg">
                Cadastrar a primeira aula
              </Link>
            )
          }
        >
          {filtered ? "Tente outros termos ou remova os filtros." : "Cadastre uma aula com o texto da matéria para começar."}
        </EmptyState>
      )}

      {lessons.data && lessons.data.items.length > 0 && (
        <>
          <p className="text-sm text-muted" aria-live="polite">
            {lessons.data.total} {lessons.data.total === 1 ? "aula" : "aulas"}
          </p>
          <Card className={`p-0 ${lessons.loading ? "opacity-60" : ""}`}>
            <ul className="divide-y divide-line">
              {lessons.data.items.map((lesson) => (
                <li key={lesson.id} className="flex items-center gap-2 pr-2">
                  <Link href={`/aulas/${lesson.id}`} className="min-w-0 flex-1 px-4 py-3 hover:bg-surface-2">
                    <p className="truncate font-medium">{lesson.title}</p>
                    <p className="mt-0.5 flex items-center gap-2 text-xs text-muted">
                      <SubjectDot color={lesson.subject_color} />
                      <span className="truncate">{lesson.subject_name}</span>
                      <span aria-hidden="true">·</span>
                      <span>{lesson.lesson_date ? formatDate(lesson.lesson_date) : `atualizada ${formatDateTime(lesson.updated_at)}`}</span>
                    </p>
                  </Link>
                  <button
                    type="button"
                    onClick={() => toggleFavorite(lesson)}
                    aria-pressed={lesson.is_favorite}
                    aria-label={lesson.is_favorite ? `Desfavoritar ${lesson.title}` : `Favoritar ${lesson.title}`}
                    className={`rounded-lg p-2 hover:bg-surface-2 ${lesson.is_favorite ? "text-primary" : "text-muted"}`}
                  >
                    <StarIcon style={lesson.is_favorite ? { fill: "currentColor" } : undefined} />
                  </button>
                </li>
              ))}
            </ul>
          </Card>
          <Pagination page={page} pageSize={PAGE_SIZE} total={lessons.data.total} onChange={setPage} />
        </>
      )}
    </div>
  );
}

function SummariesTab({ q, favorite }: { q: string; favorite: boolean }) {
  const debouncedQ = useDebounced(q.trim());
  const [kind, setKind] = useState("");
  const [page, setPage] = useState(1);
  const params = new URLSearchParams({ page: String(page), page_size: String(PAGE_SIZE) });
  if (debouncedQ) params.set("q", debouncedQ);
  if (kind) params.set("kind", kind);
  if (favorite) params.set("favorite", "true");
  const summaries = useApi<Page<SummaryItem>>(`/summaries?${params}`);
  const filtered = Boolean(debouncedQ || kind || favorite);

  return (
    <div className="space-y-4">
      <Select label="Tipo" value={kind} onChange={(e) => { setKind(e.target.value); setPage(1); }}>
        <option value="">Todos os tipos</option>
        {Object.entries(SUMMARY_KIND_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </Select>

      {summaries.error && <Alert>{summaries.error}</Alert>}
      {!summaries.data && summaries.loading && <Skeleton className="h-48" />}
      {summaries.data && summaries.data.items.length === 0 && (
        <EmptyState title={filtered ? "Nada encontrado" : "Nenhum resumo salvo"}>
          {filtered
            ? "Tente outros termos ou remova os filtros."
            : "Abra uma aula, use a aba IA e salve o resultado como resumo."}
        </EmptyState>
      )}
      {summaries.data && summaries.data.items.length > 0 && (
        <>
          <p className="text-sm text-muted" aria-live="polite">
            {summaries.data.total} {summaries.data.total === 1 ? "resumo" : "resumos"}
          </p>
          <Card className={`p-0 ${summaries.loading ? "opacity-60" : ""}`}>
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
          <Pagination page={page} pageSize={PAGE_SIZE} total={summaries.data.total} onChange={setPage} />
        </>
      )}
    </div>
  );
}
