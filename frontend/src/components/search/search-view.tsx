"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Fragment, useState } from "react";
import { Alert, Card, Field, Skeleton } from "@/components/ui/primitives";
import { Badge, EmptyState, PageHeader, SubjectDot } from "@/components/ui/forms";
import { formatDate, formatDateTime, SUMMARY_KIND_LABELS } from "@/lib/format";
import { useApi, useDebounced } from "@/lib/use-api";
import type { SearchResults } from "@/lib/types";

/** O backend marca os termos achados com << e >> (texto puro). Convertemos em <mark> sem usar HTML. */
function Snippet({ text }: { text: string }) {
  const parts = text.split(/(<<[\s\S]*?>>)/);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("<<") && part.endsWith(">>") ? (
          <mark key={i} className="rounded bg-primary-soft px-0.5 text-fg">
            {part.slice(2, -2)}
          </mark>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}

export function SearchView() {
  const router = useRouter();
  const initial = useSearchParams().get("q") ?? "";
  const [q, setQ] = useState(initial);
  const term = useDebounced(q.trim(), 350);
  const enabled = term.length >= 2;
  const results = useApi<SearchResults>(enabled ? `/search?q=${encodeURIComponent(term)}` : null);

  const data = enabled ? results.data : undefined;
  const nothing =
    data && data.subjects.length === 0 && data.lessons.length === 0 && data.summaries.length === 0;

  return (
    <div>
      <PageHeader title="Pesquisar" subtitle="Busca em matérias, aulas (títulos e textos) e resumos." />
      <form
        role="search"
        className="mb-6 max-w-xl"
        onSubmit={(e) => {
          e.preventDefault();
          router.replace(`/busca?q=${encodeURIComponent(q.trim())}`);
        }}
      >
        <Field
          label="O que você procura?"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          maxLength={200}
          autoFocus
          hint={q.trim().length === 1 ? "Digite pelo menos 2 caracteres." : undefined}
        />
      </form>

      {results.error && <Alert>{results.error}</Alert>}
      {enabled && !data && results.loading && <Skeleton className="h-40" />}
      {!enabled && !q.trim() && (
        <EmptyState title="Digite para pesquisar">Encontre rapidamente qualquer aula, texto ou resumo seu.</EmptyState>
      )}
      {nothing && <EmptyState title="Nada encontrado">Tente outras palavras ou o início de uma palavra.</EmptyState>}

      {data && !nothing && (
        <div className={`space-y-6 ${results.loading ? "opacity-60" : ""}`} aria-live="polite">
          {data.subjects.length > 0 && (
            <section aria-labelledby="r-materias">
              <h2 id="r-materias" className="mb-2 font-semibold">
                Matérias
              </h2>
              <Card className="p-0">
                <ul className="divide-y divide-line">
                  {data.subjects.map((s) => (
                    <li key={s.id}>
                      <Link href={`/materias/${s.id}`} className="flex items-center gap-2 px-4 py-3 hover:bg-surface-2">
                        <SubjectDot color={s.color} />
                        <span className="font-medium">{s.name}</span>
                        {s.is_archived && <Badge>Arquivada</Badge>}
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            </section>
          )}

          {data.lessons.length > 0 && (
            <section aria-labelledby="r-aulas">
              <div className="mb-2 flex items-baseline justify-between">
                <h2 id="r-aulas" className="font-semibold">
                  Aulas
                </h2>
                {data.lessons_total > data.lessons.length && (
                  <Link href={`/biblioteca?q=${encodeURIComponent(data.query)}`} className="text-sm text-primary hover:underline">
                    Ver todas ({data.lessons_total}) na biblioteca
                  </Link>
                )}
              </div>
              <Card className="p-0">
                <ul className="divide-y divide-line">
                  {data.lessons.map((lesson) => (
                    <li key={lesson.id}>
                      <Link href={`/aulas/${lesson.id}`} className="block px-4 py-3 hover:bg-surface-2">
                        <p className="font-medium">{lesson.title}</p>
                        <p className="mt-0.5 flex items-center gap-2 text-xs text-muted">
                          <SubjectDot color={lesson.subject_color} />
                          {lesson.subject_name} ·{" "}
                          {lesson.lesson_date ? formatDate(lesson.lesson_date) : formatDateTime(lesson.updated_at)}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            </section>
          )}

          {data.summaries.length > 0 && (
            <section aria-labelledby="r-resumos">
              <div className="mb-2 flex items-baseline justify-between">
                <h2 id="r-resumos" className="font-semibold">
                  Resumos
                </h2>
                {data.summaries_total > data.summaries.length && (
                  <span className="text-sm text-muted">
                    mostrando {data.summaries.length} de {data.summaries_total}
                  </span>
                )}
              </div>
              <Card className="p-0">
                <ul className="divide-y divide-line">
                  {data.summaries.map((s) => (
                    <li key={s.id}>
                      <Link href={`/resumos/${s.id}`} className="block px-4 py-3 hover:bg-surface-2">
                        <p className="flex items-center gap-2 font-medium">
                          {s.title} <Badge>{SUMMARY_KIND_LABELS[s.kind] ?? s.kind}</Badge>
                        </p>
                        <p className="mt-0.5 text-xs text-muted">Aula: {s.lesson_title}</p>
                        <p className="mt-1 text-sm text-muted">
                          <Snippet text={s.snippet} />
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
