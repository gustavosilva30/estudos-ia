import { describe, expect, it } from "vitest";
import { latexToSpeech, protectCurrency } from "./math";
import { markdownToSpeech } from "./speech";

describe("protectCurrency", () => {
  it("escapa o cifrão de moedas para não virar fórmula", () => {
    expect(protectCurrency("custa R$ 5 e R$ 10")).toBe("custa R\\$ 5 e R\\$ 10");
    expect(protectCurrency("US$ 3,50")).toBe("US\\$ 3,50");
  });

  it("não mexe em fórmulas", () => {
    expect(protectCurrency("a fórmula $x^2$ e $$y$$")).toBe("a fórmula $x^2$ e $$y$$");
  });
});

describe("latexToSpeech", () => {
  it("lê frações, potências e raízes", () => {
    expect(latexToSpeech("\\frac{a}{b}")).toBe("a sobre b");
    expect(latexToSpeech("x^2")).toBe("x ao quadrado");
    expect(latexToSpeech("x^{3}")).toBe("x ao cubo");
    expect(latexToSpeech("2^{10}")).toBe("2 elevado a 10");
    expect(latexToSpeech("\\sqrt{x+1}")).toBe("raiz quadrada de x mais 1");
  });

  it("lê uma equação do 2º grau", () => {
    expect(latexToSpeech("x^2 - 5x + 6 = 0")).toBe("x ao quadrado menos 5x mais 6 igual a 0");
  });

  it("lê símbolos gregos e operadores comuns", () => {
    expect(latexToSpeech("\\Delta = b^2 - 4ac")).toBe("delta igual a b ao quadrado menos 4ac");
    expect(latexToSpeech("a \\cdot b \\leq c")).toBe("a vezes b menor ou igual a c");
    expect(latexToSpeech("\\pm \\pi")).toBe("mais ou menos pi");
    expect(latexToSpeech("H_2O")).toBe("H índice 2 O");
  });

  it("não deixa símbolos de LaTeX para trás", () => {
    expect(latexToSpeech("\\left( \\frac{1}{2} \\right)^2")).not.toMatch(/[\\{}$]/);
  });
});

describe("markdownToSpeech com fórmulas", () => {
  it("lê fórmulas no texto e em destaque", () => {
    const out = markdownToSpeech("A raiz é $x = 3$.\n\n$$\n\\frac{a}{b}\n$$");
    expect(out).toContain("x igual a 3");
    expect(out).toContain("a sobre b");
    expect(out).not.toMatch(/\$|\\frac/);
  });

  it("lê valores em reais sem confundir com fórmula", () => {
    expect(markdownToSpeech("Custa R$ 5,50 e depois R$ 10.")).toBe("Custa 5,50 reais e depois 10 reais.");
  });
});
