import re
import json
from pathlib import Path


def parse_readme(readme_path: Path, output_path: Path):
    lines = readme_path.read_text(encoding="utf-8").splitlines()
    categories = []
    current_category = None
    current_project = None

    for line in lines:
        line = line.strip()

        cat_match = re.match(r"^###\s+(.+)", line)
        if cat_match and not current_category and "速览" not in cat_match.group(1):
            title = cat_match.group(1)
            if "软件" in title or "工具" in title or "类" in title:
                current_category = {"name": title, "projects": []}
                categories.append(current_category)
            else:
                if current_category:
                    if current_project:
                        current_category["projects"].append(current_project)
                    current_project = {
                        "name": title,
                        "badges": [],
                        "notes": [],
                        "description": [],
                        "keywords": [],
                        "reviews": [],
                        "links": [],
                    }
            continue

        if not current_project:
            continue

        if line.startswith("### "):
            if current_category:
                current_category["projects"].append(current_project)
            current_project = None

            title = line[4:].strip()
            if "软件" in title or "工具" in title or "类" in title:
                current_category = {"name": title, "projects": []}
                categories.append(current_category)
            else:
                current_project = {
                    "name": title,
                    "badges": [],
                    "notes": [],
                    "description": [],
                    "keywords": [],
                    "reviews": [],
                    "links": [],
                }
            continue

        if line.startswith("![") or line.startswith("[!["):
            if not current_project["description"] and not current_project["keywords"]:
                current_project["badges"].append(line)
            elif current_project["keywords"] and "badge" in line:
                kw_match = re.search(r"badge/([^-\s]+)-", line)
                if kw_match:
                    current_project["keywords"].append(kw_match.group(1))
        elif line.startswith(">"):
            current_project["notes"].append(line[1:].strip())
        elif line.startswith("💬"):
            current_project["reviews"].append(line)
        elif line and not line.startswith("<") and not line.startswith("---"):
            if not current_project["keywords"] and not current_project["reviews"]:
                current_project["description"].append(line)

    if current_project and current_category:
        current_category["projects"].append(current_project)

    for cat in categories:
        for proj in cat["projects"]:
            proj["description"] = "\n".join(proj["description"]).strip()
            proj["notes"] = "\n".join(proj["notes"]).strip()

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(categories, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    repo_root = Path(__file__).resolve().parents[2]
    parse_readme(repo_root / "README.md", repo_root / "data" / "parsed_projects.json")

