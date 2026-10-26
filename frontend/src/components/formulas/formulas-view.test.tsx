// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setCsrfToken } from "@/lib/api";
import type { CustomFormulaData, FormulaMark } from "@/lib/types";
import { FormulasView } from "./formulas-view";

const search = vi.hoisted(() => ({ params: new URLSearchParams() }));
vi.mock("next/navigation", () => ({ useSearchParams: () => search.params, usePathname: () => "/formulas" }));
// useApi consulta a sessão só para renová-la quando expira: nos testes basta uma função estável.
const session = vi.hoisted(() => ({ value: { reload: () => Promise.resolve() } }));
vi.mock("@/lib/session", () => ({ useSession: () => session.value }));

type Handler = (url: string, init: RequestInit) => unknown;
let calls: { url: string; method: string; body: unknown }[];
let marks: FormulaMark[];
let customs: CustomFormulaData[];

function stubApi(extra?: Handler) {
  calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const method = init.method ?? "GET";
      const path = url.replace("/api/v1", "");
      const body = typeof init.body === "string" ? JSON.parse(init.body) : undefined;
      calls.push({ url: path, method, body });
      const custom = extra?.(path, init);
      if (custom !== undefined) return new Response(JSON.stringify(custom), { status: method === "POST" ? 201 : 200 });
      if (path === "/formulas/marks" && method === "GET") return new Response(JSON.stringify(marks));
      if (path === "/formulas/custom" && method === "GET") return new Response(JSON.stringify(customs));
      if (path.startsWith("/formulas/marks/") && method === "PUT") {
        const mark = { formula_key: decodeURIComponent(path.split("/formulas/marks/")[1]), is_favorite: body.is_favorite ?? false, note: body.note ?? null, updated_at: "2026-10-26T00:00:00Z" };
        marks = [...marks.filter((m) => m.formula_key !== mark.formula_key), mark];
        return new Response(JSON.stringify(mark));
      }
      if (path.startsWith("/lessons?")) return new Response(JSON.stringify({ items: [], total: 0, page: 1, page_size: 100 }));
      if (path.endsWith("/lessons") && path.startsWith("/formulas/")) return new Response("[]");
      return new Response("{}", { status: 404 });
    }),
  );
}

const CUSTOM: CustomFormulaData = {
  id: "11111111-1111-1111-1111-111111111111", title: "Energia elástica", category: "fisica", latex: null, description: "Energia de uma mola.",
  variables: [{ id: "k", name: "constante da mola", unit: "N/m" }, { id: "x", name: "deformação", unit: "m" }],
  expression: "k*x^2/2", result_name: "Ee", result_label: "energia", result_unit: "J", created_at: "2026-10-26T00:00:00Z", updated_at: "2026-10-26T00:00:00Z",
};

