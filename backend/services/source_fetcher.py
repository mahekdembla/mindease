import logging
import requests

logger = logging.getLogger("mindease.source_fetcher")

USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 MindEaseBot/1.0"

def fetch_html_content(url: str, timeout: int = 10) -> str:
    """
    Fetches raw HTML content from a URL using requests.
    Validates URL schema, handles UTF-8 encoding, and falls back to Playwright if needed.
    """
    if not url or not isinstance(url, str):
        logger.warning("Empty or invalid URL passed to fetch_html_content.")
        return ""

    url = url.strip()
    if not (url.startswith("http://") or url.startswith("https://")):
        url = f"https://{url}"

    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
    }
    
    try:
        response = requests.get(url, headers=headers, timeout=timeout)
        response.raise_for_status()
        
        # Ensure proper encoding detection for UTF-8 content
        if response.encoding is None or response.encoding == "ISO-8859-1":
            response.encoding = response.apparent_encoding or "utf-8"

        html = response.text
        
        # Check if the page is a JS shell requiring Playwright
        if len(html) < 800 and ("javascript" in html.lower() or "enable js" in html.lower()):
            logger.info(f"Page at {url} appears to require JS rendering. Triggering Playwright fallback.")
            return _fetch_with_playwright(url)
            
        return html
    except Exception as e:
        logger.warning(f"Requests fetch failed for {url} ({e}). Triggering Playwright fallback.")
        return _fetch_with_playwright(url)


def _fetch_with_playwright(url: str) -> str:
    """
    Fallback method to render dynamic JavaScript pages using Playwright if available.
    """
    try:
        from playwright.sync_api import sync_playwright
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page(user_agent=USER_AGENT)
            page.goto(url, wait_until="domcontentloaded", timeout=15000)
            content = page.content()
            browser.close()
            return content
    except (Exception, BaseException) as err:
        logger.warning(f"Playwright fetch failed or Playwright binaries not installed ({err}).")
        return ""
