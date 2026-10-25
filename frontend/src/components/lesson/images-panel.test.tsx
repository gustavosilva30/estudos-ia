// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setCsrfToken } from "@/lib/api";
import type { Attachment, Generation } from "@/lib/types";
import { ImagesPanel } from "./images-panel";

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const LESSON = "11111111-1111-1111-1111-111111111111";
const ATT: Attachment = {
  id: "22222222-2222-2222-2222-222222222222",
  lesson_id: LESSON,
  mime_type: "image/png",
  width: 800,
  height: 600,
  size_bytes: 20480,
  created_at: "2026-10-25T12:00:00Z",
};

function generation(over: Partial<Generation>): Generation {
  return {
    id: "33333333-3333-3333-3333-333333333333", material_id: null, attachment_id: ATT.id, lesson_id: LESSON,
    operation: "ocr_imagem", operation_label: "Imagem para texto", detail_level: "medio", provider: "gemini",
    model: "gemini-x", result: { text: "Questão 1: $x+1=2$", limitations: ["Linha 3 borrada."] },
    markdown: "# t\n\nQuestão 1: $x+1=2$", input_tokens: 1, output_tokens: 1, estimated_cost_usd: 0,
    created_at: "2026-10-25T12:01:00Z", cached: false, ...over,
  };
}

type Handler = (url: string, init: RequestInit) => Response | Promise<Response>;
let calls: { url: string; init: RequestInit }[];

function mockFetch(handler: Handler) {
  calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return handler(url, init);
    }),
  );
}
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
const file = (name: string, type: string, size = 1000) => new File([new Uint8Array(size)], name, { type });

function setup(props: Partial<Parameters<typeof ImagesPanel>[0]> = {}) {
  const onChanged = vi.fn();
  const onMaterialSaved = vi.fn();
  render(
    <ImagesPanel lessonId={LESSON} attachments={[ATT]} categoryLabel="Matemática" onChanged={onChanged}
      onMaterialSaved={onMaterialSaved} {...props} />,
  );
  return { onChanged, onMaterialSaved };
}

const chooseFile = (f: File) =>
  act(() => void fireEvent.change(screen.getByLabelText("Escolher imagem", { selector: "input" }), { target: { files: [f] } }));
const click = (name: RegExp) => act(async () => void fireEvent.click(screen.getByRole("button", { name })));

beforeEach(() => {
  setCsrfToken("tok-csrf");
  // jsdom não implementa <dialog>.showModal()
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
  };
  push.mockReset();
});

afterEach(() => {
  cleanup();
  setCsrfToken(null);
  vi.unstubAllGlobals();
});

describe("envio de imagem", () => {
  it("envia o arquivo como multipart com CSRF e atualiza a aula", async () => {
    mockFetch(() => json(ATT, 201));
    const { onChanged } = setup({ attachments: [] });
    await chooseFile(file("print.png", "image/png"));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());

    const { url, init } = calls[0];
    expect(url).toBe(`/api/v1/lessons/${LESSON}/attachments`);
    expect(init.method).toBe("POST");
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).get("file")).toBeInstanceOf(File);
    const headers = init.headers as Record<string, string>;
    expect(headers["X-CSRF-Token"]).toBe("tok-csrf");
    expect(headers["Content-Type"]).toBeUndefined(); // o navegador define o separador do multipart
  });

  it.each([
    [file("a.txt", "text/plain"), /Formato não suportado/],
    [file("foto.heic", "image/heic"), /HEIC/],
    [file("a.png", "image/png", 8_000_001), /passa de 8 MB/],
    [file("vazio.png", "image/png", 0), /vazio/],
  ])("recusa arquivo inválido antes de enviar (%#)", async (f, message) => {
    mockFetch(() => json({}));
    setup();
    await chooseFile(f);
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toMatch(message);
    expect(calls).toHaveLength(0);
  });

  it("mostra o erro do servidor em português", async () => {
    mockFetch(() => json({ detail: "Esta aula já tem 20 imagens (o máximo)." }, 409));
    setup();
    await chooseFile(file("a.png", "image/png"));
    expect((await screen.findByRole("alert")).textContent).toContain("já tem 20 imagens");
  });

  it("cola um print (Ctrl+V) fora de campos de texto", async () => {
    mockFetch(() => json(ATT, 201));
    const { onChanged } = setup();
    const event = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "clipboardData", { value: { files: [file("colado.png", "image/png")] } });
    await act(async () => void window.dispatchEvent(event));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(event.defaultPrevented).toBe(true);
    expect(calls).toHaveLength(1);
  });

  it("ignora a colagem de imagem quando o foco está num campo de texto", async () => {
    mockFetch(() => json(ATT, 201));
    setup();
    const textarea = document.body.appendChild(document.createElement("textarea"));
    const event = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "clipboardData", { value: { files: [file("x.png", "image/png")] } });
    await act(async () => void textarea.dispatchEvent(event));
    expect(calls).toHaveLength(0);
    textarea.remove();
  });

  it("ignora colagem de texto comum", async () => {
    mockFetch(() => json(ATT, 201));
    setup();
    const event = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "clipboardData", { value: { files: [] } });
    await act(async () => void window.dispatchEvent(event));
    expect(calls).toHaveLength(0);
    expect(event.defaultPrevented).toBe(false);
  });

  it("aceita arrastar e soltar", async () => {
    mockFetch(() => json(ATT, 201));
    const { onChanged } = setup({ attachments: [] });
    const zone = screen.getByText("Envie uma imagem ou print").closest("div") as HTMLElement;
    await act(async () => void fireEvent.drop(zone, { dataTransfer: { files: [file("a.png", "image/png")] } }));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });
});

