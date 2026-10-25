/**
 * Preparação de texto para leitura em voz alta (sem DOM, fácil de testar).
 * - markdownToSpeech: tira a marcação do Markdown para não "falar" asteriscos, # etc.
 * - plainToSpeech: texto digitado/colado pelo usuário; só normaliza espaços e quebras de linha.
 * - splitIntoChunks: divide em frases curtas. Os navegadores (principalmente o Chrome) interrompem
 *   falas muito longas, então cada trecho vira uma fala separada.
 */

import { latexToSpeech } from "./math";

const END_PUNCTUATION = /[.!?…:;]["”')\]]*$/;

function endWithPause(line: string): string {
  const trimmed = line.trim();
  return trimmed && !END_PUNCTUATION.test(trimmed) ? `${trimmed}.` : trimmed;
}

export function markdownToSpeech(markdown: string): string {
  const text = markdown
    .replace(/\r\n?/g, "\n")
    .replace(/```[\s\S]*?```/g, " ") // blocos de código não fazem sentido falados
    .replace(/\bR\$\s?(\d+(?:[.,]\d+)*)/g, "$1 reais") // dinheiro antes de tratar fórmulas ($...$)
    .replace(/\$\$([\s\S]+?)\$\$/g, (_m, tex: string) => ` ${latexToSpeech(tex)} `) // fórmulas em destaque
    .replace(/\$([^$\n]+?)\$/g, (_m, tex: string) => ` ${latexToSpeech(tex)} `) // fórmulas no texto
    .replace(/~~~[\s\S]*?~~~/g, " ")
    .replace(/<[^>\n]+>/g, " ") // tags HTML
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1") // imagens -> texto alternativo
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // links -> só o texto
    .replace(/`([^`\n]+)`/g, "$1");

  const lines = text.split("\n").map((raw) => {
    const line = raw
      .replace(/^\s*(?:[-*_]\s*){3,}$/, "") // linha horizontal
      .replace(/^\s{0,3}>\s?/, "") // citação
      .trim();
    const heading = /^#{1,6}\s+(.*)$/.exec(line);
    if (heading) return endWithPause(heading[1].replace(/\s#+\s*$/, ""));
    const item = /^(?:[-*+]|\d+[.)])\s+(.*)$/.exec(line);
    if (item) return endWithPause(item[1]);
    return line;
  });

  return lines
    .join("\n")
    .replace(/\*\*([^*\n]+)\*\*/g, "$1")
    .replace(/__([^_\n]+)__/g, "$1")
    .replace(/\*([^*\n]+)\*/g, "$1")
    .replace(/~~([^~\n]+)~~/g, "$1")
    .replace(/\|/g, ", ") // tabelas
    .replace(/[#*`]+/g, " ") // sobras de marcação
    .replace(/[ \t]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

export function plainToSpeech(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/) // parágrafos
    .map((paragraph) => paragraph.replace(/\s*\n\s*/g, " ").replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

/** Quebra uma frase longa demais em pedaços, preferindo vírgulas/ponto e vírgula e, por fim, palavras. */
function splitLong(sentence: string, max: number): string[] {
  const parts = sentence.match(/[^,;:]+[,;:]?\s*/g) ?? [sentence];
  const out: string[] = [];
  let current = "";
  const push = () => {
    if (current.trim()) out.push(current.trim());
    current = "";
  };
  for (const part of parts) {
    if (part.length > max) {
      push();
      for (const word of part.split(/\s+/).filter(Boolean)) {
        if (current && current.length + word.length + 1 > max) push();
        current += (current ? " " : "") + word;
      }
      continue;
    }
    if (current && current.length + part.length > max) push();
    current += part;
  }
  push();
  return out;
}

export function splitIntoChunks(text: string, max = 220): string[] {
  const chunks: string[] = [];
  for (const paragraph of text.split("\n")) {
    const trimmed = paragraph.trim();
    if (!trimmed) continue;
    // Frase = até pontuação final seguida de espaço/fim (assim "3.5" não é quebrado).
    const sentences = trimmed.match(/[\s\S]*?[.!?…]+["”')\]]*(?=\s|$)|[\s\S]+$/g) ?? [trimmed];
    let current = "";
    for (const raw of sentences) {
      const sentence = raw.trim();
      if (!sentence) continue;
      if (sentence.length > max) {
        if (current) chunks.push(current);
        current = "";
        chunks.push(...splitLong(sentence, max));
        continue;
      }
      if (current && current.length + 1 + sentence.length > max) {
        chunks.push(current);
        current = sentence;
      } else {
        current = current ? `${current} ${sentence}` : sentence;
      }
    }
    if (current) chunks.push(current);
  }
  return chunks;
}
