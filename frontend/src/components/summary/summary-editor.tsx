"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Markdown } from "@/components/markdown";
import { Alert, Button, Card, Field, Skeleton } from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Badge, PageHeader } from "@/components/ui/forms";
import { StarIcon, TrashIcon } from "@/components/ui/icons";
import { api } from "@/lib/api";
import { formatDateTime, SUMMARY_KIND_LABELS } from "@/lib/format";
import { errorMessage, useApi } from "@/lib/use-api";
import type { Summary, SummaryVersion } from "@/lib/types";

const MAX_CONTENT = 100_000;
type ToolId = "titulo" | "subtitulo" | "destacar" | "italico" | "lista" | "numerada" | "citacao";

const TOOLS: { id: ToolId; label: string; title: string }[] = [
  { id: "titulo", label: "Título", title: "Título (##)" },
  { id: "subtitulo", label: "Subtítulo", title: "Subtítulo (###)" },
  { id: "destacar", label: "Destacar", title: "Destacar conceito (negrito)" },
  { id: "italico", label: "Itálico", title: "Itálico" },
  { id: "lista", label: "Lista", title: "Lista com marcadores" },
  { id: "numerada", label: "1. 2. 3.", title: "Lista numerada" },
  { id: "citacao", label: "Citação", title: "Observação / citação" },
];

const ORIGIN_LABELS = { ai: "gerada pela IA", user: "editada por você", duplicate: "cópia" } as const;

export function SummaryEditor({ id }: { id: string }) {
  const summary = useApi<Summary>(`/summaries/${id}`);
  const versions = useApi<SummaryVersion[]>(`/summaries/${id}/versions`);

  if (summary.error) {
    return (
      <div className="space-y-4">
        <Alert>{summary.error}</Alert>
        <Link href="/biblioteca" className="text-primary hover:underline">
          Voltar para a biblioteca
        </Link>
      </div>
    );
  }
  if (!summary.data) return <Skeleton className="h-64" />;

  // `key`: ao salvar/restaurar (nova versão) o editor reinicia a partir do que está no servidor.
  return (
    <EditorBody
      key={`${summary.data.id}-${summary.data.current_version}`}
      summary={summary.data}
      versions={versions.data ?? []}
      onChanged={() => {
        summary.reload();
        versions.reload();
      }}
    />
  );
}

