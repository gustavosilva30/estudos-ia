"use client";

import Link from "next/link";
import { useState } from "react";
import { Select } from "@/components/ui/forms";
import { Alert, Button } from "@/components/ui/primitives";
import { api } from "@/lib/api";
import { formulaKey, type Formula } from "@/lib/formula-engine";
import { formulaAsText } from "@/lib/formula-custom";
import type { FormulaLesson, LessonListItem, Material, Page } from "@/lib/types";
import { errorMessage, useApi } from "@/lib/use-api";

/** Vincula a fórmula a uma aula e/ou salva a fórmula como texto da aula (para a IA estudar). */
export function FormulaLessons({ formula, note }: { formula: Formula; note: string | null }) {
  const key = formulaKey(formula);
  const linked = useApi<FormulaLesson[]>(`/formulas/${key}/lessons`);
  const lessons = useApi<Page<LessonListItem>>("/lessons?page=1&page_size=100&sort=updated_at");
  const [lessonId, setLessonId] = useState("");
  const [busy, setBusy] = useState<"link" | "text" | null>(null);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  const items = lessons.data?.items ?? [];

  async function run(kind: "link" | "text") {
    if (!lessonId) return;
    setBusy(kind);
    setMessage(null);
    try {
      if (kind === "link") {
        await api(`/lessons/${lessonId}/formulas`, { method: "POST", body: { formula_key: key } });
        linked.reload();
        setMessage({ tone: "success", text: "Fórmula vinculada à aula." });
      } else {
        await api<Material>(`/lessons/${lessonId}/materials`, {
          method: "POST",
          body: { content: formulaAsText(formula, note), origin: "formula" },
        });
        setMessage({ tone: "success", text: "Fórmula salva como texto da aula. Agora a IA pode resumir e criar exercícios sobre ela." });
      }
    } catch (error) {
      setMessage({ tone: "error", text: errorMessage(error) });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      <h3 className="font-semibold">Aulas</h3>
      {linked.data && linked.data.length > 0 && (
        <ul className="space-y-1 text-sm">
          {linked.data.map((l) => (
            <li key={l.lesson_id}>
              <Link href={`/aulas/${l.lesson_id}`} className="text-primary hover:underline">
                {l.lesson_title}
              </Link>{" "}
              <span className="text-muted">· {l.subject_name}</span>
            </li>
          ))}
        </ul>
      )}
      {linked.data && linked.data.length === 0 && <p className="text-sm text-muted">Ainda não está vinculada a nenhuma aula.</p>}

      {message && <Alert tone={message.tone}>{message.text}</Alert>}
      {lessons.error ? (
        <Alert>{lessons.error}</Alert>
      ) : items.length === 0 && !lessons.loading ? (
        <p className="text-sm text-muted">Crie uma aula na sua biblioteca para vincular fórmulas a ela.</p>
      ) : (
        <>
          <Select label="Escolha uma aula" value={lessonId} onChange={(e) => setLessonId(e.target.value)}>
            <option value="">Selecione…</option>
            {items.map((l) => (
              <option key={l.id} value={l.id}>
                {l.subject_name} · {l.title}
              </option>
            ))}
          </Select>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" disabled={!lessonId} loading={busy === "link"} onClick={() => void run("link")}>
              Vincular à aula
            </Button>
            <Button variant="secondary" disabled={!lessonId} loading={busy === "text"} onClick={() => void run("text")}>
              Salvar como texto da aula
            </Button>
          </div>
          <p className="text-xs text-muted">“Salvar como texto” cria um texto na aula com a equação, as variáveis e a sua anotação. Depois, use a aba IA da aula.</p>
        </>
      )}
    </div>
  );
}
