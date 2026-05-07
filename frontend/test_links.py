from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    
    # Capture console logs
    logs = []
    page.on("console", lambda msg: logs.append(f"[{msg.type}] {msg.text}"))
    page.on("pageerror", lambda err: logs.append(f"[PAGE ERROR] {err}"))
    
    page.goto('http://localhost:5174/')
    page.wait_for_load_state('networkidle')
    
    print("=== Page loaded ===")
    print(f"URL: {page.url}")
    
    # Try clicking nav links
    for link_text in ['Today 精选', '关于我们', '个人中心']:
        try:
            print(f"\n--- Clicking '{link_text}' ---")
            link = page.locator(f'text={link_text}').first
            if link.is_visible():
                link.click()
                page.wait_for_load_state('networkidle')
                print(f"URL after click: {page.url}")
            else:
                print(f"Link '{link_text}' not visible")
        except Exception as e:
            print(f"ERROR clicking '{link_text}': {e}")
    
    print("\n=== Console Logs ===")
    for log in logs:
        print(log)
    
    browser.close()
