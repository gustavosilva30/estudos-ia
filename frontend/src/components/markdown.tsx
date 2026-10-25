import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import { protectCurrency } from "@/lib/math";

/**
 * Exibe Markdown com segurança: HTML bruto no texto NÃO é renderizado (vira texto) e links perigosos
 * (javascript:) são removidos pela biblioteca. Fórmulas LaTeX ($...$ e $$...$$) são desenhadas pelo KaTeX
 * com `trust: false` (sem links, imagens nem comandos perigosos). Negrito aparece como "conceito destacado".
 */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="md">
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[[rehypeKatex, { trust: false, strict: "ignore", throwOnError: false }]]}
        components={{
          a: ({ href, children: label }) => (
            <a href={href} target="_blank" rel="noopener noreferrer nofollow">
              {label}
            </a>
          ),
        }}
      >
        {protectCurrency(children)}
      </ReactMarkdown>
    </div>
  );
}