function EditorBody({
  summary,
  versions,
  onChanged,
}: {
  summary: Summary;
  versions: SummaryVersion[];
  onChanged: () => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(summary.title);
  const [content, setContent] = useState(summary.content);
  const [mode, setMode] = useState<"editar" | "previa">("editar");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [restoring, setRestoring] = useState<SummaryVersion | null>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);

  const dirty = title !== summary.title || content !== summary.content;
  const invalid = !title.trim() || !content.trim() || content.length > MAX_CONTENT;

  // Avisa antes de fechar/recarregar a aba com alterações não salvas.
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  async function run(name: string, action: () => Promise<void>) {
    setError(null);
    setBusy(name);
    try {
      await action();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  const save = () =>
    run("save", async () => {
      await api(`/summaries/${summary.id}`, { method: "PATCH", body: { title: title.trim(), content } });
      setSaved(true);
      onChanged();
    });

  // Ctrl+S / Cmd+S salva.
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  });
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (dirty && !invalid) void saveRef.current();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [dirty, invalid]);

  /* ----- barra de formatação (Markdown) ----- */
  function edit(transform: (value: string, start: number, end: number) => { text: string; start: number; end: number }) {
    const el = textarea.current;
    if (!el) return;
    const result = transform(content, el.selectionStart, el.selectionEnd);
    setContent(result.text);
    setSaved(false);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(result.start, result.end);
    });
  }

  const wrap = (before: string, after: string, placeholder: string) =>
    edit((value, start, end) => {
      const selected = value.slice(start, end) || placeholder;
      const text = value.slice(0, start) + before + selected + after + value.slice(end);
      return { text, start: start + before.length, end: start + before.length + selected.length };
    });

  const prefixLines = (prefix: string) =>
    edit((value, start, end) => {
      const lineStart = value.lastIndexOf("\n", start - 1) + 1;
      const block = value.slice(lineStart, end);
      const prefixed = block
        .split("\n")
        .map((line, i) => (prefix === "1. " ? `${i + 1}. ${line}` : `${prefix}${line}`))
        .join("\n");
      return { text: value.slice(0, lineStart) + prefixed + value.slice(end), start: lineStart, end: lineStart + prefixed.length };
    });

  function applyTool(tool: ToolId) {
    switch (tool) {
      case "titulo":
        return prefixLines("## ");
      case "subtitulo":
        return prefixLines("### ");
      case "destacar":
        return wrap("**", "**", "conceito");
      case "italico":
        return wrap("*", "*", "texto");
      case "lista":
        return prefixLines("- ");
      case "numerada":
        return prefixLines("1. ");
      case "citacao":
        return prefixLines("> ");
    }
  }

  function exportTxt() {
    const name = (title.trim() || "resumo")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase();
    const blob = new Blob([`${title.trim()}\n\n${content}\n`], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${name || "resumo"}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <PageHeader
        title="Editar resumo"
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Badge>{SUMMARY_KIND_LABELS[summary.kind] ?? summary.kind}</Badge>
            <span>versão {summary.current_version}</span>
            <Link href={`/aulas/${summary.lesson_id}`} className="text-primary hover:underline">
              Ver aula e texto original
            </Link>
          </span>
        }
        actions={
          <>
            <Button
              variant="secondary"
              aria-pressed={summary.is_favorite}
              loading={busy === "fav"}
              onClick={() =>
                run("fav", async () => {
                  await api(`/summaries/${summary.id}`, { method: "PATCH", body: { is_favorite: !summary.is_favorite } });
                  onChanged();
                })
              }
            >
              <StarIcon style={summary.is_favorite ? { fill: "currentColor" } : undefined} />
              {summary.is_favorite ? "Favorito" : "Favoritar"}
            </Button>
            <Button
              variant="secondary"
              loading={busy === "dup"}
              onClick={() =>
                run("dup", async () => {
                  const copy = await api<Summary>(`/summaries/${summary.id}/duplicate`, { method: "POST" });
                  router.push(`/resumos/${copy.id}`);
                })
              }
            >
              Duplicar
            </Button>
            <Button variant="secondary" onClick={exportTxt}>
              Exportar TXT
            </Button>
            <Button variant="secondary" disabled title="A exportação em PDF ainda não foi implementada">
              PDF (em breve)
            </Button>
            <Button variant="secondary" onClick={() => setDeleting(true)} aria-label="Excluir resumo">
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

      <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        <div className="min-w-0 space-y-4">
          <Field
            label="Título"
            value={title}
            maxLength={200}
            onChange={(e) => {
              setTitle(e.target.value);
              setSaved(false);
            }}
          />

          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div role="tablist" aria-label="Modo" className="flex gap-1 rounded-lg bg-surface-2 p-1">
                {(["editar", "previa"] as const).map((m) => (
                  <button
                    key={m}
                    role="tab"
                    type="button"
                    aria-selected={mode === m}
                    onClick={() => setMode(m)}
                    className={`min-h-8 rounded-md px-3 text-sm font-medium ${mode === m ? "bg-surface shadow-sm" : "text-muted"}`}
                  >
                    {m === "editar" ? "Editar" : "Pré-visualizar"}
                  </button>
                ))}
              </div>
              {mode === "editar" && (
                <div role="toolbar" aria-label="Formatação" className="flex flex-wrap gap-1">
                  {TOOLS.map((tool) => (
                    <button
                      key={tool.id}
                      type="button"
                      title={tool.title}
                      onClick={() => applyTool(tool.id)}
                      className="min-h-8 rounded-md border border-line bg-surface px-2.5 text-xs font-medium hover:bg-surface-2"
                    >
                      {tool.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {mode === "editar" ? (
              <>
                <label htmlFor="conteudo-resumo" className="sr-only">
                  Conteúdo do resumo
                </label>
                <textarea
                  id="conteudo-resumo"
                  ref={textarea}
                  value={content}
                  onChange={(e) => {
                    setContent(e.target.value);
                    setSaved(false);
                  }}
                  rows={22}
                  spellCheck
                  className="block min-h-[26rem] w-full rounded-lg border border-line bg-surface p-4 font-mono text-sm leading-relaxed"
                />
              </>
            ) : (
              <div className="min-h-[26rem] rounded-lg border border-line bg-surface p-5">
                <h2 className="mb-3 text-xl font-semibold">{title}</h2>
                <Markdown>{content}</Markdown>
              </div>
            )}
            <p className={`mt-1 text-xs ${content.length > MAX_CONTENT ? "text-danger" : "text-muted"}`}>
              {content.length.toLocaleString("pt-BR")} / {MAX_CONTENT.toLocaleString("pt-BR")} caracteres · aceita
              Markdown
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={save} loading={busy === "save"} disabled={!dirty || invalid}>
              Salvar nova versão
            </Button>
            <span role="status" className="text-sm text-muted">
              {dirty ? "Há alterações não salvas." : saved ? "Salvo." : "Tudo salvo."}
            </span>
            <span className="text-xs text-muted">Atalho: Ctrl+S</span>
          </div>
        </div>

        <aside aria-label="Histórico de versões" className="space-y-3">
          <Card className="p-4">
            <h2 className="font-semibold">Versões</h2>
            <p className="mt-1 text-xs text-muted">
              Cada salvamento cria uma nova versão; as anteriores ficam guardadas. O texto original da aula não é
              afetado.
            </p>
            <ul className="mt-3 space-y-2">
              {versions.map((v) => {
                const current = v.version_number === summary.current_version;
                return (
                  <li key={v.version_number} className="rounded-lg border border-line p-2.5 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">
                        Versão {v.version_number} {current && <Badge tone="primary">atual</Badge>}
                      </span>
                    </div>
                    <p className="text-xs text-muted">
                      {ORIGIN_LABELS[v.origin]} · {formatDateTime(v.created_at)}
                    </p>
                    <details className="mt-1">
                      <summary className="cursor-pointer text-xs text-primary">Ver conteúdo</summary>
                      <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded bg-surface-2 p-2 font-sans text-xs">
                        {v.content}
                      </pre>
                    </details>
                    {!current && (
                      <Button variant="secondary" className="mt-2 min-h-8 px-3 text-xs" onClick={() => setRestoring(v)}>
                        Restaurar esta versão
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>
        </aside>
      </div>

      <ConfirmDialog
        open={deleting}
        title="Excluir resumo?"
        description="O resumo e todo o seu histórico de versões serão excluídos. O texto original da aula não é afetado. Esta ação não pode ser desfeita."
        loading={busy === "delete"}
        onCancel={() => setDeleting(false)}
        onConfirm={() =>
          run("delete", async () => {
            await api(`/summaries/${summary.id}`, { method: "DELETE" });
            router.replace(`/aulas/${summary.lesson_id}`);
          })
        }
      />

      <ConfirmDialog
        open={restoring !== null}
        title={`Restaurar a versão ${restoring?.version_number}?`}
        description={`O conteúdo dela se tornará uma nova versão (a ${summary.current_version + 1}ª) e nada será apagado.${dirty ? " Suas alterações não salvas serão descartadas." : ""}`}
        confirmLabel="Restaurar"
        loading={busy === "restore"}
        onCancel={() => setRestoring(null)}
        onConfirm={() =>
          run("restore", async () => {
            if (restoring) {
              await api(`/summaries/${summary.id}/versions/${restoring.version_number}/restore`, { method: "POST" });
            }
            setRestoring(null);
            onChanged();
          })
        }
      />
    </div>
  );
}
