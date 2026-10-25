/**
 * Cliente da API. Chama sempre o mesmo domínio (/api/...): em desenvolvimento o Next encaminha
 * para o backend; em produção o proxy do EasyPanel roteia /api para ele. O navegador envia o
 * cookie de sessão (HttpOnly) sozinho; o token CSRF fica só em memória.
 */

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public retryAfter?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

let csrfToken: string | null = null;
export function setCsrfToken(token: string | null) {
  csrfToken = token;
}

interface ValidationItem {
  type?: string;
  loc?: (string | number)[];
  msg?: string;
  ctx?: { min_length?: number; max_length?: number };
}

const FIELD_NAMES: Record<string, string> = {
  email: "e-mail",
  password: "senha",
  new_password: "nova senha",
  current_password: "senha atual",
  display_name: "nome",
  token: "link de recuperação",
};

function validationMessage(items: ValidationItem[]): string {
  const item = items[0];
  const field = String(item?.loc?.[item.loc.length - 1] ?? "");
  const name = FIELD_NAMES[field] ?? "campo";
  if (item?.type === "string_too_short" && item.ctx?.min_length) {
    return item.ctx.min_length === 1
      ? `Preencha o campo ${name}.`
      : `A ${name} deve ter pelo menos ${item.ctx.min_length} caracteres.`;
  }
  if (item?.type === "string_too_long" && item.ctx?.max_length) {
    return `O campo ${name} aceita no máximo ${item.ctx.max_length} caracteres.`;
  }
  if (field === "email") return "Informe um e-mail válido.";
  return "Verifique os campos informados.";
}

function messageFor(status: number, data: unknown): string {
  const detail = (data as { detail?: unknown } | null)?.detail;
  if (typeof detail === "string" && status < 500) return detail;
  if (Array.isArray(detail)) return validationMessage(detail as ValidationItem[]);
  if (status === 401) return "Sessão expirada. Entre novamente.";
  if (status === 403) return "Você não tem permissão para fazer isso.";
  if (status === 404) return "Não encontrado.";
  if (status === 413) return "O conteúdo enviado é grande demais.";
  if (status === 429) return "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
  if (status >= 500) return "Ocorreu um erro no servidor. Tente novamente em instantes.";
  return "Não foi possível concluir a operação.";
}

interface Options {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
}

export async function api<T>(path: string, options: Options = {}): Promise<T> {
  const method = options.method ?? "GET";
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (method !== "GET" && csrfToken) headers["X-CSRF-Token"] = csrfToken;

  let response: Response;
  try {
    response = await fetch(`/api/v1${path}`, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      credentials: "same-origin",
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError(0, "Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.");
  }

  if (response.status === 204) return undefined as T;
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const retry = Number(response.headers.get("Retry-After"));
    throw new ApiError(response.status, messageFor(response.status, data), retry > 0 ? retry : undefined);
  }
  return data as T;
}
