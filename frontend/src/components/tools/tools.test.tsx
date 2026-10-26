// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConstantsView } from "./constants-view";
import { ConverterView } from "./converter-view";
import { PeriodicTableView } from "./periodic-table";
import { ReferenceTablesView } from "./reference-tables-view";
import { ToolsHub } from "./tools-hub";
import { ToolsNav } from "./tools-nav";

const nav = vi.hoisted(() => ({ path: "/ferramentas" }));
vi.mock("next/navigation", () => ({ usePathname: () => nav.path }));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  nav.path = "/ferramentas";
});

const type = (label: RegExp | string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe("ToolsNav e hub", () => {
  it("lista todas as ferramentas e marca a atual", () => {
    nav.path = "/ferramentas/conversor";
    render(<ToolsNav />);
    const links = within(screen.getByRole("navigation", { name: "Ferramentas" })).getAllByRole("link");
    expect(links.map((l) => l.textContent)).toEqual(["Todas", "Calculadora", "Fórmulas", "Tabela periódica", "Constantes", "Conversor de unidades", "Tabelas de consulta"]);
    expect(links.filter((l) => l.getAttribute("aria-current") === "page").map((l) => l.textContent)).toEqual(["Conversor de unidades"]);
  });

  it("o hub aponta para cada página", () => {
    render(<ToolsHub />);
    const hrefs = screen.getAllByRole("link").map((l) => l.getAttribute("href"));
    for (const href of ["/calculadora", "/formulas", "/ferramentas/tabela-periodica", "/ferramentas/constantes", "/ferramentas/conversor", "/ferramentas/tabelas"]) {
      expect(hrefs).toContain(href);
    }
  });
});

describe("tabela periódica", () => {
  it("mostra os 118 elementos e os detalhes do selecionado", () => {
    render(<PeriodicTableView />);
    expect(screen.getAllByRole("button", { name: /número atômico/ })).toHaveLength(118);
    fireEvent.click(screen.getByRole("button", { name: "Ferro, número atômico 26" }));
    expect(screen.getByRole("heading", { name: "Ferro" })).toBeTruthy();
    const details = document.querySelector("dl")!.textContent!;
    expect(details).toContain("55,845 u");
    expect(details).toContain("Metais de transição");
    expect(details).toContain("sólido");
    expect(screen.getByText("1s² 2s² 2p⁶ 3s² 3p⁶ 4s² 3d⁶")).toBeTruthy();
    expect(screen.getByText(/K 2 · L 8 · M 14 · N 2/)).toBeTruthy();
  });

  it("avisa elementos radioativos e líquidos", () => {
    render(<PeriodicTableView />);
    fireEvent.click(screen.getByRole("button", { name: "Mercúrio, número atômico 80" }));
    expect(document.querySelector("dl")!.textContent).toContain("líquido");
    fireEvent.click(screen.getByRole("button", { name: "Urânio, número atômico 92" }));
    expect(screen.getByText("Radioativo")).toBeTruthy();
  });

  it("a busca e o filtro de família esmaecem os demais", () => {
    render(<PeriodicTableView />);
    const dimmed = () => screen.getAllByRole("button", { name: /número atômico/ }).filter((b) => b.className.includes("opacity-25")).length;
    expect(dimmed()).toBe(0);
    type("Buscar elemento", "oxig");
    expect(dimmed()).toBe(117);
    type("Buscar elemento", "");
    fireEvent.click(screen.getByRole("button", { name: /Gases nobres/ }));
    expect(dimmed()).toBe(118 - 6); // He, Ne, Ar, Kr, Xe e Rn (o Og é de propriedades desconhecidas)
  });
});

describe("constantes", () => {
  it("lista, filtra e busca", () => {
    render(<ConstantsView />);
    expect(screen.getByText("Constante de Planck")).toBeTruthy();
    expect(screen.getByText("6,62607015 × 10⁻³⁴")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Astronomia e Terra" }));
    expect(screen.queryByText("Constante de Planck")).toBeNull();
    expect(screen.getByText("Massa da Terra")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Todas" }));
    type("Buscar constante", "avogadro");
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    type("Buscar constante", "zzzz");
    expect(screen.getByText("Nenhuma constante encontrada")).toBeTruthy();
  });

  it("copia o valor com ponto decimal", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    render(<ConstantsView />);
    fireEvent.click(screen.getByRole("button", { name: "Copiar valor de Constante de Planck" }));
    await act(async () => {});
    expect(writeText).toHaveBeenCalledWith("6.62607015e-34");
    expect(screen.getByText("Copiado!")).toBeTruthy();
  });

  it("não quebra quando a área de transferência é negada", async () => {
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockRejectedValue(new Error("negado")) } });
    render(<ConstantsView />);
    fireEvent.click(screen.getByRole("button", { name: "Copiar valor de Constante de Planck" }));
    await act(async () => {});
    expect(screen.queryByText("Copiado!")).toBeNull();
  });
});

