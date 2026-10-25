/**
 * Fórmulas: o conteúdo gerado pela IA usa LaTeX entre $...$ (no texto) e $$...$$ (em destaque).
 * Aqui ficam os cuidados para esse formato não atrapalhar textos comuns em português.
 */

/**
 * "R$ 5 e R$ 10" não pode virar uma fórmula entre os dois "$". Escapamos o "$" de moedas conhecidas.
 * (Limitação: um "$" solto antes de número, sem prefixo de moeda, ainda pode ser lido como fórmula.)
 */
export function protectCurrency(markdown: string): string {
  return markdown.replace(/\b(R|US|CA|AU|NZ)\$(?!\$)/g, "$1\\$");
}

const GREEK: Record<string, string> = {
  alpha: "alfa",
  beta: "beta",
  gamma: "gama",
  delta: "delta",
  epsilon: "épsilon",
  theta: "teta",
  lambda: "lambda",
  mu: "mi",
  pi: "pi",
  rho: "rô",
  sigma: "sigma",
  tau: "tau",
  phi: "fi",
  omega: "ômega",
};

const WORDS: Record<string, string> = {
  cdot: " vezes ",
  times: " vezes ",
  div: " dividido por ",
  pm: " mais ou menos ",
  leq: " menor ou igual a ",
  le: " menor ou igual a ",
  geq: " maior ou igual a ",
  ge: " maior ou igual a ",
  neq: " diferente de ",
  ne: " diferente de ",
  approx: " aproximadamente ",
  infty: " infinito ",
  rightarrow: " leva a ",
  to: " tende a ",
  sum: " somatório ",
  int: " integral ",
  lim: " limite ",
  log: " log ",
  ln: " logaritmo natural ",
  sin: " seno ",
  cos: " cosseno ",
  tan: " tangente ",
  degree: " graus ",
};

/** Leitura em voz alta de uma fórmula LaTeX (aproximada: cobre o que é comum em exercícios escolares). */
export function latexToSpeech(latex: string): string {
  let s = latex;
  // Estruturas com argumentos entre chaves, de dentro para fora.
  for (let i = 0; i < 6; i++) {
    s = s
      .replace(/\\d?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, " $1 sobre $2 ")
      .replace(/\\sqrt\s*\[([^\]]*)\]\s*\{([^{}]*)\}/g, " raiz de índice $1 de $2 ")
      .replace(/\\sqrt\s*\{([^{}]*)\}/g, " raiz quadrada de $1 ")
      .replace(/\^\s*\{\s*2\s*\}|\^\s*2(?![0-9])/g, " ao quadrado ")
      .replace(/\^\s*\{\s*3\s*\}|\^\s*3(?![0-9])/g, " ao cubo ")
      .replace(/\^\s*\{([^{}]*)\}/g, " elevado a $1 ")
      .replace(/\^\s*([A-Za-z0-9])/g, " elevado a $1 ")
      .replace(/_\s*\{([^{}]*)\}/g, " índice $1 ")
      .replace(/_\s*([A-Za-z0-9])/g, " índice $1 ")
      .replace(/\\text\s*\{([^{}]*)\}|\\mathrm\s*\{([^{}]*)\}/g, (_m, a: string, b: string) => ` ${a ?? b} `);
  }
  s = s.replace(/\\([A-Za-z]+)/g, (_match, name: string) => GREEK[name] ?? GREEK[name.toLowerCase()] ?? WORDS[name] ?? "");
  s = s
    .replace(/\\[,;:! ]/g, " ")
    .replace(/[{}]/g, " ")
    .replace(/\\\\/g, ". ")
    .replace(/=/g, " igual a ")
    .replace(/\+/g, " mais ")
    .replace(/(?<=[\w)}\] ])\s-\s?(?=[\w({\\])/g, " menos ")
    .replace(/(?<=[\w)}\]])-(?=[\w({\\])/g, " menos ")
    .replace(/(^|\s)-(?=[\w({])/g, "$1menos ")
    .replace(/\//g, " dividido por ")
    .replace(/\*/g, " vezes ")
    .replace(/</g, " menor que ")
    .replace(/>/g, " maior que ")
    .replace(/%/g, " por cento ")
    .replace(/[()|&~$]/g, " ");
  return s.replace(/\s+/g, " ").trim();
}
