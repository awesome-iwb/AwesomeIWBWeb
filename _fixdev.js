const fs=require("fs");
const p="d:/github/AwesomeIWBWeb/frontend/src/views/admin/DevelopersView.vue";
let s=fs.readFileSync(p,"utf8");
s=s.replace(
  "import AdminOrganizationsView from './AdminOrganizationsView.vue';\nimport AdminClaimsView from './AdminClaimsView.vue';",
  "import AdminOrganizationsView from './AdminOrganizationsView.vue';\nimport AdminClaimsView from './AdminClaimsView.vue';\nconst _tabOrgs = AdminOrganizationsView;\nconst _tabClaims = AdminClaimsView;\nvoid _tabOrgs; void _tabClaims;"
);
fs.writeFileSync(p,s);
