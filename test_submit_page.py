from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    
    # Desktop view
    page = browser.new_page(viewport={"width": 1280, "height": 900})
    page.goto('https://aiwb.smart-teach.cn/submit')
    page.wait_for_load_state('networkidle')
    page.screenshot(path='/tmp/submit_desktop.png', full_page=True)
    
    # Mobile view
    page2 = browser.new_page(viewport={"width": 375, "height": 812})
    page2.goto('https://aiwb.smart-teach.cn/submit')
    page2.wait_for_load_state('networkidle')
    page2.screenshot(path='/tmp/submit_mobile.png', full_page=True)
    
    browser.close()
    print("Screenshots saved to /tmp/submit_desktop.png and /tmp/submit_mobile.png")
