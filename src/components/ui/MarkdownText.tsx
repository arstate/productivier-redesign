"use client";

import React from "react";

/**
 * Lightweight, zero-dependency Markdown renderer for AI & chat messages.
 * Supports:
 * - **bold**
 * - *italic*
 * - `inline code`
 * - Numbered lists (1. item)
 * - Bullet lists (- item or * item)
 */
export function renderInlineMarkdown(text: string, keyPrefix: string): React.ReactNode[] {
  // Match `code`, **bold**, or *italic*
  const tokenRegex = /(`[^`\n]+`|\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g;
  const parts = text.split(tokenRegex);

  return parts.map((part, idx) => {
    const key = `${keyPrefix}-${idx}`;
    if (part.startsWith("`") && part.endsWith("`") && part.length >= 2) {
      return (
        <code
          key={key}
          className="px-1.5 py-0.5 mx-0.5 rounded-md bg-black/10 dark:bg-white/15 font-mono text-[0.9em]"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith("**") && part.endsWith("**") && part.length >= 4) {
      return (
        <strong key={key} className="font-bold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length >= 2) {
      return (
        <em key={key} className="italic">
          {part.slice(1, -1)}
        </em>
      );
    }
    return <React.Fragment key={key}>{part}</React.Fragment>;
  });
}

export default function MarkdownText({
  content,
  className = "",
}: {
  content: string;
  className?: string;
}) {
  if (!content) return null;

  const lines = content.split("\n");
  const blocks: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Bullet list: "- item" or "* item" (with optional leading spaces)
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ""));
        i++;
      }
      blocks.push(
        <ul key={`ul-${i}`} className="list-disc pl-4 space-y-1 my-1">
          {items.map((item, idx) => (
            <li key={`li-${i}-${idx}`}>{renderInlineMarkdown(item, `ul-${i}-${idx}`)}</li>
          ))}
        </ul>
      );
      continue;
    }

    // Numbered list: "1. item"
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ""));
        i++;
      }
      blocks.push(
        <ol key={`ol-${i}`} className="list-decimal pl-4 space-y-1 my-1">
          {items.map((item, idx) => (
            <li key={`oli-${i}-${idx}`}>{renderInlineMarkdown(item, `ol-${i}-${idx}`)}</li>
          ))}
        </ol>
      );
      continue;
    }

    // Empty line -> small spacer
    if (line.trim() === "") {
      blocks.push(<div key={`sp-${i}`} className="h-1.5" />);
      i++;
      continue;
    }

    // Regular paragraph line
    blocks.push(
      <p key={`p-${i}`} className="whitespace-pre-wrap">
        {renderInlineMarkdown(line, `p-${i}`)}
      </p>
    );
    i++;
  }

  return <div className={`space-y-0.5 ${className}`}>{blocks}</div>;
}
