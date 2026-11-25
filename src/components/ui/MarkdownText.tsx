"use client";

import React from "react";
import { Check, Square } from "lucide-react";
import {
  parseMarkdownBlocks,
  tokenizeInlineMarkdown,
  sanitizeLinkUrl,
  TableAlignment,
} from "@/lib/markdown";

function getAlignClass(align?: TableAlignment): string {
  if (align === "center") return "text-center";
  if (align === "right") return "text-right";
  return "text-left";
}

export function renderInlineMarkdown(
  text: string,
  keyPrefix: string,
  inverted = false
): React.ReactNode[] {
  const tokens = tokenizeInlineMarkdown(text);

  return tokens.map((token, idx) => {
    const key = `${keyPrefix}-${idx}`;
    switch (token.type) {
      case "code":
        return (
          <code
            key={key}
            className={
              inverted
                ? "px-1.5 py-0.5 mx-0.5 rounded-md bg-white/15 dark:bg-black/10 font-mono text-[0.88em] text-lime-200 dark:text-purple-700"
                : "px-1.5 py-0.5 mx-0.5 rounded-md bg-black/10 dark:bg-white/15 font-mono text-[0.88em] text-purple-700 dark:text-purple-300"
            }
          >
            {token.text}
          </code>
        );
      case "bold":
        return (
          <strong key={key} className="font-extrabold">
            {token.text}
          </strong>
        );
      case "italic":
        return (
          <em key={key} className="italic">
            {token.text}
          </em>
        );
      case "strike":
        return (
          <del key={key} className="line-through opacity-75">
            {token.text}
          </del>
        );
      case "link": {
        const safeHref = sanitizeLinkUrl(token.url);
        if (!safeHref) {
          return (
            <span key={key} className="font-semibold opacity-90">
              {token.text}
            </span>
          );
        }
        return (
          <a
            key={key}
            href={safeHref}
            target="_blank"
            rel="noopener noreferrer"
            className={
              inverted
                ? "text-lime-200 dark:text-purple-700 font-semibold underline underline-offset-2 hover:opacity-90"
                : "text-purple-600 dark:text-purple-400 font-semibold underline underline-offset-2 hover:text-purple-700 dark:hover:text-purple-300"
            }
          >
            {token.text}
          </a>
        );
      }
      default:
        return <React.Fragment key={key}>{token.text}</React.Fragment>;
    }
  });
}

function renderTableCellContent(cell: string, keyPrefix: string): React.ReactNode {
  const parts = cell.split(/<br\s*\/?>/gi);
  if (parts.length === 1) {
    return renderInlineMarkdown(cell, keyPrefix, false);
  }
  return parts.map((part, idx) => (
    <React.Fragment key={`${keyPrefix}-br-${idx}`}>
      {idx > 0 && <br />}
      {renderInlineMarkdown(part.trim(), `${keyPrefix}-seg-${idx}`, false)}
    </React.Fragment>
  ));
}

