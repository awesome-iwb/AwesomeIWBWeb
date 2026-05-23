async function main() {
  const tags = await fetch('https://aiwb.smart-teach.cn/api/tags');
  console.log('/api/tags', tags.status);
  const body = await tags.json();
  console.log('items', Array.isArray(body.items) ? body.items.length : body);

  const health = await fetch('https://aiwb.smart-teach.cn/api/health');
  console.log('/api/health', health.status);

  const proj = await fetch('https://aiwb.smart-teach.cn/api/projects/Ink%20Canvas');
  console.log('/api/projects/Ink Canvas', proj.status);
  if (proj.ok) {
    const p = await proj.json();
    console.log('registry_tags', (p.registry_tags || []).length);
  }

  const adminTags = await fetch('https://aiwb.smart-teach.cn/admin/tags.html', { redirect: 'manual' });
  console.log('/admin/tags.html', adminTags.status);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
