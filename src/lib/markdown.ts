export type TableAlignment = "left" | "center" | "right";

export type InlineToken =
  | { type: "text"; text: string }
  | { type: "code"; text: string }
  | { type: "bold"; text: string }
  | { type: "italic"; text: string }
  | { type: "strike"; text: string }
  | { type: "link"; text: string; url: string };

export type ListItem = {
  text: string;
  checked?: boolean;
};

export type MarkdownBlock =
  | { type: "code"; code: string; language?: string }
  | { type: "table"; headers: string[]; alignments: TableAlignment[]; rows: string[][] }
  | { type: "hr" }
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "blockquote"; lines: string[] }
  | { type: "ul"; items: ListItem[] }
  | { type: "ol"; items: string[] }
  | { type: "spacer" }
  | { type: "paragraph"; text: string };

/**
 * Remove closed <think>...</think> blocks and any unclosed trailing <think>... block.
 */
export function stripThinkTags(text: string): string {
  if (!text) return "";
  let cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, "");
  cleaned = cleaned.replace(/<think>[\s\S]*$/gi, "");
  return cleaned.trim();
}

function endsWithUnescapedPipe(line: string): boolean {
  const t = line.trimEnd();
  if (!t.endsWith("|")) return false;
  let backslashes = 0;
  for (let idx = t.length - 2; idx >= 0 && t[idx] === "\\"; idx--) {
    backslashes++;
  }
  return backslashes % 2 === 0;
}

function hasUnescapedPipe(line: string): boolean {
  for (let idx = 0; idx < line.length; idx++) {
    if (line[idx] === "\\" && idx + 1 < line.length) {
      idx++;
      continue;
    }
    if (line[idx] === "|") return true;
  }
  return false;
}

function splitUnescapedPipes(str: string): string[] {
  const cells: string[] = [];
  let current = "";
  for (let idx = 0; idx < str.length; idx++) {
    if (str[idx] === "\\" && idx + 1 < str.length && str[idx + 1] === "|") {
      current += "|";
      idx++;
    } else if (str[idx] === "|") {
      cells.push(current);
      current = "";
    } else {
      current += str[idx];
    }
  }
  cells.push(current);
  return cells;
}

export function parseTableRowCells(line: string): string[] {
  let clean = line.trim();
  if (clean.startsWith("|")) clean = clean.slice(1);
  if (endsWithUnescapedPipe(clean)) clean = clean.slice(0, -1);
  return splitUnescapedPipes(clean).map((cell) => cell.trim());
}

/**
 * Valid Markdown table separator MUST contain at least one unescaped '|'
 * and every trimmed cell must match /^:?-+:?$/.
 * Plain horizontal rules like '---' or '-----------------' never match.
 */
export function isTableSeparator(line: string): boolean {
  const trimmed = line.trim();
  if (!hasUnescapedPipe(trimmed)) return false;
  let inner = trimmed;
  if (inner.startsWith("|")) inner = inner.slice(1);
  if (endsWithUnescapedPipe(inner)) inner = inner.slice(0, -1);
  const parts = splitUnescapedPipes(inner).map((p) => p.trim());
  if (parts.length === 0) return false;
  return parts.every((p) => /^:?-+:?$/.test(p));
}

export function parseTableAlignments(line: string): TableAlignment[] {
  const cells = parseTableRowCells(line);
  return cells.map((c) => {
    const trimmed = c.trim();
    if (trimmed.startsWith(":") && trimmed.endsWith(":")) return "center";
    if (trimmed.endsWith(":")) return "right";
    return "left";
  });
}

function isHorizontalRule(line: string): boolean {
  return /^\s*([*\-_])\s*(\1\s*){2,}$/.test(line);
}