export default function MarkdownText({
  content,
  className = "",
  inverted = false,
}: {
  content: string;
  className?: string;
  inverted?: boolean;
}) {
  if (!content) return null;

  const blocks = parseMarkdownBlocks(content);
  if (blocks.length === 0) return null;

  return (
    <div className={`space-y-0.5 min-w-0 max-w-full ${className}`}>
      {blocks.map((block, bIdx) => {
        switch (block.type) {
          case "code":
            return (
              <div
                key={`code-${bIdx}`}
                className="my-2.5 rounded-xl bg-slate-900 text-slate-100 text-xs font-mono p-3.5 overflow-x-auto shadow-2xs border border-slate-800"
              >
                <pre className="whitespace-pre">{block.code}</pre>
              </div>
            );

          case "table":
            return (
              <div
                key={`table-${bIdx}`}
                className="my-2.5 w-full max-w-full overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-white/80 dark:bg-slate-900/70 backdrop-blur-xs shadow-2xs"
              >
                <table className="w-full text-xs border-collapse">
                  <thead className="bg-slate-100/90 dark:bg-slate-800/90 text-slate-800 dark:text-slate-100 border-b border-slate-200/80 dark:border-slate-700/80">
                    <tr>
                      {block.headers.map((h, hIdx) => (
                        <th
                          key={hIdx}
                          className={`px-3 py-2 whitespace-nowrap text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-200 ${getAlignClass(
                            block.alignments[hIdx]
                          )}`}
                        >
                          {renderInlineMarkdown(h, `th-${bIdx}-${hIdx}`)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    {block.rows.map((row, rIdx) => (
                      <tr
                        key={rIdx}
                        className="odd:bg-white/60 even:bg-slate-50/70 dark:odd:bg-slate-900/40 dark:even:bg-slate-800/40 hover:bg-purple-50/50 dark:hover:bg-purple-950/20 transition-colors"
                      >
                        {row.map((cell, cIdx) => (
                          <td
                            key={cIdx}
                            className={`px-3 py-2 text-slate-700 dark:text-slate-200 whitespace-nowrap ${getAlignClass(
                              block.alignments[cIdx]
                            )}`}
                          >
                            {renderTableCellContent(cell, `td-${bIdx}-${rIdx}-${cIdx}`)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );

          case "hr":
            return (
              <hr
                key={`hr-${bIdx}`}
                className="my-3 border-t border-slate-200/80 dark:border-slate-700/80"
              />
            );

          case "heading":
            if (block.level === 1) {
              return (
                <h3
                  key={`h1-${bIdx}`}
                  className="text-base font-black mt-3.5 mb-1.5 tracking-tight"
                >
                  {renderInlineMarkdown(block.text, `h1-${bIdx}`, inverted)}
                </h3>
              );
            }
            if (block.level === 2) {
              return (
                <h4
                  key={`h2-${bIdx}`}
                  className="text-sm font-extrabold mt-3 mb-1"
                >
                  {renderInlineMarkdown(block.text, `h2-${bIdx}`, inverted)}
                </h4>
              );
            }
            return (
              <h5
                key={`h3-${bIdx}`}
                className="text-xs font-bold mt-2 mb-0.5 uppercase tracking-wide"
              >
                {renderInlineMarkdown(block.text, `h3-${bIdx}`, inverted)}
              </h5>
            );

          case "blockquote":
            return (
              <blockquote
                key={`bq-${bIdx}`}
                className="my-2 pl-3 py-1.5 border-l-3 border-[#D2F27C] dark:border-purple-400 bg-slate-50/70 dark:bg-slate-800/50 rounded-r-xl text-xs text-slate-700 dark:text-slate-300 italic"
              >
                {block.lines.map((ql, qIdx) => (
                  <p key={qIdx}>{renderInlineMarkdown(ql, `bq-${bIdx}-${qIdx}`, false)}</p>
                ))}
              </blockquote>
            );

          case "ul": {
            const hasCheckboxes = block.items.some((it) => it.checked !== undefined);
            return (
              <ul
                key={`ul-${bIdx}`}
                className={`${
                  hasCheckboxes ? "list-none pl-1" : "list-disc pl-4"
                } space-y-1 my-1.5 text-xs`}
              >
                {block.items.map((item, idx) => (
                  <li key={`li-${bIdx}-${idx}`} className={item.checked !== undefined ? "flex items-start gap-1.5" : undefined}>
                    {item.checked !== undefined && (
                      <span
                        className={`mt-0.5 inline-flex items-center justify-center w-3.5 h-3.5 rounded shrink-0 ${
                          item.checked
                            ? "bg-emerald-500 text-white"
                            : "border border-slate-400 dark:border-slate-500 text-transparent"
                        }`}
                      >
                        {item.checked ? <Check className="w-2.5 h-2.5 stroke-[3]" /> : <Square className="w-2.5 h-2.5" />}
                      </span>
                    )}
                    <span className={item.checked ? "line-through opacity-75" : undefined}>
                      {renderInlineMarkdown(item.text, `ul-${bIdx}-${idx}`, inverted)}
                    </span>
                  </li>
                ))}
              </ul>
            );
          }

          case "ol":
            return (
              <ol
                key={`ol-${bIdx}`}
                className="list-decimal pl-4 space-y-1 my-1.5 text-xs"
              >
                {block.items.map((item, idx) => (
                  <li key={`oli-${bIdx}-${idx}`}>
                    {renderInlineMarkdown(item, `ol-${bIdx}-${idx}`, inverted)}
                  </li>
                ))}
              </ol>
            );

          case "spacer":
            return <div key={`sp-${bIdx}`} className="h-1.5" />;

          case "paragraph":
          default:
            return (
              <p
                key={`p-${bIdx}`}
                className="whitespace-pre-wrap leading-relaxed text-xs"
              >
                {renderInlineMarkdown(block.text, `p-${bIdx}`, inverted)}
              </p>
            );
        }
      })}
    </div>
  );
}
