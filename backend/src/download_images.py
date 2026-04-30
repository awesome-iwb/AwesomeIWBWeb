import json
import os
import urllib.request
import hashlib
from urllib.parse import urlparse
import time

DATA_FILE = '/workspace/awesome-iwb/backend/src/data.json'
PUBLIC_DIR = '/workspace/awesome-iwb/frontend/public'
LOCAL_IMG_DIR = os.path.join(PUBLIC_DIR, 'local_images')

os.makedirs(os.path.join(LOCAL_IMG_DIR, 'icons'), exist_ok=True)
os.makedirs(os.path.join(LOCAL_IMG_DIR, 'banners'), exist_ok=True)
os.makedirs(os.path.join(LOCAL_IMG_DIR, 'avatars'), exist_ok=True)

def download_image(url, subfolder):
    if not url or not url.startswith('http'):
        # If it's already local, ensure it starts with /
        if url and not url.startswith('/'):
            url = '/' + url
        return url
        
    try:
        ext = os.path.splitext(urlparse(url).path)[1]
        if not ext or len(ext) > 5:
            ext = '.png'
            
        filename = hashlib.md5(url.encode('utf-8')).hexdigest() + ext
        filepath = os.path.join(LOCAL_IMG_DIR, subfolder, filename)
        
        if not os.path.exists(filepath):
            print(f"Downloading {url}...")
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'})
            with urllib.request.urlopen(req, timeout=10) as response, open(filepath, 'wb') as out_file:
                out_file.write(response.read())
            time.sleep(0.1) # Be nice to servers
            
        return f"/local_images/{subfolder}/{filename}"
    except Exception as e:
        print(f"Failed to download {url}: {e}")
        return url # Fallback to original

with open(DATA_FILE, 'r', encoding='utf-8') as f:
    data = json.load(f)

print("Starting image localization...")
for cat in data.get('categories', []):
    for proj in cat.get('projects', []):
        if proj.get('icon'):
            proj['icon'] = download_image(proj['icon'], 'icons')
        if proj.get('banner'):
            proj['banner'] = download_image(proj['banner'], 'banners')
        if proj.get('avatar'):
            proj['avatar'] = download_image(proj['avatar'], 'avatars')

with open(DATA_FILE, 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print("Image localization complete.")