beforeEach(() => {
  // O jsdom não implementa <dialog>: simulamos abrir/fechar para os modais (Modal e ConfirmDialog).
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute("open");
  };
  setCsrfToken("csrf");
  search.params = new URLSearchParams();
  marks = [];
  customs = [];
  stubApi();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

const list = () => within(screen.getByRole("list", { name: "Fórmulas" }));
const open = (title: string) => fireEvent.click(list().getByText(title));
const type = (label: RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const steps = () => document.querySelector('[aria-label="Passos da solução"]')!.textContent ?? "";

describe("FormulasView: catálogo e resolvedor", () => {
  it("lista as fórmulas e filtra por busca e por área", async () => {
    render(<FormulasView />);
    expect(list().getAllByRole("listitem").length).toBeGreaterThanOrEqual(100);
    type(/Buscar fórmula/, "pitagoras");
    expect(list().getAllByRole("listitem").length).toBeLessThan(12); // também acha as que citam Pitágoras no texto
    expect(list().getByText("Teorema de Pitágoras")).toBeTruthy();
    expect(list().queryByText("Primeira lei de Ohm")).toBeNull();
    type(/Buscar fórmula/, "");
    fireEvent.click(screen.getByRole("button", { name: "Química" }));
    expect(list().queryByText("Teorema de Pitágoras")).toBeNull();
    expect(list().getByText("Densidade")).toBeTruthy();
    await act(async () => {});
  });

  it("avisa quando nada é encontrado", async () => {
    render(<FormulasView />);
    type(/Buscar fórmula/, "xyzxyz");
    expect(screen.getByText("Nenhuma fórmula encontrada")).toBeTruthy();
    await act(async () => {});
  });

  it("resolve Pitágoras passo a passo e valida entradas", async () => {
    render(<FormulasView />);
    open("Teorema de Pitágoras");
    expect(screen.getByText(/Preencha os campos que faltam/)).toBeTruthy();
    type(/cateto a/, "3");
    type(/cateto b/, "4");
    expect(within(screen.getByRole("list", { name: "Passos da solução" })).getAllByRole("listitem")).toHaveLength(3);
    expect(steps()).toContain("25");
    expect(document.querySelector(".katex-mathml")?.textContent).toBeTruthy();
    fireEvent.change(screen.getByLabelText("O que você quer descobrir?"), { target: { value: "1" } });
    type(/hipotenusa c/, "5");
    type(/cateto b/, "12");
    expect(screen.getByRole("alert").textContent).toBe("A hipotenusa precisa ser maior que o cateto.");
    await act(async () => {});
  });

  it("'Usar exemplo' preenche os campos e a conta; constantes sugeridas vêm preenchidas", async () => {
    render(<FormulasView />);
    open("Fórmula de Bhaskara (equação do 2º grau)");
    fireEvent.click(screen.getByRole("button", { name: "Usar exemplo" }));
    expect((screen.getByLabelText(/coeficiente b/) as HTMLInputElement).value).toBe("-3");
    expect(steps()).toContain("25");
    fireEvent.click(screen.getByRole("button", { name: "← Voltar à lista" }));
    open("Peso");
    expect((screen.getByLabelText(/gravidade/) as HTMLInputElement).value).toBe("9.8");
    await act(async () => {});
  });

  it("abre direto pela fórmula do endereço (?f=)", async () => {
    search.params = new URLSearchParams("f=b:ohm");
    render(<FormulasView />);
    expect(screen.getByRole("heading", { name: "Primeira lei de Ohm" })).toBeTruthy();
    await act(async () => {});
  });

  it("atualiza o endereço ao escolher uma fórmula", async () => {
    render(<FormulasView />);
    open("Teorema de Pitágoras");
    expect(window.location.search).toBe("?f=b%3Apitagoras");
    await act(async () => {});
  });
});

describe("FormulasView: favoritos, anotações e fórmulas próprias", () => {
  it("favorita uma fórmula e filtra as favoritas", async () => {
    render(<FormulasView />);
    open("Teorema de Pitágoras");
    fireEvent.click(screen.getByRole("button", { name: "Adicionar aos favoritos" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Remover dos favoritos" })).toBeTruthy());
    const put = calls.find((c) => c.method === "PUT")!;
    expect(put.url).toBe("/formulas/marks/b:pitagoras");
    expect(put.body).toEqual({ is_favorite: true });
    fireEvent.click(screen.getByRole("button", { name: "← Voltar à lista" }));
    fireEvent.click(screen.getByRole("button", { name: "Favoritas" }));
    expect(list().getAllByRole("listitem")).toHaveLength(1);
    expect(within(list().getByRole("listitem")).getByLabelText("Favorita")).toBeTruthy();
  });

  it("mostra mensagem quando não há favoritas", async () => {
    render(<FormulasView />);
    fireEvent.click(screen.getByRole("button", { name: "Favoritas" }));
    expect(screen.getByText("Nenhuma fórmula favorita")).toBeTruthy();
    await act(async () => {});
  });

  it("salva a anotação pessoal", async () => {
    render(<FormulasView />);
    open("Teorema de Pitágoras");
    const save = screen.getByRole("button", { name: "Salvar anotação" }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    type(/Minha anotação/, "  só em triângulo retângulo  ");
    expect(save.disabled).toBe(false);
    fireEvent.click(save);
    await waitFor(() => expect(calls.some((c) => c.method === "PUT" && (c.body as { note?: string }).note === "só em triângulo retângulo")).toBe(true));
  });

  it("carrega as fórmulas próprias, usa o resolvedor e permite filtrar 'Minhas'", async () => {
    customs = [CUSTOM];
    render(<FormulasView />);
    fireEvent.click(await screen.findByRole("button", { name: "Minhas" }));
    expect(list().getAllByRole("listitem")).toHaveLength(1);
    open("Energia elástica");
    expect(screen.getByText("própria", { selector: "span" })).toBeTruthy();
    type(/constante da mola/, "100");
    type(/deformação/, "0.2");
    expect(steps()).toContain("2");
    expect(screen.queryByRole("button", { name: "Usar exemplo" })).toBeNull(); // só o catálogo tem exemplo
    expect(screen.getByRole("button", { name: "Editar fórmula" })).toBeTruthy();
  });

  it("cria uma fórmula própria validando antes de enviar", async () => {
    stubApi((url, init) => (url === "/formulas/custom" && init.method === "POST" ? { ...CUSTOM, id: "22222222-2222-2222-2222-222222222222" } : undefined));
    render(<FormulasView />);
    fireEvent.click(screen.getByRole("button", { name: "Nova fórmula" }));
    const dialog = within(document.querySelector("dialog") as HTMLElement);
    fireEvent.click(dialog.getByRole("button", { name: "Salvar fórmula" }));
    expect(dialog.getByRole("alert").textContent).toBe("Dê um nome à fórmula.");
    expect(calls.some((c) => c.method === "POST")).toBe(false);

    fireEvent.change(dialog.getByLabelText("Nome da fórmula"), { target: { value: "Energia elástica" } });
    fireEvent.change(dialog.getByLabelText("Nome da variável 1"), { target: { value: "k" } });
    fireEvent.change(dialog.getByLabelText("Descrição da variável 1"), { target: { value: "constante" } });
    fireEvent.change(dialog.getByLabelText("Conta"), { target: { value: "k*x" } }); // x não existe
    fireEvent.click(dialog.getByRole("button", { name: "Salvar fórmula" }));
    expect(dialog.getByRole("alert").textContent).toContain('"x" não existe');

    fireEvent.change(dialog.getByLabelText("Conta"), { target: { value: "k*3" } });
    fireEvent.click(dialog.getByRole("button", { name: "Salvar fórmula" }));
    await waitFor(() => expect(calls.some((c) => c.method === "POST")).toBe(true));
    const post = calls.find((c) => c.method === "POST")!;
    expect(post.body).toMatchObject({ title: "Energia elástica", expression: "k*3", result_name: "resultado", variables: [{ id: "k", name: "constante", unit: null }] });
  });

  it("exclui uma fórmula própria depois de confirmar", async () => {
    customs = [CUSTOM];
    render(<FormulasView />);
    fireEvent.click(await screen.findByRole("button", { name: "Minhas" }));
    open("Energia elástica");
    fireEvent.click(screen.getByRole("button", { name: "Excluir fórmula" }));
    fireEvent.click(within(document.querySelector("dialog[open]") as HTMLElement).getByRole("button", { name: /Excluir/ }));
    await waitFor(() => expect(calls.some((c) => c.method === "DELETE" && c.url === `/formulas/custom/${CUSTOM.id}`)).toBe(true));
  });
});
