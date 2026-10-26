// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setCsrfToken } from "@/lib/api";
import { ImportSource, MAX_PDF_BYTES, validateLink, validatePdf } from "./import-source";

const LESSON = "11111111-1111-1111-1111-111111111111";
let calls: { url: string; init: RequestInit }[];

function mockFetch(status: number, body: unknown) {
  calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify(body), { status });
    }),
  );
}

beforeEach(() => setCsrfToken("csrf"));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("validações", () => {
  it("aceita só PDF dentro do limite", () => {
    expect(validatePdf(new File(["x"], "aula.pdf", { type: "application/pdf" }))).toBeNull();
    expect(validatePdf(new File(["x"], "Aula.PDF", { type: "" }))).toBeNull();
    expect(validatePdf(new File(["x"], "foto.png", { type: "image/png" }))).toContain("PDF");
    expect(validatePdf(new File([], "vazio.pdf", { type: "application/pdf" }))).toContain("vazio");
    const big = new File(["x"], "g.pdf", { type: "application/pdf" });
    Object.defineProperty(big, "size", { value: MAX_PDF_BYTES + 1 });
    expect(validatePdf(big)).toContain("passa de");
  });

  it("aceita só endereços http(s)", () => {
    expect(validateLink("https://site.com/aula")).toBeNull();
    expect(validateLink("  http://site.com ")).toBeNull();
    expect(validateLink("javascript:alert(1)")).toContain("http");
    expect(validateLink("ftp://site.com")).toContain("http");
    expect(validateLink("site.com")).toContain("válido");
  });
});

describe("ImportSource", () => {
  it("envia o PDF e avisa a tela para recarregar", async () => {
    mockFetch(201, { id: "m1", origin: "pdf" });
    const onImported = vi.fn();
    render(<ImportSource lessonId={LESSON} onImported={onImported} />);
    const file = new File(["%PDF-1.4"], "aula.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText("Escolher PDF"), { target: { files: [file] } });
    await waitFor(() => expect(onImported).toHaveBeenCalled());
    expect(calls[0].url).toContain(`/lessons/${LESSON}/materials/from-file`);
    expect(calls[0].init.body).toBeInstanceOf(FormData);
    expect(screen.getByRole("status").textContent).toContain("PDF lido");
  });

  it("não envia arquivo que não é PDF", async () => {
    mockFetch(201, {});
    render(<ImportSource lessonId={LESSON} onImported={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Escolher PDF"), { target: { files: [new File(["x"], "a.txt", { type: "text/plain" })] } });
    expect((await screen.findByRole("alert")).textContent).toContain("PDF");
    expect(calls).toHaveLength(0);
  });

  it("envia o link, limpa o campo e mostra erro do servidor", async () => {
    mockFetch(201, { id: "m2", origin: "link" });
    const onImported = vi.fn();
    render(<ImportSource lessonId={LESSON} onImported={onImported} />);
    const input = screen.getByLabelText("Endereço de uma página ou PDF público") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "https://site.com/aula" } });
    fireEvent.click(screen.getByRole("button", { name: "Ler link" }));
    await waitFor(() => expect(onImported).toHaveBeenCalled());
    expect(calls[0].url).toContain("/materials/from-link");
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ url: "https://site.com/aula" });
    expect(input.value).toBe("");

    mockFetch(422, { detail: "A página exige login ou bloqueou o acesso. Cole o texto manualmente." });
    fireEvent.change(input, { target: { value: "https://privado.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Ler link" }));
    expect((await screen.findByRole("alert")).textContent).toContain("exige login");
  });
});
