const toList = (v: any) => {
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  if (typeof v !== 'string') return [];
  return v.split(/[,，;]/).map((x) => x.trim()).filter(Boolean);
};

export const applyProjectPatch = (project: any, patch: any) => {
  const out = structuredClone(project ?? {});
  const p = patch ?? {};
  const allow = new Set(['description', 'keywords']);

  for (const k of Object.keys(p)) {
    if (!allow.has(k)) continue;
    if (k === 'keywords') out.keywords = toList(p.keywords);
    else out[k] = p[k];
  }
  return out;
};

