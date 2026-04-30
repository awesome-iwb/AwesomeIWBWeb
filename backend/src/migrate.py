import re
import json
import os
import hashlib

def parse_markdown():
    readme_path = os.path.join(os.path.dirname(__file__), '../../README.md')
    output_path = os.path.join(os.path.dirname(__file__), 'data.json')
    
    with open(readme_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    categories = []
    current_category = None
    current_project = None
    
    in_content = False

    for i, line in enumerate(lines):
        line = line.strip()
        
        if not line:
            continue
            
        if line.startswith('## ✏️ 屏幕批注与白板软件'):
            in_content = True
            
        if not in_content:
            continue
            
        # Detect Category: starts with "## " (h2)
        cat_match = re.match(r'^##\s+([^\|]+)$', line)
        if cat_match and ('软件' in line or '工具' in line or '类' in line or '资源' in line):
            cat_name = cat_match.group(1).strip()
            
            if any(char in cat_name for char in ['✏️', '📊', '🛠️', '🧰', '📝', '🌐', '📱']) or cat_name.endswith('软件') or cat_name.endswith('工具'):
                cat_id = hashlib.md5(cat_name.encode()).hexdigest()[:8]
                current_category = {
                    'id': cat_id,
                    'name': cat_name,
                    'description': '',
                    'projects': []
                }
                categories.append(current_category)
                current_project = None
                continue

        # Detect Project
        # The new README format is just "### Project Name" without the developer name next to it.
        # It has a table at the bottom for developer info.
        if line.startswith('### ') and current_category:
            proj_name = line[4:].strip()
            
            icon = ''
            # Check previous 3 lines for an image that isn't a badge or github-icon
            for j in range(1, 4):
                if i - j >= 0 and '<img' in lines[i-j] and 'src=' in lines[i-j]:
                    icon_match = re.search(r'<img[^>]*src="([^"]+)"', lines[i-j])
                    if icon_match and 'github-icon' not in icon_match.group(1):
                        icon = icon_match.group(1)
                        if icon.startswith('./'):
                            icon = icon[1:]
                        elif not icon.startswith('/') and not icon.startswith('http'):
                            icon = '/' + icon
                        break

            # If it's a category, we already caught it above. So this is a project.
            current_project = {
                'name': proj_name,
                'developer': 'Unknown',
                'status': '活跃',
                'recommendation': '🌟',
                'github_url': '',
                'avatar': '',
                'icon': icon,
                'banner': '',
                'description': '',
                'keywords': [],
                'reviews': []
            }
            current_category['projects'].append(current_project)
            continue
            
        # Parse contents inside project
        if current_project:
            # Banner extraction
            if line.startswith('![banner]('):
                banner_match = re.search(r'!\[banner\]\(([^)]+)\)', line)
                if banner_match:
                    banner_url = banner_match.group(1)
                    if banner_url.startswith('./'):
                        banner_url = banner_url[1:]
                    current_project['banner'] = banner_url
                continue
            # Keywords collection
            if line.startswith('🏷'):
                kw_str = line.replace('🏷', '').replace('关键词：', '').replace('**', '').strip()
                current_project['_collecting_keywords'] = True
                if not re.search(r'!\[.*?\]', kw_str) and kw_str:
                    kws = [k.strip() for k in re.split(r'[,，、\s]+', kw_str) if k.strip() and k.strip() != '<br/>']
                    current_project['keywords'].extend(kws)
                continue
                
            if current_project.get('_collecting_keywords'):
                if line.startswith('![') or line.startswith('[!['):
                    badges = re.findall(r'!\[(.*?)\]\(.*?\)', line)
                    if badges:
                        current_project['keywords'].extend(badges)
                    continue
                elif line and not line.startswith('<br/>') and not line.startswith('---'):
                    current_project['_collecting_keywords'] = False

            # Status and Recommendation Badges
            if line.startswith('<div') or line.startswith('![') or line.startswith('[!['):
                if 'orange' in line.lower() or '非常推荐' in line:
                    current_project['recommendation'] = '🥇 非常推荐'
                elif 'blue' in line.lower() or '值得尝试' in line:
                    current_project['recommendation'] = '🥈 值得尝试'
                
                if '停更' in line or 'archive' in line.lower() or '停止更新' in line:
                    current_project['status'] = '停更'
                continue
                
            # Reviews
            rev_match = re.search(r'💬\s*\*\*(.*?)\*\*\s*[:：]\s*(.*)', line)
            if rev_match:
                current_project['reviews'].append({
                    'author': rev_match.group(1).replace(' 锐评', ''),
                    'content': rev_match.group(2)
                })
                continue
                
            # Extract Developer and GitHub URL from HTML table
            if line.startswith('<td>') and 'github.com' in line:
                url_match = re.search(r'href="(https://github\.com/[^"]+)"', line)
                if url_match and not current_project['github_url']:
                    current_project['github_url'] = url_match.group(1)
                    
            if line.startswith('<td>') and '开发者' in lines[i-1]:
                dev_match = re.search(r'<a[^>]*>(.*?)</a>', line)
                if dev_match:
                    current_project['developer'] = re.sub(r'<[^>]+>', '', dev_match.group(1)).strip()
                    
                # Extract real developer avatar from the <img> tag in the <td>
                avatar_match = re.search(r'<img[^>]*src="([^"]+)"', line)
                if avatar_match and 'github-icon' not in avatar_match.group(1):
                    current_project['avatar'] = avatar_match.group(1)
                else:
                    # Set avatar fallback based on developer name or URL if not found in <img>
                    dev_handle = current_project['github_url'].split('/')[-2] if current_project['github_url'] else current_project['developer'].split(' ')[0]
                    current_project['avatar'] = f"https://images.weserv.nl/?url=github.com/{dev_handle}.png"
                continue
                
            # Skip tables and html
            if line.startswith('<') or line.startswith('---') or line.startswith('</tr>') or line.startswith('</td>'):
                continue
                
            # Description (plain text)
            if not line.startswith('>') and not line.startswith('!['):
                current_project['description'] += line + " "

        # Parse category description
        elif current_category and not current_project:
            if line.startswith('>'):
                current_category['description'] += line.replace('>', '').strip() + " "

    # Clean up
    for cat in categories:
        cat['description'] = cat['description'].strip()
        for proj in cat['projects']:
            proj['description'] = proj['description'].strip()
            if '_collecting_keywords' in proj:
                del proj['_collecting_keywords']
            
            # Clean keywords
            cleaned_kws = []
            for k in proj['keywords']:
                # Ignore badges like build status, recommendations
                k_lower = k.lower()
                if 'hot' in k_lower or '推荐' in k_lower or 'stars' in k_lower or 'forks' in k_lower or 'watchers' in k_lower or 'downloads' in k_lower or 'issues' in k_lower or 'discussions' in k_lower or 'created at' in k_lower or 'commit' in k_lower or 'language' in k_lower or 'license' in k_lower or '交流群' in k_lower or 'maintenance' in k_lower:
                    continue
                k = k.replace('<br/>', '').replace('关键词：', '').strip()
                if k:
                    cleaned_kws.append(k)
            proj['keywords'] = list(dict.fromkeys(cleaned_kws)) # Deduplicate
            
            if not proj['avatar']:
                 proj['avatar'] = f"https://images.weserv.nl/?url=github.com/{proj['developer'].split(' ')[0]}.png"
            if not proj['github_url']:
                proj['github_url'] = f"https://github.com/search?q={proj['name'].replace(' ', '+')}"

    categories = [c for c in categories if len(c['projects']) > 0]

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump({"categories": categories}, f, ensure_ascii=False, indent=2)
        
    print(f"Successfully migrated {sum(len(c['projects']) for c in categories)} projects across {len(categories)} categories.")

if __name__ == '__main__':
    parse_markdown()