import os
import yaml
from jinja2 import Environment, FileSystemLoader

# Set up paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, 'data')
TEMPLATES_DIR = os.path.join(BASE_DIR, 'templates')
DOCS_DIR = os.path.join(BASE_DIR, 'docs')
README_PATH = os.path.join(BASE_DIR, 'README.md')

# Ensure docs directory exists
os.makedirs(DOCS_DIR, exist_ok=True)

# Load Jinja2 environment
env = Environment(loader=FileSystemLoader(TEMPLATES_DIR))

# Helper filters
import urllib.parse
env.filters['urlencode'] = lambda u: urllib.parse.quote(u)

def load_data():
    categories = []
    # Only reading whiteboards.yml for the demo, but can be expanded
    for filename in os.listdir(DATA_DIR):
        if filename.endswith('.yml') or filename.endswith('.yaml'):
            with open(os.path.join(DATA_DIR, filename), 'r', encoding='utf-8') as f:
                category_data = yaml.safe_load(f)
                categories.append(category_data)
    
    # Sort categories to match the original layout order (can add sort key in yaml)
    categories.sort(key=lambda x: x.get('category_id', ''))
    return categories

def build():
    print("Loading data...")
    categories = load_data()
    
    # 1. Build main README.md
    print("Generating README.md...")
    readme_template = env.get_template('README.j2')
    with open(README_PATH, 'w', encoding='utf-8') as f:
        f.write(readme_template.render(categories=categories))
        
    # 2. Build modular category documents
    print("Generating modular category docs...")
    category_template = env.get_template('category.j2')
    for category in categories:
        cat_file = os.path.join(DOCS_DIR, f"{category['category_id']}.md")
        print(f" -> {cat_file}")
        with open(cat_file, 'w', encoding='utf-8') as f:
            f.write(category_template.render(category=category))
            
    print("Build completed successfully!")

if __name__ == "__main__":
    build()
