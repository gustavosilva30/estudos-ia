const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });
const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" });

export function formatDateTime(iso: string): string {
  return dateTime.format(new Date(iso));
}

/** Aceita "AAAA-MM-DD" (data sem hora) ou um instante ISO. Data sem hora vale no dia local, sem recuar um dia por fuso. */
export function parseDate(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : new Date(value);
}

export function formatDate(iso: string): string {
  return date.format(parseDate(iso));
}

export function firstName(name: string | null, email: string): string {
  const source = name?.trim() || email.split("@")[0];
  return source.split(/\s+/)[0];
}

export const SUMMARY_KIND_LABELS: Record<string, string> = {
  resumo_completo: "Resumo completo",
  resumo_rapido: "Resumo rápido",
  topicos_principais: "Tópicos principais",
  explicacao_simplificada: "Explicação simplificada",
  preparacao_aula: "Preparação para aula",
  manual: "Resumo manual",
};
