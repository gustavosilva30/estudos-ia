"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Markdown } from "@/components/markdown";
import { ReadAloud } from "@/components/read-aloud";
import { Badge, Textarea } from "@/components/ui/forms";
import { Alert, Button, Card, Field } from "@/components/ui/primitives";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/use-api";
import type { Generation, Material, Summary } from "@/lib/types";

interface Props {
  generation: Generation;
  onRegenerate: () => void;
  regenerating: boolean;
  /** Chamado depois que a transcrição de uma imagem vira texto original da aula. */
  onMaterialSaved?: (material: Material) => void;
}

/** Resultado de uma operação de IA: aviso de demonstração, leitura em voz alta, e salvar como resumo
 * (ou, no caso de imagem para texto, como texto original da aula, já revisado pela pessoa). */
export function GenerationResult({ generation, onRegenerate, regenerating, onMaterialSaved }: Props) {
  const router = useRouter();
  const isOcr = generation.operation === "ocr_imagem";
  const originalText = typeof generation.result.text === "string" ? generation.result.text : "";
  const [title, setTitle] = useState("");
  const [ocrText, setOcrText] = useState(originalText);
  const [busy, setBusy] = useState<"summary" | "material" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedMaterial, setSavedMaterial] = useState(false);

  async function saveSummary() {
    setError(null);
    setBusy("summary");
    try {
      const summary = await api<Summary>(`/ai/generations/${generation.id}/save`, {
        method: "POST",
        body: { title: title.trim() || null },
      });
      router.push(`/resumos/${summary.id}`);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(null);
    }
  }

  async function saveMaterial() {
    setError(null);
    setBusy("material");
    try {
      const material = await api<Material>(`/ai/generations/${generation.id}/save-as-material`, {
        method: "POST",
        body: { content: ocrText },
      });
      setSavedMaterial(true);
      onMaterialSaved?.(material);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="space-y-4" aria-label={generation.operation_label}>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-semibold">{generation.operation_label}</h2>
        {generation.operation !== "ocr_imagem" && <Badge tone="primary">{generation.detail_level}</Badge>}
        {generation.cached && <Badge>reaproveitado — sem novo custo</Badge>}
      </div>

      {generation.provider === "fake" && (
        <Alert tone="info">
          <strong>Resultado de demonstração.</strong> O provedor de IA real não está configurado, então este texto é só
          uma montagem automática — não é um resultado de verdade.
        </Alert>
      )}
      {error && <Alert>{error}</Alert>}

      {isOcr ? (
        <div className="space-y-3">
          <Textarea
            label="Texto transcrito da imagem (revise antes de salvar)"
            rows={10}
            value={ocrText}
            onChange={(e) => {
              setOcrText(e.target.value);
              setSavedMaterial(false);
            }}
            className="font-mono"
            hint="Fórmulas aparecem em LaTeX entre $...$. Corrija o que a IA leu errado. [ilegível] marca trechos que ela não conseguiu ler."
          />
          <details className="rounded-lg border border-line p-3">
            <summary className="cursor-pointer text-sm font-medium">Como ficará (pré-visualização)</summary>
            <div className="mt-3">
              <Markdown>{ocrText}</Markdown>
            </div>
          </details>
          {generation.result.limitations instanceof Array && generation.result.limitations.length > 0 && (
            <Alert tone="info">
              <strong>Avisos da leitura:</strong> {generation.result.limitations.map(String).join(" · ")}
            </Alert>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={saveMaterial} loading={busy === "material"} disabled={!ocrText.trim()}>
              Salvar como texto original da aula
            </Button>
            {savedMaterial && <span className="text-sm text-success">Salvo na aba “Texto original”.</span>}
          </div>
        </div>
      ) : (
        <>
          <ReadAloud text={generation.markdown} format="markdown" />
          <div className="rounded-lg border border-line p-4">
            <Markdown>{generation.markdown}</Markdown>
          </div>
        </>
      )}

      <div className="grid gap-3 border-t border-line pt-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <Field
          label="Título do resumo (opcional)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          hint="Ao salvar como resumo, você poderá editar o texto livremente."
        />
        <Button variant="secondary" onClick={saveSummary} loading={busy === "summary"}>
          Salvar como resumo
        </Button>
      </div>
      <div>
        <Button variant="ghost" onClick={onRegenerate} loading={regenerating}>
          Gerar novamente
        </Button>
        <span className="ml-2 text-xs text-muted">Conta como um novo uso de IA.</span>
      </div>
    </Card>
  );
}
