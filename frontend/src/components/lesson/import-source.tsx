"use client";

import { useRef, useState } from "react";
import { Alert, Button, Card, Field } from "@/components/ui/primitives";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/use-api";
import type { Material } from "@/lib/types";

export const MAX_PDF_BYTES = 15_000_000;

export function validatePdf(file: File): string | null {
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) return "Escolha um arquivo PDF.";
  if (file.size === 0) return "O arquivo está vazio.";
  if (file.size > MAX_PDF_BYTES) return `O PDF passa de ${MAX_PDF_BYTES / 1_000_000} MB. Envie por partes.`;
  return null;
}

export function validateLink(value: string): string | null {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return "Use um endereço que comece com http:// ou https://.";
  } catch {
    return "Informe um endereço válido, por exemplo https://site.com/aula.";
  }
  return null;
}

/** Importa um PDF ou uma página web: o servidor extrai o texto e salva como texto original da aula (editável). */
export function ImportSource({ lessonId, onImported }: { lessonId: string; onImported: () => void }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState<"pdf" | "link" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function run(kind: "pdf" | "link", request: () => Promise<Material>) {
    setBusy(kind);
    setError(null);
    setDone(null);
    try {
      await request();
      setDone(
        kind === "pdf"
          ? "PDF lido: o texto foi salvo abaixo. Revise se quiser e use a aba Inteligência Artificial."
          : "Página lida: o texto foi salvo abaixo. Revise se quiser e use a aba Inteligência Artificial.",
      );
      if (kind === "link") setUrl("");
      onImported();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  function sendPdf(file: File) {
    const problem = validatePdf(file);
    if (problem) return setError(problem);
    const form = new FormData();
    form.append("file", file, file.name);
    void run("pdf", () => api<Material>(`/lessons/${lessonId}/materials/from-file`, { method: "POST", form }));
  }

  function sendLink() {
    const problem = validateLink(url);
    if (problem) return setError(problem);
    void run("link", () =>
      api<Material>(`/lessons/${lessonId}/materials/from-link`, { method: "POST", body: { url: url.trim() } }),
    );
  }

  return (
    <Card className="space-y-4">
      <div>
        <h3 className="font-semibold">Importar documento ou link</h3>
        <p className="mt-1 text-sm text-muted">
          O texto do PDF ou da página é extraído e salvo como texto da aula. Você pode revisá-lo e a IA passa a usá-lo
          para resumos, flashcards e exercícios. O arquivo em si não é guardado.
        </p>
      </div>
      {error && <Alert>{error}</Alert>}
      {done && <Alert tone="success">{done}</Alert>}

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => fileInput.current?.click()} loading={busy === "pdf"} disabled={busy === "link"}>
          Enviar PDF
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept="application/pdf,.pdf"
          className="sr-only"
          aria-label="Escolher PDF"
          tabIndex={-1}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) sendPdf(file);
          }}
        />
        <span className="text-xs text-muted">PDFs com texto, até {MAX_PDF_BYTES / 1_000_000} MB. Escaneados: envie como imagem.</span>
      </div>

      <form
        className="flex flex-col gap-2 sm:flex-row sm:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          sendLink();
        }}
      >
        <div className="flex-1">
          <Field
            label="Endereço de uma página ou PDF público"
            type="url"
            inputMode="url"
            placeholder="https://site.com/aula"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            maxLength={2000}
          />
        </div>
        <Button type="submit" variant="secondary" loading={busy === "link"} disabled={busy === "pdf" || !url.trim()}>
          Ler link
        </Button>
      </form>
      <p className="text-xs text-muted">
        Só páginas públicas. Conteúdo que exige login, ou que depende de JavaScript para aparecer, não pode ser lido:
        nesse caso, cole o texto manualmente.
      </p>
    </Card>
  );
}
