"use client";

import { useMemo } from "react";
import type { SubjectCategory } from "./types";
import { useApi } from "./use-api";

/** Categorias de matéria (Matemática, Física...). A lista vem do backend, que é quem define como a IA se adapta a cada uma. */
export function useCategories() {
  const { data } = useApi<SubjectCategory[]>("/subject-categories");
  const labels = useMemo(() => Object.fromEntries((data ?? []).map((c) => [c.id, c.label])), [data]);
  return {
    categories: data ?? [],
    labelOf: (id: string | null | undefined) => (id ? (labels[id] ?? "") : ""),
  };
}
