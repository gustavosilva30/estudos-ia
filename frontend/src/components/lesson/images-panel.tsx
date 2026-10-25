"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState, Select } from "@/components/ui/forms";
import { SparkIcon, TrashIcon } from "@/components/ui/icons";
import { Alert, Button, Card } from "@/components/ui/primitives";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { errorMessage } from "@/lib/use-api";
import type { Attachment, Generation } from "@/lib/types";
import { GenerationResult } from "./generation-result";

const ACCEPT = "image/png,image/jpeg,image/webp";
const MAX_BYTES = 8_000_000;

type Operation = "ocr_imagem" | "resolver_problema";

function validate(file: File): string | null {
  if (/heic|heif/i.test(file.type) || /\.(heic|heif)$/i.test(file.name)) {
    return "Fotos em formato HEIC não são aceitas. Envie como JPEG (ou tire um print da foto).";
  }
  if (!ACCEPT.split(",").includes(file.type)) return "Formato não suportado. Use PNG, JPEG ou WebP.";
  if (file.size > MAX_BYTES) return `A imagem passa de ${MAX_BYTES / 1_000_000} MB. Reduza o tamanho e tente de novo.`;
  if (file.size === 0) return "O arquivo está vazio.";
  return null;
}

interface Props {
  lessonId: string;
  attachments: Attachment[];
  categoryLabel?: string;
  onChanged: () => void;
  /** Depois de salvar a transcrição como texto original: atualiza a aula. */
  onMaterialSaved: () => void;
}

