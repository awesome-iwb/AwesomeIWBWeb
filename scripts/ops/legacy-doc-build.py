"""
Legacy generator kept for historical markdown exports.

This script is no longer the primary website build path.
It remains for compatibility with old content workflows.
"""

import os
import yaml
from jinja2 import Environment, FileSystemLoader

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA_DIR = os.path.join(BASE_DIR, "data")
TEMPLATES_DIR = os.path.join(BASE_DIR, "templates")
DOCS_DIR = os.path.join(BASE_DIR, "docs")
README_PATH = os.path.join(BASE_DIR, "README.md")

os.makedirs(DOCS_DIR, exist_ok=True)
env = Environment(loader=FileSystemLoader(TEMPLATES_DIR))

import urllib.parse

env.filters["urlencode"] = lambda u: urllib.parse.quote(u)


def load_data():
    categories = []
    for filename in os.listdir(DATA_DIR):
        if filename.endswith(".yml") or filename.endswith(".yaml"):
            with open(os.path.join(DATA_DIR, filename), "r", encoding="utf-8") as f:
                categories.append(yaml.safe_load(f))
    categories.sort(key=lambda x: x.get("category_id", ""))
    return categories


def build():
    categories = load_data()
    readme_template = env.get_template("README.j2")
    with open(README_PATH, "w", encoding="utf-8") as f:
        f.write(readme_template.render(categories=categories))

    category_template = env.get_template("category.j2")
    for category in categories:
        cat_file = os.path.join(DOCS_DIR, f"{category['category_id']}.md")
        with open(cat_file, "w", encoding="utf-8") as f:
            f.write(category_template.render(category=category))

    print("legacy doc build completed")


if __name__ == "__main__":
    build()