describe("imagens da aula", () => {
  it("mostra a imagem servida pela API com texto alternativo e avisa sobre privacidade", () => {
    mockFetch(() => json({}));
    setup();
    const img = screen.getByRole("img") as HTMLImageElement;
    expect(img.getAttribute("src")).toBe(`/api/v1/attachments/${ATT.id}/content`);
    expect(img.alt).toMatch(/Imagem 1 enviada em/);
    expect(screen.getByText(/evite imagens com dados pessoais/i)).toBeTruthy();
    expect(screen.getByText(/questão de/i).textContent).toContain("Matemática");
  });

  it("extrai o texto, deixa revisar e salva como texto original", async () => {
    mockFetch((url) => (url.endsWith("/ai/generate") ? json(generation({})) : json({ id: "m1", origin: "image" }, 201)));
    const { onMaterialSaved } = setup();
    await click(/extrair texto/i);

    const generate = calls.find((c) => c.url.endsWith("/ai/generate"))!;
    expect(JSON.parse(generate.init.body as string)).toEqual({
      attachment_id: ATT.id, operation: "ocr_imagem", detail_level: null, force: false,
    });
    const box = (await screen.findByLabelText(/Texto transcrito da imagem/)) as HTMLTextAreaElement;
    expect(box.value).toBe("Questão 1: $x+1=2$");
    expect(screen.getByText(/Linha 3 borrada/)).toBeTruthy();

    await act(async () => void fireEvent.change(box, { target: { value: "Questão 1 corrigida: $x+1=2$" } }));
    await click(/salvar como texto original/i);
    await waitFor(() => expect(onMaterialSaved).toHaveBeenCalled());
    const save = calls.find((c) => c.url.endsWith("/save-as-material"))!;
    expect(save.url).toContain(`/ai/generations/${generation({}).id}/`);
    expect(JSON.parse(save.init.body as string)).toEqual({ content: "Questão 1 corrigida: $x+1=2$" });
    expect(screen.getByText(/Salvo na aba/)).toBeTruthy();
  });

  it("resolve o problema com o nível escolhido e mostra a resolução com fórmulas", async () => {
    const solved = generation({
      operation: "resolver_problema", operation_label: "Resolver problema", detail_level: "detalhado",
      result: {}, markdown: "# P\n\n> Resolução gerada por IA. Ela pode conter erros.\n\n$$\nx = 3\n$$\n",
    });
    mockFetch(() => json(solved));
    setup();
    await act(async () => void fireEvent.change(screen.getByLabelText(/Nível de detalhe/), { target: { value: "detalhado" } }));
    await click(/resolver problema/i);

    expect(JSON.parse(calls[0].init.body as string)).toEqual({
      attachment_id: ATT.id, operation: "resolver_problema", detail_level: "detalhado", force: false,
    });
    expect(await screen.findByText(/Resolução gerada por IA/)).toBeTruthy();
    expect(document.querySelector(".katex-display")).not.toBeNull(); // fórmula desenhada
    expect(screen.queryByLabelText(/Texto transcrito/)).toBeNull(); // sem caixa de edição de OCR
  });

  it("avisa que o resultado é de demonstração quando o provedor é o de teste", async () => {
    mockFetch(() => json(generation({ provider: "fake" })));
    setup();
    await click(/extrair texto/i);
    expect(await screen.findByText(/Resultado de demonstração/)).toBeTruthy();
  });

  it("'gerar novamente' envia force=true e mostra erros da IA", async () => {
    let n = 0;
    mockFetch(() => (n++ === 0 ? json(generation({})) : json({ detail: "Você atingiu o limite diário de usos da IA." }, 429)));
    setup();
    await click(/extrair texto/i);
    await screen.findByLabelText(/Texto transcrito/);
    await click(/gerar novamente/i);
    expect(JSON.parse(calls[1].init.body as string).force).toBe(true);
    expect((await screen.findByRole("alert")).textContent).toContain("limite diário");
  });

  it("pede confirmação antes de excluir e remove o resultado da tela", async () => {
    mockFetch((url, init) => (init.method === "DELETE" ? new Response(null, { status: 204 }) : json(generation({}))));
    const { onChanged } = setup();
    await click(/extrair texto/i);
    await screen.findByLabelText(/Texto transcrito/);

    await click(/excluir a imagem 1/i);
    expect(screen.getByText("Excluir esta imagem?")).toBeTruthy();
    expect(calls.some((c) => c.init.method === "DELETE")).toBe(false); // ainda não excluiu
    await act(async () => void fireEvent.click(screen.getByRole("button", { name: "Excluir" })));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(calls.find((c) => c.init.method === "DELETE")?.url).toBe(`/api/v1/attachments/${ATT.id}`);
    expect(screen.queryByLabelText(/Texto transcrito/)).toBeNull();
  });

  it("não deixa disparar duas operações ao mesmo tempo", async () => {
    let release: (r: Response) => void = () => undefined;
    mockFetch(() => new Promise<Response>((resolve) => (release = resolve)));
    setup();
    await click(/extrair texto/i);
    expect((screen.getByRole("button", { name: /resolver problema/i }) as HTMLButtonElement).disabled).toBe(true);
    await act(async () => release(json(generation({}))));
    await waitFor(() => expect((screen.getByRole("button", { name: /resolver problema/i }) as HTMLButtonElement).disabled).toBe(false));
  });

  it("mostra estado vazio sem imagens", () => {
    mockFetch(() => json({}));
    setup({ attachments: [] });
    expect(screen.getByText("Nenhuma imagem nesta aula")).toBeTruthy();
    expect(screen.queryByLabelText(/Nível de detalhe/)).toBeNull();
  });
});
