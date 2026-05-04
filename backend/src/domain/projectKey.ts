const slugify = (input: string) => {
  const lowered = input.trim().toLowerCase();
  const replaced = lowered.replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return replaced || 'project';
};

const tryGithubOwnerRepo = (url: string) => {
  try {
    const u = new URL(url);
    if (u.hostname !== 'github.com') return null;
    const parts = u.pathname.replace(/\/+$/, '').split('/').filter(Boolean);
    if (parts.length < 2) return null;
    return `${parts[0]}-${parts[1]}`;
  } catch {
    return null;
  }
};

export const projectKeyFrom = (p: { slug?: string; name?: string; github_url?: string }) => {
  if (p.slug?.trim()) return slugify(p.slug);
  const gh = p.github_url ? tryGithubOwnerRepo(p.github_url) : null;
  if (gh) return slugify(gh);
  return slugify(p.name ?? '');
};

