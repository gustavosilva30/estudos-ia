import { afterEach, describe, expect, it, vi } from "vitest";
import { api, ApiError, setCsrfToken } from "./api";

function mockFetch(status: number, body: unknown, headers: Record<string, string> = {}) {
  const fn = vi.fn().mockResolvedValue(
    new Response(status === 204 ? null : JSON.stringify(body), { status, headers }),
  );
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
  setCsrfToken(null);
});

describe("api", () => {
  it("envia cookie de sessão e CSRF só em métodos que alteram dados", async () => {
    const fetchMock = mockFetch(200, {});
    setCsrfToken("tok-123");
    await api("/subjects");
    await api("/subjects", { method: "POST", body: { name: "x" } });
    const [get, post] = fetchMock.mock.calls;
    expect(get[1].credentials).toBe("same-origin");
    expect(get[1].headers["X-CSRF-Token"]).toBeUndefined();
    expect(post[1].headers["X-CSRF-Token"]).toBe("tok-123");
    expect(post[1].headers["Content-Type"]).toBe("application/json");
    expect(get[0]).toBe("/api/v1/subjects");
  });

  it("devolve undefined em 204", async () => {
    mockFetch(204, null);
    await expect(api("/auth/logout", { method: "POST" })).resolves.toBeUndefined();
  });

  it("usa a mensagem em português enviada pelo backend", async () => {
    mockFetch(401, { detail: "E-mail ou senha incorretos." });
    await expect(api("/auth/login", { method: "POST", body: {} })).rejects.toMatchObject({
      status: 401,
      message: "E-mail ou senha incorretos.",
    });
  });

  it("traduz erros de validação (422)", async () => {
    mockFetch(422, { detail: [{ type: "string_too_short", loc: ["body", "password"], ctx: { min_length: 10 } }] });
    await expect(api("/auth/register", { method: "POST", body: {} })).rejects.toThrow(
      "A senha deve ter pelo menos 10 caracteres.",
    );
    mockFetch(422, { detail: [{ type: "value_error", loc: ["body", "email"] }] });
    await expect(api("/auth/register", { method: "POST", body: {} })).rejects.toThrow("Informe um e-mail válido.");
  });

  it("não exibe detalhes de erros 5xx", async () => {
    mockFetch(500, { detail: "Traceback: segredo interno" });
    const error = await api("/dashboard").catch((e: ApiError) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).message).not.toContain("segredo");
  });

  it("mostra os avisos da IA em 502/503/504, mas não detalhes de outros 5xx", async () => {
    mockFetch(503, { detail: "O serviço de IA está sobrecarregado." });
    await expect(api("/ai/generate")).rejects.toThrow("O serviço de IA está sobrecarregado.");
    mockFetch(504, { detail: "A IA demorou demais para responder." });
    await expect(api("/ai/generate")).rejects.toThrow("A IA demorou demais para responder.");
  });

  it("explica o corte por tempo do proxy (524) sem expor o corpo", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>error code: 524</html>", { status: 524 })));
    await expect(api("/ai/generate")).rejects.toThrow("demorou demais");
  });

  it("informa o tempo de espera do limite de tentativas", async () => {
    mockFetch(429, { detail: "Muitas tentativas." }, { "Retry-After": "900" });
    await expect(api("/auth/login", { method: "POST", body: {} })).rejects.toMatchObject({
      status: 429,
      retryAfter: 900,
    });
  });

  it("avisa quando não consegue conectar", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(api("/dashboard")).rejects.toMatchObject({ status: 0 });
  });
});
