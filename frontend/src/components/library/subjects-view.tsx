"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Button, Card, Skeleton } from "@/components/ui/primitives";
import { Badge, EmptyState, PageHeader, SubjectDot } from "@/components/ui/forms";
import { PlusIcon } from "@/components/ui/icons";
import { useCategories } from "@/lib/use-categories";
import { useApi } from "@/lib/use-api";
import type { Page, Subject } from "@/lib/types";
import { SubjectFormModal } from "./subject-form";

export function SubjectsView() {
  const router = useRouter();
  const { labelOf } = useCategories();
  const [showArchived, setShowArchived] = useState(false);
  const [creating, setCreating] = useState(false);
  const { data, error, loading, reload } = useApi<Page<Subject>>(
    `/subjects?page_size=100&include_archived=${showArchived}`,
  );

  return (
    <div>
      <PageHeader
        title="Matérias"
        subtitle="Organize suas aulas por disciplina."
        actions={
          <Button onClick={() => setCreating(true)}>
            <PlusIcon /> Nova matéria
          </Button>
        }
      />

      <label className="mb-4 inline-flex items-center gap-2 text-sm">
        <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
        Mostrar arquivadas
      </label>

      {error && (
        <div className="space-y-3">
          <Alert>{error}</Alert>
          <Button variant="secondary" onClick={reload}>
            Tentar novamente
          </Button>
        </div>
      )}

      {!data && loading && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      )}

      {data && data.items.length === 0 && (
        <EmptyState
          title="Nenhuma matéria ainda"
          action={<Button onClick={() => setCreating(true)}>Criar a primeira matéria</Button>}
        >
          Crie uma matéria (por exemplo, Biologia) para começar a cadastrar aulas e textos.
        </EmptyState>
      )}

      {data && data.items.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.items.map((s) => (
            <li key={s.id}>
              <Link href={`/materias/${s.id}`} className="block h-full">
                <Card className="h-full transition-colors hover:bg-surface-2">
                  <div className="flex items-center gap-2">
                    <SubjectDot color={s.color} />
                    <h2 className="truncate font-semibold">{s.name}</h2>
                    {s.category !== "outro" && <Badge tone="primary">{labelOf(s.category)}</Badge>}
                    {s.is_archived && <Badge>Arquivada</Badge>}
                  </div>
                  {s.description && <p className="mt-2 line-clamp-2 text-sm text-muted">{s.description}</p>}
                  <p className="mt-3 text-sm text-muted">
                    {s.lesson_count} {s.lesson_count === 1 ? "aula" : "aulas"}
                  </p>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <SubjectFormModal
        open={creating}
        onClose={() => setCreating(false)}
        onSaved={(subject) => {
          setCreating(false);
          router.push(`/materias/${subject.id}`);
        }}
      />
    </div>
  );
}
