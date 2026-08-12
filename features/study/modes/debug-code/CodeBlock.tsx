"use client";

import hljs from "highlight.js/lib/core";
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import python from "highlight.js/lib/languages/python";
import java from "highlight.js/lib/languages/java";
import json from "highlight.js/lib/languages/json";
import sql from "highlight.js/lib/languages/sql";

import { useMemo } from "react";

hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("jsx", javascript);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("tsx", typescript);
hljs.registerLanguage("python", python);
hljs.registerLanguage("java", java);
hljs.registerLanguage("json", json);
hljs.registerLanguage("sql", sql);

const LANGUAGE_ALIASES: Record<string, string> = {
  js: "javascript",
  jsx: "jsx",
  ts: "typescript",
  tsx: "tsx",
  py: "python",
};

function languageName(language: string): string {
  return LANGUAGE_ALIASES[language.toLowerCase()] ?? language.toLowerCase();
}

export interface CodeBlockProps {
  code: string;
  language: string;
  label?: string;
}

export function CodeBlock({ code, language, label }: CodeBlockProps) {
  const highlightedCode = useMemo(() => {
    const normalizedLanguage = languageName(language);

    try {
      if (hljs.getLanguage(normalizedLanguage)) {
        return hljs.highlight(code, { language: normalizedLanguage }).value;
      }
    } catch {
      // Fall through to escaped plain text for unknown languages.
    }

    return code
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }, [code, language]);

  return (
    <div className="overflow-hidden rounded-2xl border border-[#29433c] bg-[#15231f] shadow-[0_14px_40px_rgba(17,49,42,0.16)] dark:border-[#35564e] dark:shadow-none">
      <div className="flex items-center justify-between gap-3 border-b border-[#29433c] px-4 py-2.5 text-xs font-semibold text-[#9cc8ba] dark:border-[#35564e] dark:text-[#a9d9cc]">
        <span>{label ?? "Code"}</span>
        <span className="font-mono uppercase tracking-[0.12em]">{language}</span>
      </div>
      <pre className="code-block overflow-x-auto p-4 text-left text-[0.8rem] leading-6 text-[#d7f3ea] sm:p-5 sm:text-sm" tabIndex={0} aria-label={`${language} code` }>
        <code dangerouslySetInnerHTML={{ __html: highlightedCode }} />
      </pre>
    </div>
  );
}