describe("conversor de unidades", () => {
  const result = () => document.querySelector("[aria-live=polite]")!.textContent ?? "";

  it("converte quilômetros em metros e inverte", () => {
    render(<ConverterView />);
    type("Valor", "2,5");
    fireEvent.change(screen.getByLabelText("De"), { target: { value: "km" } });
    fireEvent.change(screen.getByLabelText("Para"), { target: { value: "m" } });
    expect(result()).toContain("2.500");
    fireEvent.click(screen.getByRole("button", { name: "Inverter as unidades" }));
    expect((screen.getByLabelText("De") as HTMLSelectElement).value).toBe("m");
    expect(result()).toContain("0,0025");
  });

  it("temperatura usa conversão afim", () => {
    render(<ConverterView />);
    fireEvent.click(screen.getByRole("button", { name: "Temperatura" }));
    type("Valor", "100");
    fireEvent.change(screen.getByLabelText("Para"), { target: { value: "F" } });
    expect(result()).toContain("212");
    type("Valor", "-40");
    expect(result()).toContain("-40");
  });

  it("troca de grandeza reinicia as unidades e mostra a tabela completa", () => {
    render(<ConverterView />);
    fireEvent.click(screen.getByRole("button", { name: "Pressão" }));
    expect((screen.getByLabelText("De") as HTMLSelectElement).value).toBe("Pa");
    type("Valor", "1");
    fireEvent.change(screen.getByLabelText("De"), { target: { value: "atm" } });
    fireEvent.change(screen.getByLabelText("Para"), { target: { value: "mmHg" } });
    expect(result()).toContain("760");
    expect(screen.getByText("Ver em todas as unidades")).toBeTruthy();
    expect(document.querySelector("details")!.textContent).toContain("bar");
  });

  it("valor inválido mostra aviso e vazio pede um número", () => {
    render(<ConverterView />);
    type("Valor", "abc");
    expect(screen.getByText("Digite um número.")).toBeTruthy();
    expect(result()).toContain("Digite um valor");
    type("Valor", "");
    expect(screen.queryByText("Digite um número.")).toBeNull();
  });
});

describe("tabelas de consulta", () => {
  it("troca de tabela e desenha as fórmulas", () => {
    render(<ReferenceTablesView />);
    expect(screen.getByText("Regra da cadeia")).toBeTruthy();
    expect(document.querySelectorAll(".katex").length).toBeGreaterThan(10);
    fireEvent.click(screen.getByRole("button", { name: "Integrais" }));
    expect(screen.queryByText("Regra da cadeia")).toBeNull();
    expect(screen.getByText("Por partes")).toBeTruthy();
  });

  it("a busca vasculha todas as tabelas", () => {
    render(<ReferenceTablesView />);
    type("Buscar em todas as tabelas", "seno");
    const items = screen.getAllByRole("listitem");
    expect(items.length).toBeGreaterThanOrEqual(4);
    expect(screen.queryByRole("group", { name: "Tabela" })).toBeNull();
    type("Buscar em todas as tabelas", "zzzz");
    expect(screen.getByText("Nada encontrado")).toBeTruthy();
  });
});
