import json
import urllib.request
import urllib.error
import time
import os
import requests
from github import Github
import pytz
from datetime import datetime, timezone

# Adapt path for both local testing and GitHub Actions
DATA_FILE = os.environ.get('DATA_FILE', 'backend/src/data.json')
if not os.path.exists(DATA_FILE) and os.path.exists('/workspace/awesome-iwb/backend/src/data.json'):
    DATA_FILE = '/workspace/awesome-iwb/backend/src/data.json'

def get_recent_releases(repo):
    try:
        releases = repo.get_releases()
        release_data = []
        count = 0
        for release in releases:
            if count >= 5:
                break
            release_data.append({
                "tag_name": release.tag_name,
                "published_at": release.published_at.isoformat() if release.published_at else None,
                "body": release.body or "",
                "html_url": release.html_url
            })
            count += 1
            
        if not release_data:
            tags = repo.get_tags()
            count = 0
            for tag in tags:
                if count >= 5:
                    break
                try:
                    commit = repo.get_commit(tag.commit.sha)
                    date = commit.commit.author.date.isoformat()
                except:
                    date = None
                    
                release_data.append({
                    "tag_name": tag.name,
                    "published_at": date,
                    "body": "",
                    "html_url": f"https://github.com/{repo.full_name}/releases/tag/{tag.name}"
                })
                count += 1
                
        return release_data
    except Exception as e:
        print(f"Error fetching releases for {repo.full_name}: {e}")
        return []

def evaluate_status(last_update_str):
    if not last_update_str:
        return "未知"
    
    try:
        # Parse ISO 8601 string (e.g., "2026-04-21T15:55:35Z")
        last_update = datetime.strptime(last_update_str.replace("Z", "+0000"), "%Y-%m-%dT%H:%M:%S%z")
        now = datetime.now(timezone.utc)
        delta_days = (now - last_update).days
        
        if delta_days <= 180: # Updated within 6 months
            return "活跃"
        elif delta_days <= 365: # Updated within 1 year
            return "缓慢更新"
        else:
            return "可能停更"
    except Exception:
        return "未知"

def fetch_github_stats(github_url):
    # Parse https://github.com/owner/repo
    if not github_url.startswith("https://github.com/"):
        return None, None, None, None, False, None, None

    parts = github_url.rstrip('/').split('/')
    if len(parts) < 5:
        return None, None, None, None, False, None, None
        
    owner = parts[3]
    repo = parts[4]
    
    api_url = f"https://api.github.com/repos/{owner}/{repo}"
    headers = {
        'User-Agent': 'Awesome-IWB-Updater',
        'Accept': 'application/vnd.github.v3+json'
    }
    
    token = os.environ.get("GITHUB_TOKEN")
    if token:
        headers['Authorization'] = f"token {token}"
        
    stars = None
    version = None
    last_update = None
    language = None
    is_fork = False
    parent_url = None
    source_url = None
    
    try:
        # Fetch Repo Info (Stars, Last Update, Language, Fork Info)
        req = urllib.request.Request(api_url, headers=headers)
        with urllib.request.urlopen(req, timeout=5) as response:
            data = json.loads(response.read().decode())
            stars = data.get('stargazers_count', 0)
            last_update = data.get('pushed_at', '')
            language = data.get('language', '')
            
            # Fork logic
            is_fork = data.get('fork', False)
            if is_fork:
                if 'parent' in data:
                    parent_url = data['parent'].get('html_url')
                if 'source' in data:
                    source_url = data['source'].get('html_url')
    except urllib.error.HTTPError as e:
        if e.code == 403:
            print("Rate limit hit for repo info!")
            time.sleep(2)
    except Exception:
        pass

    try:
        # Fetch Release Info
        release_url = f"{api_url}/releases/latest"
        req_release = urllib.request.Request(release_url, headers=headers)
        with urllib.request.urlopen(req_release, timeout=5) as response:
            release_data = json.loads(response.read().decode())
            version = release_data.get('tag_name', '')
    except urllib.error.HTTPError as e:
        if e.code == 403:
            print("Rate limit hit for release info!")
            time.sleep(2)
    except Exception:
        pass
        
    return stars, version, last_update, language, is_fork, parent_url, source_url

def main():
    print("Loading data.json...")
    with open(DATA_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)

    token = os.environ.get("GITHUB_TOKEN")
    g = Github(token) if token else Github()

    print("Fetching GitHub stats (this may take a minute)...")
    for cat in data.get('categories', []):
        for proj in cat.get('projects', []):
            # Clean up old manual parent field if it exists
            if 'parent' in proj:
                del proj['parent']
                
            if proj.get('github_url'):
                print(f"Fetching {proj['name']}...")
                stars, version, last_update, language, is_fork, parent_url, source_url = fetch_github_stats(proj['github_url'])
                if stars is not None:
                    proj['stars'] = stars
                if version:
                    proj['version'] = version
                if language:
                    proj['language'] = language
                    
                # Set fork lineage data
                proj['github_is_fork'] = is_fork
                if parent_url:
                    proj['github_parent_url'] = parent_url
                if source_url:
                    proj['github_source_url'] = source_url
                
                try:
                    parts = proj['github_url'].rstrip('/').split('/')
                    if len(parts) >= 5:
                        repo_full_name = f"{parts[3]}/{parts[4]}"
                        repo_obj = g.get_repo(repo_full_name)
                        proj['releases'] = get_recent_releases(repo_obj)
                except Exception as e:
                    print(f"Error fetching repo object for {proj.get('github_url')}: {e}")
                    
                if last_update:
                    proj['last_update'] = last_update
                    
                    # Update status based on last commit/push
                    status = evaluate_status(last_update)
                    if status != "未知":
                        proj['status'] = status
                
                time.sleep(0.5) # Rate limiting delay

    print("Saving updated data.json...")
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        
    print("Done!")

if __name__ == '__main__':
    main()
