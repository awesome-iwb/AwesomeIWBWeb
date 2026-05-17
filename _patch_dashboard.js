const fs = require('fs');
const p = 'd:/github/AwesomeIWBWeb/frontend/src/views/admin/DashboardView.vue';
let s = fs.readFileSync(p, 'utf8');
s = s.replace(/hasCapability\('analytics:read'\)/g, 'canViewAnalytics');
const lazyStart = "<LazySection v-if=\"canViewAnalytics\" @visible=\"onAnalyticsVisible\">\n        <div v-if=\"visibleSections.analytics\" class=\"bg-white";
const lazyEndMarker = "      </LazySection>\n\n      <LazySection v-if=\"hasCapability('story:manage')";
if (!s.includes(lazyStart)) {
  console.error('lazyStart not found');
  process.exit(1);
}
s = s.replace(lazyStart, "<div v-if=\"canViewAnalytics\" class=\"bg-white");
s = s.replace(lazyEndMarker, "      </div>\n\n      <LazySection v-if=\"hasCapability('story:manage')");
if (!s.includes('const canViewAnalytics')) {
  s = s.replace(
    "const { hasCapability } = useAuth();",
    "const { hasCapability } = useAuth();\nconst canViewAnalytics = computed(() => hasCapability('analytics:read') || hasCapability('admin_panel_access'));"
  );
}
s = s.replace(
  "async function fetchAnalytics() {\n  if (!canViewAnalytics) return;",
  "async function fetchAnalytics() {\n  if (!canViewAnalytics.value) return;"
);
// fix if first replace already changed wrong
s = s.replace(
  "async function fetchAnalytics() {\n  if (!hasCapability('analytics:read')) return;",
  "async function fetchAnalytics() {\n  if (!canViewAnalytics.value) return;"
);
s = s.replace(
  /function onAnalyticsVisible\(\) \{[\s\S]*?watch\(analyticsDays/,
  'watch(analyticsDays'
);
s = s.replace(
  "watch(analyticsDays, () => {\n  if (visibleSections.analytics) void fetchAnalytics();\n});",
  "watch(analyticsDays, () => {\n  if (canViewAnalytics.value) void fetchAnalytics();\n});"
);
s = s.replace(
  "  } finally {\n    loading.value = false;\n  }\n});",
  "  } finally {\n    loading.value = false;\n  }\n  if (canViewAnalytics.value) void fetchAnalytics();\n});"
);
fs.writeFileSync(p, s);
console.log('ok', !s.includes('onAnalyticsVisible'), s.includes('canViewAnalytics.value) void fetchAnalytics()'));
