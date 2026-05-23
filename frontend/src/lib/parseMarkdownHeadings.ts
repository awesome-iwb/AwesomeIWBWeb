export interface MarkdownHeading {
  level: number;
  text: string;
  line: number;
}

/** Parse ATX headings (# .. ######), skipping fenced code blocks. */
export function parseMarkdownHeadings(content: string): MarkdownHeading[] {
  const lines = (content ?? "").split("\n");
  const headings: MarkdownHeading[] = [];
  let inFence = false;
  let fenceChar = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fenceMatch = line.match(/^(`{3,}|~{3,})/);
    if (fenceMatch) {
      const ch = fenceMatch[1][0];
      if (!inFence) {
        inFence = true;
        fenceChar = ch;
      } else if (ch === fenceChar) {
        inFence = false;
        fenceChar = "";
      }
      continue;
    }
    if (inFence) continue;

    const m = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (!m) continue;
    headings.push({
      level: m[1].length,
      text: m[2].replace(/\s+#+\s*$/, "").trim(),
      line: i,
    });
  }

  return headings;
}
