from playwright.sync_api import sync_playwright
import time

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    
    console_errors = []
    page.on("console", lambda msg: console_errors.append(f"[{msg.type}] {msg.text}") if msg.type == "error" else None)
    
    print("=== Test 1: Project Detail Page (ICC-CE) ===")
    page.goto("http://210.16.165.251:8080/project/ICC-CE", timeout=30000)
    page.wait_for_load_state("networkidle", timeout=15000)
    time.sleep(3)
    
    title = page.title()
    print(f"Page title: {title}")
    
    loading_skeleton = page.locator(".animate-pulse")
    skeleton_count = loading_skeleton.count()
    print(f"Loading skeleton visible: {skeleton_count > 0}")
    
    project_name = page.locator("h1").first
    if project_name.count() > 0:
        print(f"Project name found: {project_name.text_content()}")
    else:
        print("Project name NOT found - page may be stuck on loading")
    
    not_found = page.locator("text=Project not found")
    print(f"'Not found' message visible: {not_found.count() > 0}")
    
    page.screenshot(path="/tmp/test_icc_ce.png", full_page=True)
    print("Screenshot saved to /tmp/test_icc_ce.png")
    
    print("\n=== Test 2: Home Page ===")
    page.goto("http://210.16.165.251:8080/", timeout=30000)
    page.wait_for_load_state("networkidle", timeout=15000)
    time.sleep(2)
    
    title = page.title()
    print(f"Home page title: {title}")
    
    project_cards = page.locator("[class*='card'], [class*='project']").count()
    print(f"Project card elements: {project_cards}")
    
    page.screenshot(path="/tmp/test_home.png", full_page=True)
    print("Screenshot saved to /tmp/test_home.png")
    
    print("\n=== Test 3: Today Page (Story Images) ===")
    page.goto("http://210.16.165.251:8080/today", timeout=30000)
    page.wait_for_load_state("networkidle", timeout=15000)
    time.sleep(2)
    
    title = page.title()
    print(f"Today page title: {title}")
    
    story_images = page.locator("article img")
    img_count = story_images.count()
    print(f"Story images found: {img_count}")
    
    if img_count > 0:
        for i in range(min(img_count, 3)):
            src = story_images.nth(i).get_attribute("src")
            natural_width = story_images.nth(i).evaluate("el => el.naturalWidth")
            print(f"  Image {i+1}: src={src}, naturalWidth={natural_width}")
    
    page.screenshot(path="/tmp/test_today.png", full_page=True)
    print("Screenshot saved to /tmp/test_today.png")
    
    print("\n=== Test 4: Navigate from Home to Detail ===")
    page.goto("http://210.16.165.251:8080/", timeout=30000)
    page.wait_for_load_state("networkidle", timeout=15000)
    time.sleep(2)
    
    first_project = page.locator("text=ICC-CE").first
    if first_project.count() > 0:
        first_project.click()
        page.wait_for_load_state("networkidle", timeout=15000)
        time.sleep(3)
        
        title = page.title()
        print(f"After navigation title: {title}")
        
        project_name = page.locator("h1").first
        if project_name.count() > 0:
            print(f"Project name: {project_name.text_content()}")
        else:
            print("Project name NOT found after navigation")
        
        page.screenshot(path="/tmp/test_navigation.png", full_page=True)
        print("Screenshot saved to /tmp/test_navigation.png")
    else:
        print("Could not find ICC-CE project on home page")
    
    print("\n=== Console Errors ===")
    if console_errors:
        for err in console_errors[:10]:
            print(f"  {err}")
    else:
        print("  No console errors detected")
    
    browser.close()
    print("\n=== All tests completed ===")
