import { parseGithubRepoUrl } from "./urlSafety";

const slugify = (input: string) => {
  const lowered = input.trim().toLowerCase();
  const replaced = lowered.replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return replaced || 'project';
};

const tryGithubOwnerRepo = (url: string) => {
  const ref = parseGithubRepoUrl(url);
  return ref ? `${ref.owner}-${ref.repo}` : null;
};

export const projectKeyFrom = (p: { slug?: string; name?: string; github_url?: string }) => {
  if (p.slug?.trim()) return slugify(p.slug);
  const gh = p.github_url ? tryGithubOwnerRepo(p.github_url) : null;
  if (gh) return slugify(gh);
  return slugify(p.name ?? '');
};