export function ImagesPanel({ lessonId, attachments, categoryLabel, onChanged, onMaterialSaved }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<"curto" | "medio" | "detalhado">("medio");
  const [results, setResults] = useState<Record<string, Generation>>({});
  const [running, setRunning] = useState<{ id: string; operation: Operation } | null>(null);
  const [toDelete, setToDelete] = useState<Attachment | null>(null);
  const [deleting, setDeleting] = useState(false);

  const upload = useCallback(
    async (file: File) => {
      const problem = validate(file);
      if (problem) return setError(problem);
      setError(null);
      setUploading(true);
      try {
        const form = new FormData();
        form.append("file", file, file.name || "imagem.png");
        await api<Attachment>(`/lessons/${lessonId}/attachments`, { method: "POST", form });
        onChanged();
      } catch (err) {
        setError(errorMessage(err));
      } finally {
        setUploading(false);
      }
    },
    [lessonId, onChanged],
  );

  // Colar um print (Ctrl+V) em qualquer lugar da aba — exceto quando a pessoa está colando texto num campo.
  const uploadRef = useRef(upload);
  useEffect(() => {
    uploadRef.current = upload;
  }, [upload]);
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      const file = Array.from(event.clipboardData?.files ?? []).find((f) => f.type.startsWith("image/"));
      if (!file) return;
      event.preventDefault();
      void uploadRef.current(file);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  async function run(attachment: Attachment, operation: Operation, force = false) {
    setError(null);
    setRunning({ id: attachment.id, operation });
    try {
      const generation = await api<Generation>("/ai/generate", {
        method: "POST",
        body: {
          attachment_id: attachment.id,
          operation,
          detail_level: operation === "resolver_problema" ? detail : null,
          force,
        },
      });
      setResults((current) => ({ ...current, [attachment.id]: generation }));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setRunning(null);
    }
  }

  async function remove(attachment: Attachment) {
    setDeleting(true);
    setError(null);
    try {
      await api(`/attachments/${attachment.id}`, { method: "DELETE" });
      setResults((current) => {
        const { [attachment.id]: _removed, ...rest } = current;
        void _removed;
        return rest;
      });
      setToDelete(null);
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          const file = event.dataTransfer.files[0];
          if (file) void upload(file);
        }}
        className={`rounded-xl border-2 border-dashed p-6 text-center ${dragging ? "border-primary bg-primary-soft" : "border-line"}`}
      >
        <p className="font-medium">Envie uma imagem ou print</p>
        <p className="mx-auto mt-1 max-w-xl text-sm text-muted">
          Arraste aqui, <strong>cole com Ctrl+V</strong> ou escolha um arquivo. Funciona com fotos de caderno, páginas
          de livro e exercícios. A IA transcreve o texto ou resolve o problema
          {categoryLabel && categoryLabel !== "Outra" ? <> como questão de <strong>{categoryLabel}</strong></> : null}.
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <Button onClick={() => fileInput.current?.click()} loading={uploading}>
            Escolher imagem
          </Button>
          <Button variant="secondary" onClick={() => cameraInput.current?.click()} disabled={uploading}>
            Tirar foto
          </Button>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          aria-label="Escolher imagem"
          tabIndex={-1}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = ""; // permite escolher o mesmo arquivo de novo
            if (file) void upload(file);
          }}
        />
        <input
          ref={cameraInput}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          aria-label="Tirar foto"
          tabIndex={-1}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void upload(file);
          }}
        />
        <p className="mt-3 text-xs text-muted">
          Dica: recorte só o enunciado e mantenha a imagem reta e nítida. A imagem é enviada ao provedor de IA para ser
          lida: evite imagens com dados pessoais.
        </p>
      </div>

      {error && <Alert>{error}</Alert>}

      {attachments.length === 0 && (
        <EmptyState title="Nenhuma imagem nesta aula">
          Envie um print de um exercício para a IA resolver, ou uma foto de uma página para transformar em texto.
        </EmptyState>
      )}

      {attachments.length > 0 && (
        <Select
          label="Nível de detalhe da resolução"
          value={detail}
          onChange={(event) => setDetail(event.target.value as typeof detail)}
        >
          <option value="curto">Curto: só o essencial</option>
          <option value="medio">Médio</option>
          <option value="detalhado">Detalhado: explica o porquê de cada passo</option>
        </Select>
      )}

      {attachments.map((attachment, index) => {
        const result = results[attachment.id];
        const busy = running?.id === attachment.id;
        return (
          <div key={attachment.id} className="space-y-3">
            <Card className="grid gap-4 sm:grid-cols-[minmax(0,16rem)_1fr]">
              <a
                href={`/api/v1/attachments/${attachment.id}/content`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Abrir a imagem ${index + 1} em tamanho real`}
                className="block overflow-hidden rounded-lg bg-surface-2"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- imagem privada servida pela nossa API */}
                <img
                  src={`/api/v1/attachments/${attachment.id}/content`}
                  alt={`Imagem ${index + 1} enviada em ${formatDateTime(attachment.created_at)}`}
                  loading="lazy"
                  className="max-h-64 w-full object-contain"
                />
              </a>
              <div className="flex min-w-0 flex-col gap-3">
                <p className="text-sm text-muted">
                  Imagem {index + 1} · {attachment.width}×{attachment.height} px · {Math.round(attachment.size_bytes / 1024)} KB
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => run(attachment, "ocr_imagem")}
                    loading={busy && running?.operation === "ocr_imagem"}
                    disabled={running !== null}
                  >
                    <SparkIcon /> Extrair texto
                  </Button>
                  <Button
                    onClick={() => run(attachment, "resolver_problema")}
                    loading={busy && running?.operation === "resolver_problema"}
                    disabled={running !== null}
                  >
                    <SparkIcon /> Resolver problema
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setToDelete(attachment)}
                    aria-label={`Excluir a imagem ${index + 1}`}
                    disabled={running !== null}
                  >
                    <TrashIcon />
                  </Button>
                </div>
                <p className="text-xs text-muted">
                  “Resolver problema” usa um modelo mais capaz e pode levar alguns segundos. A IA pode errar, principalmente em
                  contas longas: confira sempre o resultado.
                </p>
              </div>
            </Card>

            {result && (
              <GenerationResult
                key={`${result.id}-${result.created_at}-${result.cached}`}
                generation={result}
                onRegenerate={() => run(attachment, result.operation as Operation, true)}
                regenerating={busy}
                onMaterialSaved={() => onMaterialSaved()}
              />
            )}
          </div>
        );
      })}

      <ConfirmDialog
        open={toDelete !== null}
        title="Excluir esta imagem?"
        description="As leituras e resoluções feitas a partir dela também serão apagadas. Textos e resumos que você já salvou continuam existindo. Esta ação não pode ser desfeita."
        loading={deleting}
        onCancel={() => setToDelete(null)}
        onConfirm={() => toDelete && remove(toDelete)}
      />
    </div>
  );
}
