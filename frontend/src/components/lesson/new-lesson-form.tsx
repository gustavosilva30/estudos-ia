"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Alert, Button, Card, Field } from "@/components/ui/primitives";
import { EmptyState, PageHeader, Select, Textarea } from "@/components/ui/forms";
import { api } from "@/lib/api";
import { errorMessage, useApi } from "@/lib/use-api";
import type { AiOperations, Folder, LessonDetail, Page, Subject } from "@/lib/types";

const MAX_TEXT = 100_000;

export function NewLessonForm() {
  const router = useRouter();
  const search = useSearchParams();
  const subjects = useApi<Page<Subject>>("/subjects?page_size=100");
  const ai = useApi<AiOperations>("/ai/operations");

  const [subjectId, setSubjectId] = useState(search.get("materia") ?? "");
  const [folderId, setFolderId] = useState(search.get("pasta") ?? "");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(new Date().toLocaleDateString("sv-SE")); // AAAA-MM-DD, no fuso local
  const [observations, setObservations] = useState("");
  const [content, setContent] = useState("");
  const [pasted, setPasted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const folders = useApi<Folder[]>(subjectId ? `/folders?subject_id=${subjectId}` : null);
  const aiMax = ai.data?.max_input_chars;

  if (subjects.data && subjects.data.items.length === 0) {
    return (
      <div>
        <PageHeader title="Nova aula" />
        <EmptyState
          title="Crie uma matéria primeiro"
          action={
            <Link href="/materias" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-fg">
              Ir para Matérias
            </Link>
          }
        >
          Toda aula pertence a uma matéria.
        </EmptyState>
      </div>
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!subjectId) return setError("Escolha a matéria da aula.");
    if (content.length > MAX_TEXT) return setError(`O texto passa de ${MAX_TEXT.toLocaleString("pt-BR")} caracteres.`);
    setBusy(true);
    try {
      const lesson = await api<LessonDetail>("/lessons", {
        method: "POST",
        body: {
          subject_id: subjectId,
          folder_id: folderId || null,
          title: title.trim(),
          lesson_date: date || null,
          observations: observations.trim() || null,
          content: content.trim() ? content : null,
          origin: pasted ? "pasted" : "typed",
        },
      });
      router.push(`/aulas/${lesson.id}`);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader title="Nova aula" subtitle="O texto original é salvo exatamente como você enviar, antes de qualquer uso de IA." />
      <form onSubmit={submit} className="max-w-3xl space-y-5">
        {error && <Alert>{error}</Alert>}
        <Card className="space-y-4">
          <Field label="Título" required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Matéria"
              required
              value={subjectId}
              onChange={(e) => {
                setSubjectId(e.target.value);
                setFolderId("");
              }}
            >
              <option value="">Selecione…</option>
              {subjects.data?.items.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
            <Select label="Pasta (opcional)" value={folderId} onChange={(e) => setFolderId(e.target.value)} disabled={!subjectId}>
              <option value="">Sem pasta</option>
              {folders.data?.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </Select>
          </div>
          <Field label="Data da aula" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Textarea
            label="Observações (opcional)"
            rows={2}
            maxLength={5000}
            value={observations}
            onChange={(e) => setObservations(e.target.value)}
          />
        </Card>

        <Card className="space-y-2">
          <Textarea
            label="Texto da aula (opcional agora)"
            rows={12}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onPaste={(e) => {
              if (e.clipboardData.getData("text").length > 20) setPasted(true);
            }}
            hint="Digite ou cole o conteúdo. Você poderá editar depois e adicionar outros textos."
            className="font-mono"
          />
          <p
            className={`text-xs ${content.length > MAX_TEXT ? "text-danger" : "text-muted"}`}
            aria-live="polite"
          >
            {content.length.toLocaleString("pt-BR")} / {MAX_TEXT.toLocaleString("pt-BR")} caracteres
            {aiMax && content.length > aiMax && (
              <> · acima de {aiMax.toLocaleString("pt-BR")} a IA não conseguirá processar este texto de uma vez</>
            )}
          </p>
        </Card>

        <div className="flex gap-2">
          <Button type="submit" loading={busy}>
            Salvar aula
          </Button>
          <Button variant="secondary" onClick={() => router.back()} disabled={busy}>
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  );
}
