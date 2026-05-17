const fs = require('fs');
const p = 'd:/github/AwesomeIWBWeb/backend/src/index.ts';
let s = fs.readFileSync(p, 'utf8');
if (!s.includes('async function checkCapAny')) {
  const anchor = 'async function checkCap(user: any, set: any, capabilityId: string): Promise<any> {';
  const idx = s.indexOf(anchor);
  if (idx < 0) throw new Error('checkCap not found');
  const end = s.indexOf('\nconst storyIdPattern', idx);
  const insert = `async function checkCapAny(user: any, set: any, capabilityIds: string[]): Promise<any> {
  if (!dbEnabled) return false;
  if (!user) return apiUnauthorized(set);
  if (isSuperadminUser(user.name)) return false;
  const { userHasCapability } = await import("./services/capabilities");
  for (const capabilityId of capabilityIds) {
    const has = await userHasCapability(user.id, user.name, capabilityId);
    if (has) return false;
  }
  return apiForbidden(set);
}

`;
  s = s.slice(0, end) + '\n' + insert + s.slice(end);
}
const from = `const capErr = await checkCap(user, set, "analytics:read");`;
const to = `const capErr = await checkCapAny(user, set, ["analytics:read", "admin_panel_access"]);`;
if (!s.includes(from)) throw new Error('analytics route not found');
s = s.replace(from, to);
fs.writeFileSync(p, s);
console.log('backend ok');
