"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Markdown } from "@/components/markdown";
import { ReadAloud } from "@/components/read-aloud";
import { Alert, Button, Card, Field } from "@/components/ui/primitives";
import { Badge, EmptyState, Select } from "@/components/ui/forms";
import { SparkIcon } from "@/components/ui/icons";
import { api } from "@/lib/api";
import { errorMessage, useApi } from "@/lib/use-api";
import type { AiOperations, Generation, Material, Summary } from "@/lib/types";

const DETAIL_LABELS = { curto: "Curto", medio: "Médio", detalhado: "Detalhado" } as const;

interface Usage {
  used_today: number;
  daily_limit: number;
}

export function AiPanel({ materials }: { materials: Material[] }) {
  const router = useRouter();
  const operations = useApi<AiOperations>("/ai/operations");
  const usage = useApi<Usage>("/ai/usage");
  const [materialId, setMaterialId] = useState(materials[0]?.id ?? "");
  const [operationId, setOperationId] = useState("resumo_completo");
  const [detail, setDetail] = useState<keyof typeof DETAIL_LABELS>("medio");
  const [result, setResult] = useState<Generation | null>(null);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"generate" | "save" | null>(null);

  if (materials.length === 0) {
    return (
      <EmptyState title="Adicione um texto para usar a IA">
        A IA trabalha sobre o texto original da aula. Cadastre o conteúdo na aba “Texto original”.
      </EmptyState>
    );
  }

  const operation = operations.data?.operations.find((o) => o.id === operationId);
  // Se o texto escolhido foi apagado, volta para o primeiro disponível.
  const selectedMaterial = materials.find((m) => m.id === materialId) ?? materials[0];
  const tooLong = operations.data !== undefined && selectedMaterial.content.length > operations.data.max_input_chars;

  async function generate(force: boolean) {
    setError(null);
    setBusy("generate");
    try {
      const gen = await api<Generation>("/ai/generate", {
        method: "POST",
        body: {
          material_id: selectedMaterial.id,
          operation: operationId,
          detail_level: operation?.supports_detail ? detail : null,
          force,
        },
      });
      setResult(gen);
      setTitle("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
      usage.reload();
    }
  }

  async function save() {
    if (!result) return;
    setError(null);
    setBusy("save");
    try {
      const summary = await api<Summary>(`/ai/generations/${result.id}/save`, {
        method: "POST",
        body: { title: title.trim() || null },
      });
      router.push(`/resumos/${summary.id}`);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-4">
        <div>
          <h2 className="flex items-center gap-2 font-semibold">
            <SparkIcon width={18} height={18} /> Gerar com IA
          </h2>
          <p className="mt-1 text-sm text-muted">
            A IA usa apenas o seu texto. O que não estiver nele é sinalizado, e qualquer informação extra aparece
            separada. Revise sempre o resultado antes de estudar.
          </p>
        </div>

        {materials.length > 1 && (
          <Select label="Texto de origem" value={selectedMaterial.id} onChange={(e) => setMaterialId(e.target.value)}>
            {materials.map((m, i) => (
              <option key={m.id} value={m.id}>
                Texto {i + 1} — {m.content.slice(0, 50).replace(/\s+/g, " ")}…
              </option>
            ))}
          </Select>
        )}

        <fieldset>
          <legend className="mb-2 text-sm font-medium">Tipo de resultado</legend>
          {operations.error && <Alert>{operations.error}</Alert>}
          <div className="grid gap-2 sm:grid-cols-2">
            {operations.data?.operations.map((op) => (
              <label
                key={op.id}
                className={`cursor-pointer rounded-lg border p-3 text-sm ${operationId === op.id ? "border-primary bg-primary-soft" : "border-line hover:bg-surface-2"}`}
              >
                <input
                  type="radio"
                  name="operacao"
                  value={op.id}
                  checked={operationId === op.id}
                  onChange={() => setOperationId(op.id)}
                  className="sr-only"
                />
                <span className="block font-medium">{op.label}</span>
                <span className="block text-xs text-muted">{op.description}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {operation?.supports_detail && (
          <Select label="Nível de detalhe" value={detail} onChange={(e) => setDetail(e.target.value as keyof typeof DETAIL_LABELS)}>
            {Object.entries(DETAIL_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        )}

        {tooLong && (
          <Alert>
            Este texto tem mais de {operations.data?.max_input_chars.toLocaleString("pt-BR")} caracteres, o limite para
            a IA. Divida o conteúdo em partes menores (adicione outro texto).
          </Alert>
        )}
        {error && <Alert>{error}</Alert>}

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => generate(false)} loading={busy === "generate"} disabled={tooLong || !operation}>
            Gerar
          </Button>
          {usage.data && (
            <span className="text-xs text-muted">
              Usos de IA hoje: {usage.data.used_today} de {usage.data.daily_limit}
            </span>
          )}
        </div>
      </Card>

      {result && (
        <Card className="space-y-4" aria-labelledby="resultado-ia">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="resultado-ia" className="font-semibold">
              {result.operation_label}
            </h2>
            <Badge tone="primary">{result.detail_level}</Badge>
            {result.cached && <Badge>reaproveitado — sem novo custo</Badge>}
          </div>

          {result.provider === "fake" && (
            <Alert tone="info">
              <strong>Resultado de demonstração.</strong> O provedor de IA real ainda não está configurado, então
              este texto é só uma montagem automática de trechos do seu material — não é um resumo de verdade.
            </Alert>
          )}

          <ReadAloud text={result.markdown} format="markdown" />

          <div className="rounded-lg border border-line p-4">
            <Markdown>{result.markdown}</Markdown>
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <Field
              label="Título do resumo (opcional)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              hint="Ao salvar, você poderá editar o texto livremente."
            />
            <Button onClick={save} loading={busy === "save"}>
              Salvar como resumo
            </Button>
          </div>
          <div>
            <Button variant="ghost" onClick={() => generate(true)} loading={busy === "generate"}>
              Gerar novamente
            </Button>
            <span className="ml-2 text-xs text-muted">Conta como um novo uso de IA.</span>
          </div>
        </Card>
      )}
    </div>
  );
}
