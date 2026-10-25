// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Markdown } from "./markdown";

afterEach(cleanup);

function html(md: string) {
  const { container } = render(<Markdown>{md}</Markdown>);
  return container;
}

describe("Markdown com fórmulas", () => {
  it("desenha fórmulas no texto e em bloco com KaTeX", () => {
    const c = html("Resolva $x^2 + 1 = 5$.\n\n$$\n\\frac{a}{b}\n$$");
    expect(c.querySelectorAll(".katex").length).toBe(2);
    expect(c.querySelectorAll(".katex-display").length).toBe(1);
  });

  it("R$ não vira fórmula", () => {
    const c = html("Custa R$ 5 e depois R$ 10.");
    expect(c.querySelectorAll(".katex").length).toBe(0);
    expect(c.textContent).toContain("R$ 5 e depois R$ 10");
  });

  it("continua sem executar HTML nem links perigosos", () => {
    const c = html('<img src=x onerror="window.__xss=1"> <script>window.__xss=2</script> [a](javascript:alert(1)) [b](https://ok.example)');
    expect(c.querySelectorAll("img, script").length).toBe(0);
    const hrefs = [...c.querySelectorAll("a")].map((a) => a.getAttribute("href"));
    expect(hrefs).toContain("https://ok.example");
    expect(hrefs.some((h) => h?.startsWith("javascript"))).toBe(false);
  });

  it("comandos perigosos do LaTeX não viram links nem imagens (trust: false)", () => {
    const c = html("$\\href{javascript:alert(1)}{clique}$ $\\includegraphics{x.png}$ $\\url{https://x.example}$");
    expect(c.querySelectorAll("a, img").length).toBe(0);
  });

  it("LaTeX inválido não derruba a tela", () => {
    expect(() => html("$\\frac{1}{$ e $$\\badcommand{$$")).not.toThrow();
  });
});
