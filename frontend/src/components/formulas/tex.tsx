"use client";

import katex from "katex";
import { useMemo } from "react";

/** Desenha LaTeX com KaTeX (`trust: false`: sem links, imagens nem comandos perigosos). Erros não derrubam a tela. */
export function Tex({ children, display = false, className }: { children: string; display?: boolean; className?: string }) {
  const html = useMemo(
    () => katex.renderToString(children, { displayMode: display, throwOnError: false, strict: "ignore", trust: false }),
    [children, display],
  );
  return (
    <span
      className={className}
      // Saída do KaTeX com trust:false: não contém HTML arbitrário.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
