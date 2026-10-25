import { describe, expect, it } from "vitest";
import { markdownToSpeech, plainToSpeech, splitIntoChunks } from "./speech";

describe("markdownToSpeech", () => {
  it("remove a marcação e deixa pausas nos títulos e listas", () => {
    const md = [
      "# Fotossíntese",
      "",
      "A **clorofila** absorve a *luz* e o `ATP` é produzido.",
      "",
      "## Etapas",
      "- Fase clara",
      "- Fase escura.",
      "1. Primeiro passo",
      "> Observação importante",
    ].join("\n");
    expect(markdownToSpeech(md)).toBe(
      [
        "Fotossíntese.",
        "A clorofila absorve a luz e o ATP é produzido.",
        "Etapas.",
        "Fase clara.",
        "Fase escura.",
        "Primeiro passo.",
        "Observação importante",
      ].join("\n"),
    );
  });

  it("lê só o texto de links e imagens e ignora código em bloco e HTML", () => {
    const md = "Veja [o guia](https://exemplo.com/x) e ![diagrama](a.png).\n```py\nprint('oi')\n```\n<b>fim</b>";
    const out = markdownToSpeech(md);
    expect(out).toContain("Veja o guia e diagrama.");
    expect(out).toContain("fim");
    expect(out).not.toMatch(/https|print|<b>|```/);
  });

  it("não deixa símbolos de marcação para trás", () => {
    const out = markdownToSpeech("**Conceito:** x\n\n---\n\n| a | b |\n| - | - |\n~~riscado~~");
    expect(out).not.toMatch(/[*#`~]/);
    expect(out).toContain("Conceito: x");
    expect(out).toContain("riscado");
  });

  it("mantém sublinhados de nomes como snake_case", () => {
    expect(markdownToSpeech("use a coluna user_id agora")).toBe("use a coluna user_id agora");
  });

  it("devolve vazio para vazio", () => {
    expect(markdownToSpeech("   \n\n ")).toBe("");
  });
});

describe("plainToSpeech", () => {
  it("junta quebras de linha dentro do parágrafo e preserva parágrafos", () => {
    expect(plainToSpeech("linha um\ncontinua aqui\n\nSegundo   parágrafo")).toBe(
      "linha um continua aqui\nSegundo parágrafo",
    );
  });

  it("não mexe em asteriscos do texto original", () => {
    expect(plainToSpeech("2 * 3 = 6")).toBe("2 * 3 = 6");
  });
});

describe("splitIntoChunks", () => {
  it("agrupa frases curtas até o limite e preserva a ordem e o conteúdo", () => {
    const text = "Primeira frase. Segunda frase! Terceira frase? Quarta.";
    const chunks = splitIntoChunks(text, 30);
    expect(chunks.join(" ")).toBe(text);
    expect(chunks.every((c) => c.length <= 30)).toBe(true);
    expect(chunks.length).toBeGreaterThan(1);
  });

  it("não quebra números decimais nem abreviações com ponto sem espaço", () => {
    const chunks = splitIntoChunks("O valor é 3.5 por cento. Fim.", 200);
    expect(chunks).toEqual(["O valor é 3.5 por cento. Fim."]);
  });

  it("respeita parágrafos (cada linha começa um novo trecho)", () => {
    expect(splitIntoChunks("Um.\nDois.", 200)).toEqual(["Um.", "Dois."]);
  });

  it("divide frases gigantes por vírgula e, sem vírgula, por palavra", () => {
    const comVirgulas = Array.from({ length: 12 }, (_, i) => `item numero ${i}`).join(", ") + ".";
    const a = splitIntoChunks(comVirgulas, 60);
    expect(a.every((c) => c.length <= 60)).toBe(true);
    expect(a.join(" ").replace(/\s+/g, " ")).toBe(comVirgulas);

    const semVirgulas = Array.from({ length: 80 }, (_, i) => `palavra${i}`).join(" ");
    const b = splitIntoChunks(semVirgulas, 50);
    expect(b.every((c) => c.length <= 50)).toBe(true);
    expect(b.join(" ")).toBe(semVirgulas);
  });

  it("palavra maior que o limite não trava nem se perde", () => {
    const giant = "x".repeat(500);
    expect(splitIntoChunks(`antes ${giant} depois`, 50).join(" ")).toContain(giant);
  });

  it("ignora texto vazio", () => {
    expect(splitIntoChunks("  \n \n")).toEqual([]);
  });
});