function isBlockStarter(line: string): boolean {
  return (
    /^\s*```/.test(line) ||
    isHorizontalRule(line) ||
    /^\s*#{1,6}\s+/.test(line) ||
    /^\s*>/.test(line) ||
    /^\s*[-*]\s+/.test(line) ||
    /^\s*\d+\.\s+/.test(line)
  );
}

/**
 * Coalesce lines where an AI wraps a table line leaving a standalone '|' on the next line,
 * or wraps a table header line right before a table separator row.
 */
function preprocessLines(rawLines: string[]): string[] {
  const out: string[] = [];
  let inCode = false;
  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    if (/^\s*```/.test(line)) {
      inCode = !inCode;
      out.push(line);
      continue;
    }
    if (!inCode && out.length > 0 && /^\s*\|\s*$/.test(line)) {
      const prev = out[out.length - 1];
      if (hasUnescapedPipe(prev) && !endsWithUnescapedPipe(prev)) {
        out[out.length - 1] = `${prev.trimEnd()} |`;
        continue;
      }
    }
    if (
      !inCode &&
      out.length > 0 &&
      i + 1 < rawLines.length &&
      isTableSeparator(rawLines[i + 1]) &&
      !isTableSeparator(line) &&
      !isBlockStarter(line)
    ) {
      const prev = out[out.length - 1];
      if (prev.trim().startsWith("|") && hasUnescapedPipe(prev) && !endsWithUnescapedPipe(prev)) {
        out[out.length - 1] = `${prev.trimEnd()} ${line.trim()}`;
        continue;
      }
    }
    out.push(line);
  }
  return out;
}

