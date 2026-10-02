import logging
from bs4 import BeautifulSoup
from typing import Dict, Any

logger = logging.getLogger("mindease.html_extractor")

def extract_article_data(html: str, url: str) -> Dict[str, Any]:
    """
    Extracts structured article data (title, author, date, main text, original_url)
    from HTML using BeautifulSoup.
    """
    if not html:
        return {
            "title": "",
            "author": "MindEase Mental Health Editorial",
            "date": "",
            "main_text": "",
            "original_url": url,
        }

    soup = BeautifulSoup(html, "html.parser")

    # Decompose script, style, nav, header, footer tags to isolate article body
    for tag in soup(["script", "style", "nav", "header", "footer", "aside", "form", "iframe"]):
        tag.decompose()

    # Extract Title
    title = ""
    if soup.h1:
        title = soup.h1.get_text(strip=True)
    elif soup.title:
        title = soup.title.get_text(strip=True)
    
    # Extract Author
    author = "MindEase Mental Health Editorial"
    author_elem = (
        soup.find(attrs={"rel": "author"}) or
        soup.find(class_=lambda c: c and "author" in c.lower()) or
        soup.find("meta", attrs={"name": "author"})
    )
    if author_elem:
        if author_elem.name == "meta":
            author = author_elem.get("content", author)
        else:
            author = author_elem.get_text(strip=True)

    # Extract Date
    date_str = ""
    date_elem = (
        soup.find("time") or
        soup.find(class_=lambda c: c and ("date" in c.lower() or "published" in c.lower())) or
        soup.find("meta", attrs={"property": "article:published_time"})
    )
    if date_elem:
        if date_elem.name == "meta":
            date_str = date_elem.get("content", "")
        elif date_elem.name == "time" and date_elem.get("datetime"):
            date_str = date_elem["datetime"]
        else:
            date_str = date_elem.get_text(strip=True)

    # Extract Main Article Body Text
    article_body = soup.find("article") or soup.find("main") or soup.find("body")
    paragraphs = []
    if article_body:
        for p in article_body.find_all("p"):
            text = p.get_text(strip=True)
            if len(text) > 25: # filter out short metadata/cookie snippets
                paragraphs.append(text)
    
    main_text = "\n\n".join(paragraphs)

    return {
        "title": title or "Mental Health Reflection",
        "author": author or "Mental Health Advocate",
        "date": date_str,
        "main_text": main_text,
        "original_url": url,
    }
