import json
import os
import urllib.request
import hashlib
from urllib.parse import urlparse
import time

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
DATA_FILE = os.path.join(os.path.dirname(__file__), 'data.json')
PUBLIC_DIR = os.path.join(REPO_ROOT, 'frontend', 'public')
ASSETS_PROJECTS_DIR = os.path.join(PUBLIC_DIR, 'assets', 'projects')

os.makedirs(ASSETS_PROJECTS_DIR, exist_ok=True)

def slugify(value):
    value = (value or '').strip().lower()
    out = []
    last_dash = False
    for ch in value:
        ok = ('a' <= ch <= 'z') or ('0' <= ch <= '9')
        if ok:
            out.append(ch)
            last_dash = False
        else:
            if not last_dash and len(out) > 0:
                out.append('-')
                last_dash = True
    s = ''.join(out).strip('-')
    return s or 'project'

def project_key(proj):
    if proj.get('slug'):
        return slugify(proj.get('slug'))
    gh = proj.get('github_url') or ''
    try:
        parsed = urlparse(gh)
        if parsed.hostname == 'github.com':
            parts = [p for p in parsed.path.split('/') if p]
            if len(parts) >= 2:
                return slugify(parts[0] + '-' + parts[1])
    except Exception:
        pass
    return slugify(proj.get('name') or '')

def safe_ext(url):
    ext = os.path.splitext(urlparse(url).path)[1].lower()
    allowed = {'.png', '.webp', '.jpg', '.jpeg', '.svg', '.gif', '.ico'}
    if ext in allowed:
        return ext
    return '.webp'

def download_image(url, pkey, field):
    if not url or not url.startswith('http'):
        return url
        
    try:
        ext = safe_ext(url)
        filename = f"{field}{ext}"
        filepath = os.path.join(ASSETS_PROJECTS_DIR, pkey, filename)
        
        if not os.path.exists(filepath):
            print(f"Downloading {url}...")
            os.makedirs(os.path.dirname(filepath), exist_ok=True)
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'})
            with urllib.request.urlopen(req, timeout=10) as response, open(filepath, 'wb') as out_file:
                out_file.write(response.read())
            time.sleep(0.1) # Be nice to servers
            
        return f"/assets/projects/{pkey}/{filename}"
    except Exception as e:
        print(f"Failed to download {url}: {e}")
        return url # Fallback to original

with open(DATA_FILE, 'r', encoding='utf-8') as f:
    data = json.load(f)

print("Starting image localization...")
for cat in data.get('categories', []):
    for proj in cat.get('projects', []):
        pkey = project_key(proj)
        if proj.get('icon'):
            proj['icon'] = download_image(proj['icon'], pkey, 'icon')
        if proj.get('banner'):
            proj['banner'] = download_image(proj['banner'], pkey, 'banner')
        if proj.get('avatar'):
            proj['avatar'] = download_image(proj['avatar'], pkey, 'avatar')

with open(DATA_FILE, 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print("Image localization complete.")