export function tokenizeInlineMarkdown(text: string): InlineToken[] {
  if (!text) return [];
  const tokens: InlineToken[] = [];
  // Order matters: code first, then links, bold (** or __), strike (~~), italic (* or boundary-safe _)
  const regex =
    /(`[^`\n]+`|\[[^\]\n]+\]\([^)\s\n]+\)|\*\*[^*\n]+\*\*|__[^_\n]+__|~~[^~\n]+~~|\*[^*\n]+\*|(?:(?<=^|[\s(>\[{"'])_[^_\n]+_(?=$|[\s).,!?:;\]}"'])))/g;

  let lastIdx = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      tokens.push({ type: "text", text: text.slice(lastIdx, match.index) });
    }
    const part = match[0];
    if (part.startsWith("`") && part.endsWith("`") && part.length >= 2) {
      tokens.push({ type: "code", text: part.slice(1, -1) });
    } else if (part.startsWith("[")) {
      const linkMatch = part.match(/^\[([^\]\n]+)\]\(([^)\s\n]+)\)$/);
      if (linkMatch) {
        tokens.push({ type: "link", text: linkMatch[1], url: linkMatch[2] });
      } else {
        tokens.push({ type: "text", text: part });
      }
    } else if (
      (part.startsWith("**") && part.endsWith("**") && part.length >= 4) ||
      (part.startsWith("__") && part.endsWith("__") && part.length >= 4)
    ) {
      tokens.push({ type: "bold", text: part.slice(2, -2) });
    } else if (part.startsWith("~~") && part.endsWith("~~") && part.length >= 4) {
      tokens.push({ type: "strike", text: part.slice(2, -2) });
    } else if (
      (part.startsWith("*") && part.endsWith("*") && part.length >= 2) ||
      (part.startsWith("_") && part.endsWith("_") && part.length >= 2)
    ) {
      tokens.push({ type: "italic", text: part.slice(1, -1) });
    } else {
      tokens.push({ type: "text", text: part });
    }
    lastIdx = regex.lastIndex;
  }

  if (lastIdx < text.length) {
    tokens.push({ type: "text", text: text.slice(lastIdx) });
  }
  return tokens;
}

export function parseMarkdownBlocks(content: string): MarkdownBlock[] {
  const cleanedContent = stripThinkTags(content);
  if (!cleanedContent) return [];

  const lines = preprocessLines(cleanedContent.replace(/\r\n/g, "\n").split("\n"));
  const blocks: MarkdownBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // 1. Code Block: ```...```
    if (/^\s*```/.test(line)) {
      const langMatch = line.match(/^\s*```\s*([a-zA-Z0-9_+-]*)/);
      const language = langMatch?.[1] || undefined;
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++;
      blocks.push({ type: "code", code: codeLines.join("\n"), language });
      continue;
    }

    // 2. Markdown Table Detection (with separator OR omitted separator)
    const hasSepNext =
      hasUnescapedPipe(line) &&
      i + 1 < lines.length &&
      isTableSeparator(lines[i + 1]);

    const looksLikePipeRow = (l: string) =>
      l.trim().startsWith("|") && hasUnescapedPipe(l) && parseTableRowCells(l).length >= 2;

    const hasHeaderlessTable =
      !hasSepNext &&
      looksLikePipeRow(line) &&
      i + 1 < lines.length &&
      !isTableSeparator(lines[i + 1]) &&
      looksLikePipeRow(lines[i + 1]);

    if (hasSepNext || hasHeaderlessTable) {
      const headerCells = parseTableRowCells(line);
      const colCount = headerCells.length;
      let alignments: TableAlignment[];

      if (hasSepNext) {
        alignments = parseTableAlignments(lines[i + 1]);
        while (alignments.length < colCount) alignments.push("left");
        i += 2;
      } else {
        alignments = headerCells.map(() => "left");
        i += 1;
      }

      const rows: string[][] = [];
      while (i < lines.length) {
        const curTrim = lines[i].trim();
        if (curTrim === "" || /^\s*```/.test(lines[i])) break;
        if (!hasUnescapedPipe(lines[i]) && !isBlockStarter(lines[i])) break;
        if (isBlockStarter(lines[i]) && !curTrim.startsWith("|")) break;
        if (isTableSeparator(lines[i])) {
          i++;
          continue;
        }

        let rowLine = curTrim;
        i++;

        // Recover wrapped rows where a single row was split across multiple lines
        while (i < lines.length) {
          const nextTrim = lines[i].trim();
          if (nextTrim === "" || /^\s*```/.test(lines[i]) || isTableSeparator(lines[i])) {
            break;
          }
          if (nextTrim === "|") {
            rowLine = `${rowLine} |`;
            i++;
            continue;
          }
          if (nextTrim.startsWith("|")) {
            // Starts a new row
            break;
          }
          if (isBlockStarter(lines[i])) {
            break;
          }
          const currentCellCount = parseTableRowCells(rowLine).length;
          if (!endsWithUnescapedPipe(rowLine) || (currentCellCount < colCount && hasUnescapedPipe(nextTrim))) {
            rowLine = `${rowLine} ${nextTrim}`;
            i++;
          } else {
            break;
          }
        }

        const cells = parseTableRowCells(rowLine);
        while (cells.length < colCount) cells.push("");
        rows.push(cells.slice(0, Math.max(colCount, cells.length)));
      }

      blocks.push({ type: "table", headers: headerCells, alignments, rows });
      continue;
    }

    // 3. Horizontal Rule: --- or *** or ___
    if (isHorizontalRule(line)) {
      blocks.push({ type: "hr" });
      i++;
      continue;
    }

    // 4. Headings: #, ##, ### (and ####..###### clamped to 3)
    const headingMatch = line.match(/^\s*(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      const level = Math.min(3, headingMatch[1].length) as 1 | 2 | 3;
      blocks.push({ type: "heading", level, text: headingMatch[2] });
      i++;
      continue;
    }

    // 5. Blockquotes: > quote
    if (/^\s*>/.test(line)) {
      const quoteLines: string[] = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) {
        const cleanedQuote = lines[i].replace(/^\s*>\s?/, "");
        if (cleanedQuote.trim() !== "") {
          quoteLines.push(cleanedQuote);
        }
        i++;
      }
      if (quoteLines.length > 0) {
        blocks.push({ type: "blockquote", lines: quoteLines });
      }
      continue;
    }

    // 6. Bullet list: "- item" or "* item" (with optional [x] / [ ] checkbox)
    if (/^\s*[-*]\s+/.test(line)) {
      const items: ListItem[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        const rawItem = lines[i].replace(/^\s*[-*]\s+/, "");
        const checkMatch = rawItem.match(/^\[(x|X| )\]\s+(.*)$/);
        if (checkMatch) {
          items.push({
            checked: checkMatch[1].toLowerCase() === "x",
            text: checkMatch[2],
          });
        } else {
          items.push({ text: rawItem });
        }
        i++;
      }
      blocks.push({ type: "ul", items });
      continue;
    }

    // 7. Numbered list: "1. item"
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ""));
        i++;
      }
      blocks.push({ type: "ol", items });
      continue;
    }

    // 8. Empty line -> spacer
    if (line.trim() === "") {
      blocks.push({ type: "spacer" });
      i++;
      continue;
    }

    // 9. Regular paragraph line
    blocks.push({ type: "paragraph", text: line });
    i++;
  }

  return blocks;
}

export function sanitizeLinkUrl(rawUrl: string): string | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("//")) return null;
  if (trimmed.startsWith("/") || trimmed.startsWith("#")) {
    return trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "http:" || parsed.protocol === "https:" || parsed.protocol === "mailto:") {
      return trimmed;
    }
    return null;
  } catch {
    return null;
  }
}
