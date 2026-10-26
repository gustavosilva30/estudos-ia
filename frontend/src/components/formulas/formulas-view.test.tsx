// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { FormulasView } from "./formulas-view";

afterEach(cleanup);

const open = (title: string) => fireEvent.click(within(screen.getByRole("list", { name: "Fórmulas" })).getByText(title));
const type = (label: RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe("FormulasView", () => {
  it("lista as fórmulas e filtra por busca e por área", () => {
    render(<FormulasView />);
    const list = () => within(screen.getByRole("list", { name: "Fórmulas" }));
    expect(list().getAllByRole("listitem").length).toBeGreaterThanOrEqual(40);

    type(/Buscar fórmula/, "pitagoras");
    expect(list().getAllByRole("listitem").length).toBeLessThan(10); // também acha as que citam Pitágoras no texto
    expect(list().getByText("Teorema de Pitágoras")).toBeTruthy();
    expect(list().queryByText("Primeira lei de Ohm")).toBeNull();

    type(/Buscar fórmula/, "");
    fireEvent.click(screen.getByRole("button", { name: "Química" }));
    expect(list().queryByText("Teorema de Pitágoras")).toBeNull();
    expect(list().getByText("Densidade")).toBeTruthy();
  });

  it("avisa quando nada é encontrado", () => {
    render(<FormulasView />);
    type(/Buscar fórmula/, "xyzxyz");
    expect(screen.getByText("Nenhuma fórmula encontrada")).toBeTruthy();
  });

  it("resolve Pitágoras passo a passo", () => {
    render(<FormulasView />);
    open("Teorema de Pitágoras");
    expect(screen.getByText(/Em um triângulo retângulo/)).toBeTruthy();
    expect(screen.getByText(/Preencha os campos que faltam/)).toBeTruthy();

    type(/cateto a/, "3");
    type(/cateto b/, "4");
    const steps = within(screen.getByRole("list", { name: "Passos da solução" }));
    expect(steps.getAllByRole("listitem")).toHaveLength(3);
    expect(document.querySelector('[aria-label="Passos da solução"]')!.textContent).toContain("25");
    expect(document.querySelector(".katex-mathml")?.textContent).toBeTruthy(); // LaTeX realmente desenhado
  });

  it("troca a incógnita e mostra erros de validação", () => {
    render(<FormulasView />);
    open("Teorema de Pitágoras");
    fireEvent.change(screen.getByLabelText("O que você quer descobrir?"), { target: { value: "1" } });
    type(/hipotenusa c/, "5");
    type(/cateto b/, "12");
    expect(screen.getByRole("alert").textContent).toBe("A hipotenusa precisa ser maior que o cateto.");
    type(/hipotenusa c/, "13");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(document.querySelector('[aria-label="Passos da solução"]')!.textContent).toContain("5");
  });

  it("'Usar exemplo' preenche os campos e a conta", () => {
    render(<FormulasView />);
    open("Fórmula de Bhaskara (equação do 2º grau)");
    fireEvent.click(screen.getByRole("button", { name: "Usar exemplo" }));
    expect((screen.getByLabelText(/coeficiente b/) as HTMLInputElement).value).toBe("-3");
    expect(document.querySelector('[aria-label="Passos da solução"]')!.textContent).toContain("25");
  });

  it("preenche constantes sugeridas (g = 9,8) e permite voltar à lista", () => {
    render(<FormulasView />);
    open("Peso");
    expect((screen.getByLabelText(/gravidade/) as HTMLInputElement).value).toBe("9.8");
    fireEvent.click(screen.getByRole("button", { name: "← Voltar à lista" }));
    expect(screen.getByText(/Escolha uma fórmula na lista/)).toBeTruthy();
  });
});
