"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Alert, Button, Card, Skeleton } from "@/components/ui/primitives";
import { PlusIcon, SparkIcon, StarIcon } from "@/components/ui/icons";
import { api, ApiError } from "@/lib/api";
import { firstName, formatDateTime, SUMMARY_KIND_LABELS } from "@/lib/format";
import { useSession } from "@/lib/session";
import type { Dashboard } from "@/lib/types";

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-3xl font-semibold tabular-nums">{value}</p>
    </Card>
  );
}

function LoadingState() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Carregando painel">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-28" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg bg-surface-2 px-3 py-4 text-sm text-muted">{children}</p>;
}

export function DashboardView() {
  const { state } = useSession();
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setError(null);
    try {
      setData(await api<Dashboard>("/dashboard", { signal }));
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof ApiError ? err.message : "Não foi possível carregar o painel.");
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    // Busca inicial dos indicadores reais no backend.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const name = state.status === "authed" ? firstName(state.user.display_name, state.user.email) : "";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Olá, {name}</h1>
        <p className="text-sm text-muted">Veja como estão os seus estudos.</p>
      </div>

      {error && (
        <div className="space-y-3">
          <Alert>{error}</Alert>
          <Button variant="secondary" onClick={() => void load()}>
            Tentar novamente
          </Button>
        </div>
      )}

      {!data && !error && <LoadingState />}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Matérias" value={data.counts.subjects} />
            <Stat label="Aulas" value={data.counts.lessons} />
            <Stat label="Resumos" value={data.counts.summaries} />
            <Stat label="Favoritos" value={data.counts.favorites} />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2" aria-labelledby="progresso">
              <h2 id="progresso" className="font-semibold">
                Progresso dos estudos
              </h2>
              {data.progress.lessons_total === 0 ? (
                <div className="mt-3">
                  <Empty>Cadastre sua primeira aula para acompanhar o progresso.</Empty>
                </div>
              ) : (
                <>
                  <p className="mt-1 text-sm text-muted">
                    {data.progress.lessons_with_summary} de {data.progress.lessons_total} aulas já têm resumo ou
                    material de estudo · {data.progress.lessons_with_material} têm texto salvo.
                  </p>
                  <div
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={data.progress.percent_with_summary}
                    aria-label="Aulas com resumo"
                    className="mt-3 h-3 overflow-hidden rounded-full bg-surface-2"
                  >
                    <div
                      className="h-full rounded-full bg-primary transition-[width]"
                      style={{ width: `${data.progress.percent_with_summary}%` }}
                    />
                  </div>
                  <p className="mt-1 text-right text-xs text-muted">{data.progress.percent_with_summary}%</p>
                </>
              )}
            </Card>

            <Card aria-labelledby="revisoes">
              <h2 id="revisoes" className="font-semibold">
                Revisões pendentes
              </h2>
              {data.reviews.available ? (
                <p className="mt-2 text-3xl font-semibold tabular-nums">{data.reviews.pending}</p>
              ) : (
                <p className="mt-2 text-sm text-muted">
                  O módulo de revisão (perguntas, flashcards e revisão periódica) ainda será implementado. As
                  revisões pendentes aparecerão aqui.
                </p>
              )}
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card aria-labelledby="ultimas-aulas">
              <h2 id="ultimas-aulas" className="font-semibold">
                Últimos conteúdos estudados
              </h2>
              {data.recent_lessons.length === 0 ? (
                <div className="mt-3">
                  <Empty>Nenhuma aula ainda. Seus conteúdos mais recentes aparecerão aqui.</Empty>
                </div>
              ) : (
                <ul className="mt-3 divide-y divide-line">
                  {data.recent_lessons.map((lesson) => (
                    <li key={lesson.id}>
                     <Link href={`/aulas/${lesson.id}`} className="flex items-start justify-between gap-3 py-2.5 hover:opacity-80">
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                          {lesson.is_favorite && (
                            <StarIcon width={14} height={14} aria-label="Favorita" className="shrink-0 text-primary" />
                          )}
                          <span className="truncate">{lesson.title}</span>
                        </p>
                        <p className="flex items-center gap-1.5 text-xs text-muted">
                          <span
                            aria-hidden="true"
                            className="h-2 w-2 shrink-0 rounded-full bg-primary"
                            style={lesson.subject_color ? { backgroundColor: lesson.subject_color } : undefined}
                          />
                          <span className="truncate">{lesson.subject_name}</span>
                        </p>
                      </div>
                      <time dateTime={lesson.updated_at} className="shrink-0 text-xs text-muted">
                        {formatDateTime(lesson.updated_at)}
                      </time>
                     </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card aria-labelledby="resumos-recentes">
              <h2 id="resumos-recentes" className="font-semibold">
                Resumos recentes
              </h2>
              {data.recent_summaries.length === 0 ? (
                <div className="mt-3">
                  <Empty>Nenhum resumo salvo. Os resumos gerados e editados aparecerão aqui.</Empty>
                </div>
              ) : (
                <ul className="mt-3 divide-y divide-line">
                  {data.recent_summaries.map((summary) => (
                    <li key={summary.id}>
                     <Link href={`/resumos/${summary.id}`} className="flex items-start justify-between gap-3 py-2.5 hover:opacity-80">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{summary.title}</p>
                        <p className="truncate text-xs text-muted">
                          {SUMMARY_KIND_LABELS[summary.kind] ?? summary.kind} · {summary.lesson_title}
                        </p>
                      </div>
                      <time dateTime={summary.updated_at} className="shrink-0 text-xs text-muted">
                        {formatDateTime(summary.updated_at)}
                      </time>
                     </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card aria-labelledby="acesso-rapido">
              <h2 id="acesso-rapido" className="font-semibold">
                Acesso rápido
              </h2>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Link
                  href="/aulas/nova"
                  className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-fg hover:bg-primary-hover"
                >
                  <PlusIcon /> Adicionar material
                </Link>
                <Link href="/materias" className="text-sm text-primary hover:underline">
                  Gerenciar matérias
                </Link>
              </div>
            </Card>

            <Card aria-labelledby="uso-ia">
              <h2 id="uso-ia" className="flex items-center gap-2 font-semibold">
                <SparkIcon width={18} height={18} /> Uso de IA hoje
              </h2>
              <p className="mt-2 text-sm">
                <span className="text-2xl font-semibold tabular-nums">{data.ai_usage.used_today}</span>{" "}
                <span className="text-muted">de {data.ai_usage.daily_limit} usos permitidos</span>
              </p>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
