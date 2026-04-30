import json

data_file = "/workspace/awesome-iwb/backend/src/data.json"
with open(data_file, "r", encoding="utf-8") as f:
    data = json.load(f)

for cat in data.get("categories", []):
    for proj in cat.get("projects", []):
        if proj.get("github_url"):
            proj["releases"] = [
                {
                    "tag_name": "v1.2.3",
                    "published_at": "2026-04-20T10:00:00Z",
                    "body": "## What's New\n\n- Added cool new feature\n- Fixed nasty bug\n- Improved performance",
                    "html_url": proj["github_url"] + "/releases/tag/v1.2.3"
                },
                {
                    "tag_name": "v1.2.2",
                    "published_at": "2026-03-15T14:30:00Z",
                    "body": "",
                    "html_url": proj["github_url"] + "/releases/tag/v1.2.2"
                },
                {
                    "tag_name": "v1.2.1",
                    "published_at": "2026-02-10T09:15:00Z",
                    "body": "",
                    "html_url": proj["github_url"] + "/releases/tag/v1.2.1"
                }
            ]

with open(data_file, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print("Mock releases added to data.json")
