const ISSUE_LABEL_IDS = [
  "type:bug",
  "type:feature",
  "type:question",
  "area:ui",
  "area:perf"
] as const;

const ISSUE_LABEL_SET = new Set<string>(ISSUE_LABEL_IDS as unknown as string[]);

export const sanitizeIssueLabels = (labels: any) => {
  if (!Array.isArray(labels)) return [];
  const out: string[] = [];
  for (const raw of labels) {
    const s = typeof raw === "string" ? raw.trim() : "";
    if (!s) continue;
    if (!ISSUE_LABEL_SET.has(s)) continue;
    out.push(s);
  }
  return Array.from(new Set(out));
};

