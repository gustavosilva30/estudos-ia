/** Aceita apenas caminhos internos como destino pós-login (evita redirecionamento para sites externos). */
export function safeNext(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return "/dashboard";
  return value;
}
