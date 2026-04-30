import re
import json
import os

def parse_readme(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    categories = []
    current_category = None
    current_project = None

    for i, line in enumerate(lines):
        line = line.strip()
        
        # Detect category
        cat_match = re.match(r'^###\s+(.+)', line)
        if cat_match and not current_category and '速览' not in cat_match.group(1):
            # Wait, there are subcategories like "### ✏️ 屏幕批注与白板软件" vs project names like "### Ink Canvas"
            # Category names contain emojis, let's assume category starts with emoji or has specific names
            title = cat_match.group(1)
            if '软件' in title or '工具' in title or '类' in title:
                current_category = {
                    'name': title,
                    'projects': []
                }
                categories.append(current_category)
            else:
                # This is a project!
                if current_category:
                    if current_project:
                        current_category['projects'].append(current_project)
                    current_project = {
                        'name': title,
                        'badges': [],
                        'notes': [],
                        'description': [],
                        'keywords': [],
                        'reviews': [],
                        'links': []
                    }
            continue

        if current_project:
            # Check for another project or next category
            if line.startswith('### '):
                if current_category:
                    current_category['projects'].append(current_project)
                current_project = None
                
                # Re-process the line
                title = line[4:].strip()
                if '软件' in title or '工具' in title or '类' in title:
                    current_category = {
                        'name': title,
                        'projects': []
                    }
                    categories.append(current_category)
                else:
                    current_project = {
                        'name': title,
                        'badges': [],
                        'notes': [],
                        'description': [],
                        'keywords': [],
                        'reviews': [],
                        'links': []
                    }
                continue
            
            # Parse contents of current project
            if line.startswith('![') or line.startswith('[!['):
                # Could be a badge, but only if we are before description
                if not current_project['description'] and not current_project['keywords']:
                    current_project['badges'].append(line)
                elif current_project['keywords'] and 'badge' in line:
                    # Keyword badge
                    kw_match = re.search(r'badge/([^-\s]+)-', line)
                    if kw_match:
                        current_project['keywords'].append(kw_match.group(1))
            elif line.startswith('>'):
                current_project['notes'].append(line[1:].strip())
            elif line.startswith('🏷'):
                pass # Keyword start
            elif line.startswith('💬'):
                current_project['reviews'].append(line)
            elif line.startswith('<table'):
                # Start of table parsing could be complex, we'll just capture it as raw HTML or parse simple rows
                pass
            elif line.startswith('<tr>'):
                pass
            elif line.startswith('<td>'):
                # Simple link extraction inside table
                # We'll just use a regex on the whole file later or keep it simple
                pass
            elif line != '' and not line.startswith('<') and not line.startswith('---'):
                if not current_project['keywords'] and not current_project['reviews']:
                    current_project['description'].append(line)

    if current_project and current_category:
        current_category['projects'].append(current_project)

    # Clean up descriptions
    for cat in categories:
        for proj in cat['projects']:
            proj['description'] = '\n'.join(proj['description']).strip()
            proj['notes'] = '\n'.join(proj['notes']).strip()

    with open('data/parsed_projects.json', 'w', encoding='utf-8') as f:
        json.dump(categories, f, ensure_ascii=False, indent=2)

if __name__ == '__main__':
    parse_readme('/workspace/awesome-iwb/README.md')
