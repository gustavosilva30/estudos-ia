import ReactMarkdown from "react-markdown";

/**
 * Exibe Markdown com segurança: HTML bruto no texto NÃO é renderizado (vira texto) e links perigosos
 * (javascript:) são removidos pela biblioteca. Negrito é exibido como "destaque" de conceito.
 */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="md">
      <ReactMarkdown
        components={{
          a: ({ href, children: label }) => (
            <a href={href} target="_blank" rel="noopener noreferrer nofollow">
              {label}
            </a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
