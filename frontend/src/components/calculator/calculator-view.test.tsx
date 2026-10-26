// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CalculatorView } from "./calculator-view";
import { niceStep, segments } from "./function-plot";

vi.mock("next/navigation", () => ({ usePathname: () => "/calculadora" }));

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    cb(0);
    return 0;
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const expr = () => screen.getByLabelText("Expressão") as HTMLInputElement;
const type = (value: string) => fireEvent.change(expr(), { target: { value } });
const enter = () => fireEvent.keyDown(expr(), { key: "Enter" });
const result = () => document.querySelector("[aria-live=polite]")!.textContent;
const key = (name: string) => fireEvent.click(screen.getByRole("button", { name }));

describe("CalculatorView", () => {
  it("mostra uma prévia ao vivo e confirma com Enter", () => {
    render(<CalculatorView />);
    type("2+3*4");
    expect(result()).toBe("= 14");
    enter();
    expect(result()).toBe("14");
    expect(expr().value).toBe("");
  });

  it("calcula pelo teclado da tela", () => {
    render(<CalculatorView />);
    const pad = within(screen.getByRole("group", { name: "Teclado numérico" }));
    for (const k of ["1", "2"]) fireEvent.click(pad.getByText(k));
    fireEvent.click(pad.getByRole("button", { name: "multiplicar" }));
    fireEvent.click(pad.getByText("3"));
    key("calcular");
    expect(result()).toBe("36");
  });

  it("mostra erros em português sem travar", () => {
    render(<CalculatorView />);
    type("2+");
    expect(result()).toBe("Expressão incompleta.");
    type("foo(1)");
    enter();
    expect(result()).toContain("não existe");
  });

  it("muda entre graus e radianos", () => {
    render(<CalculatorView />);
    type("sin(30)");
    expect(result()).toBe("= 0.5"); // começa em graus
    fireEvent.click(screen.getByRole("radio", { name: "Radianos" }));
    expect(result()).toBe("= -0.988031624093");
  });

  it("continua a conta a partir do resultado com um operador", () => {
    render(<CalculatorView />);
    type("6*7");
    enter();
    key("somar");
    expect(expr().value).toBe("ans+");
    type("ans+8");
    enter();
    expect(result()).toBe("50");
  });

  it("guarda variáveis entre cálculos", () => {
    render(<CalculatorView />);
    type("x = 4");
    enter();
    type("x^2");
    expect(result()).toBe("= 16");
  });

  it("guarda o histórico, permite reutilizar e limpar", () => {
    render(<CalculatorView />);
    type("1+1");
    enter();
    type("2*5");
    enter();
    expect(JSON.parse(localStorage.getItem("estudos-ia:calculadora:historico")!)).toEqual([
      { expr: "2*5", result: "10" },
      { expr: "1+1", result: "2" },
    ]);
    fireEvent.click(screen.getAllByTitle("Usar de novo")[0]); // o mais recente fica no topo
    expect(expr().value).toBe("2*5");
    fireEvent.click(screen.getByRole("button", { name: "Limpar" }));
    expect(screen.getByText(/aparecem aqui/)).toBeTruthy();
    expect(localStorage.getItem("estudos-ia:calculadora:historico")).toBe("[]");
  });

  it("recarrega o histórico salvo e ignora dados corrompidos", () => {
    localStorage.setItem("estudos-ia:calculadora:historico", JSON.stringify([{ expr: "3*3", result: "9" }, { x: 1 }]));
    render(<CalculatorView />);
    expect(screen.getByText("= 9")).toBeTruthy();
    cleanup();
    localStorage.setItem("estudos-ia:calculadora:historico", "{não é json");
    render(<CalculatorView />);
    expect(screen.getByText(/aparecem aqui/)).toBeTruthy();
  });

  it("memória: M+ soma o valor e MR o insere", () => {
    render(<CalculatorView />);
    type("5*5");
    key("memória M+");
    expect(screen.getByTitle("Valor na memória").textContent).toContain("25");
    type("");
    key("memória MR");
    expect(expr().value).toBe("25");
    key("memória MC");
    expect(screen.queryByTitle("Valor na memória")).toBeNull();
  });

  it("AC limpa e Backspace apaga o último caractere", () => {
    render(<CalculatorView />);
    type("123");
    key("apagar");
    expect(expr().value).toBe("12");
    key("limpar tudo");
    expect(expr().value).toBe("");
  });

  it("mostra o gráfico de uma função e trata expressão inválida", () => {
    render(<CalculatorView />);
    fireEvent.click(screen.getByRole("tab", { name: "Gráfico" }));
    expect(screen.getByRole("img", { name: "Gráfico de sin(x)" })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Função de x"), { target: { value: "x +" } });
    expect(screen.getByRole("alert").textContent).toBe("Expressão incompleta.");
    fireEvent.change(screen.getByLabelText("Função de x"), { target: { value: "x^2" } });
    expect(screen.getByRole("img", { name: "Gráfico de x^2" })).toBeTruthy();
  });
});

describe("auxiliares do gráfico", () => {
  it("escolhe passos redondos para os eixos", () => {
    expect(niceStep(10)).toBe(2);
    expect(niceStep(1)).toBe(0.2);
    expect(niceStep(1000)).toBe(200);
  });

  it("quebra a curva onde não há valor", () => {
    const pts = [{ x: 0, y: 1 }, { x: 1, y: 2 }, { x: 2, y: null }, { x: 3, y: 4 }];
    expect(segments(pts).map((s) => s.length)).toEqual([2, 1]);
    expect(segments([{ x: 0, y: null }])).toEqual([]);
  });
});
