"use client";

import { useState } from "react";
import { Alert, Button, Card } from "@/components/ui/primitives";
import { EmptyState, Select } from "@/components/ui/forms";
import { SparkIcon } from "@/components/ui/icons";
import { api } from "@/lib/api";
import { errorMessage, useApi } from "@/lib/use-api";
import type { AiOperations, Generation, Material } from "@/lib/types";
import { GenerationResult } from "./generation-result";

const DETAIL_LABELS = { curto: "Curto", medio: "Médio", detalhado: "Detalhado" } as const;

interface Usage {
  used_today: number;
  daily_limit: number;
}

export function AiPanel({ materials, categoryLabel }: { materials: Material[]; categoryLabel?: string }) {
  const operations = useApi<AiOperations>("/ai/operations");
  const usage = useApi<Usage>("/ai/usage");
  const [materialId, setMaterialId] = useState(materials[0]?.id ?? "");
  const [operationId, setOperationId] = useState("resumo_completo");
  const [detail, setDetail] = useState<keyof typeof DETAIL_LABELS>("medio");
  const [result, setResult] = useState<Generation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (materials.length === 0) {
    return (
      <EmptyState title="Adicione um texto para usar a IA">
        A IA trabalha sobre o texto original da aula. Cadastre o conteúdo na aba “Texto original” — ou envie uma
        imagem na aba “Imagens” e transforme-a em texto.
      </EmptyState>
    );
  }

  // Operações sobre imagem (como "Imagem para texto") ficam na aba Imagens.
  const textOperations = operations.data?.operations.filter((o) => o.inputs.includes("material")) ?? [];
  const operation = textOperations.find((o) => o.id === operationId);
  // Se o texto escolhido foi apagado, volta para o primeiro disponível.
  const selectedMaterial = materials.find((m) => m.id === materialId) ?? materials[0];
  const tooLong = operations.data !== undefined && selectedMaterial.content.length > operations.data.max_input_chars;

  async function generate(force: boolean) {
    setError(null);
    setBusy(true);
    try {
      setResult(
        await api<Generation>("/ai/generate", {
          method: "POST",
          body: {
            material_id: selectedMaterial.id,
            operation: operationId,
            detail_level: operation?.supports_detail ? detail : null,
            force,
          },
        }),
      );
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
      usage.reload();
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
            {categoryLabel && categoryLabel !== "Outra" && (
              <> A IA está ajustada para a área <strong>{categoryLabel}</strong>, definida na matéria.</>
            )}
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
            {textOperations.map((op) => (
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
          <Button onClick={() => generate(false)} loading={busy} disabled={tooLong || !operation}>
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
        <GenerationResult
          key={`${result.id}-${result.created_at}-${result.cached}`}
          generation={result}
          onRegenerate={() => generate(true)}
          regenerating={busy}
        />
      )}
    </div>
  );
}
