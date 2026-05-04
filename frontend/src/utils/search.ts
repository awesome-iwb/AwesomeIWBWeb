const normalize = (s: string) => {
  return String(s ?? '')
    .toLowerCase()
    .replace(/[\s\-_]+/g, '')
    .trim();
};

export const includesNormalized = (target: string, query: string) => {
  const q = normalize(query);
  if (!q) return true;
  return normalize(target).includes(q);
};
