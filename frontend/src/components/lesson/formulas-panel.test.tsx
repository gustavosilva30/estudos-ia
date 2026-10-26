// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setCsrfToken } from "@/lib/api";
import { FormulasPanel } from "./formulas-panel";

const session = vi.hoisted(() => ({ value: { reload: () => Promise.resolve() } }));
vi.mock("@/lib/session", () => ({ useSession: () => session.value }));

const LESSON = "33333333-3333-3333-3333-333333333333";
let links: { formula_key: string; created_at: string }[];
let calls: { url: string; method: string; body: unknown }[];

beforeEach(() => {
  setCsrfToken("csrf");
  links = [{ formula_key: "b:pitagoras", created_at: "2026-10-26T00:00:00Z" }];
  calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const path = url.replace("/api/v1", "");
      const method = init.method ?? "GET";
      const body = typeof init.body === "string" ? JSON.parse(init.body) : undefined;
      calls.push({ url: path, method, body });
      if (path === `/lessons/${LESSON}/formulas` && method === "GET") return new Response(JSON.stringify(links));
      if (path === `/lessons/${LESSON}/formulas` && method === "POST") {
        links = [...links, { formula_key: body.formula_key, created_at: "2026-10-26T00:00:00Z" }];
        return new Response(JSON.stringify(links.at(-1)), { status: 201 });
      }
      if (path.startsWith(`/lessons/${LESSON}/formulas/`) && method === "DELETE") {
        links = links.filter((l) => l.formula_key !== decodeURIComponent(path.split("/formulas/")[1]));
        return new Response(null, { status: 204 });
      }
      if (path === `/lessons/${LESSON}/materials` && method === "POST") return new Response(JSON.stringify({ id: "m1" }), { status: 201 });
      if (path === "/formulas/custom") return new Response("[]");
      if (path === "/formulas/marks") return new Response(JSON.stringify([{ formula_key: "b:pitagoras", is_favorite: true, note: "só em triângulo retângulo", updated_at: "2026-10-26T00:00:00Z" }]));
      return new Response("{}", { status: 404 });
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("FormulasPanel (aba da aula)", () => {
  it("mostra as fórmulas vinculadas com equação, anotação e atalho para resolver", async () => {
    render(<FormulasPanel lessonId={LESSON} onMaterialSaved={vi.fn()} />);
    expect(await screen.findByText("Teorema de Pitágoras")).toBeTruthy();
    expect(screen.getByText(/Anotação: só em triângulo retângulo/)).toBeTruthy();
    expect(document.querySelector(".katex")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Abrir e resolver" }).getAttribute("href")).toBe("/formulas?f=b%3Apitagoras");
  });

  it("vincula uma nova fórmula pela busca e depois desvincula", async () => {
    render(<FormulasPanel lessonId={LESSON} onMaterialSaved={vi.fn()} />);
    await screen.findByText("Teorema de Pitágoras");
    fireEvent.change(screen.getByLabelText("Vincular uma fórmula"), { target: { value: "ohm" } });
    fireEvent.click(await screen.findByRole("button", { name: "Vincular" }));
    await waitFor(() => expect(calls.find((c) => c.method === "POST")?.body).toEqual({ formula_key: "b:ohm" }));
    await screen.findByText("Primeira lei de Ohm", { selector: "h3" });
    fireEvent.click(screen.getByRole("button", { name: "Desvincular Primeira lei de Ohm" }));
    await waitFor(() => expect(screen.queryByText("Primeira lei de Ohm", { selector: "h3" })).toBeNull());
    expect(calls.some((c) => c.method === "DELETE" && c.url.endsWith("/formulas/b:ohm"))).toBe(true);
  });

  it("'Salvar como texto' cria um texto de origem 'fórmula' na aula e avisa a tela", async () => {
    const saved = vi.fn();
    render(<FormulasPanel lessonId={LESSON} onMaterialSaved={saved} />);
    await screen.findByText("Teorema de Pitágoras");
    fireEvent.click(screen.getByRole("button", { name: "Salvar como texto" }));
    await waitFor(() => expect(saved).toHaveBeenCalled());
    const post = calls.find((c) => c.url === `/lessons/${LESSON}/materials`)!;
    expect(post.body).toMatchObject({ origin: "formula" });
    const content = (post.body as { content: string }).content;
    expect(content).toContain("Fórmula: Teorema de Pitágoras");
    expect(content).toContain("Minha anotação: só em triângulo retângulo");
    expect(screen.getByRole("status").textContent).toContain("Fórmula salva como texto");
  });

  it("sem vínculos mostra a orientação", async () => {
    links = [];
    render(<FormulasPanel lessonId={LESSON} onMaterialSaved={vi.fn()} />);
    expect(await screen.findByText("Nenhuma fórmula vinculada")).toBeTruthy();
    await act(async () => {});
    expect(within(document.body).queryByRole("list")).toBeNull();
  });
});
