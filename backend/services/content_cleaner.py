import re
from typing import Dict, Any

def clean_extracted_content(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Cleans, normalizes, and sanitizes extracted article metadata and body text.
    """
    title = data.get("title", "").strip()
    author = data.get("author", "").strip()
    date_str = data.get("date", "").strip()
    main_text = data.get("main_text", "").strip()
    original_url = data.get("original_url", "").strip()

    # Clean whitespace and HTML artifact residues
    main_text = re.sub(r'\s+', ' ', main_text)
    main_text = re.sub(r'(\s*\n\s*)+', '\n\n', main_text)
    
    # Remove common boilerplate lines
    boilerplate_patterns = [
        r'accept all cookies',
        r'privacy policy',
        r'subscribe to our newsletter',
        r'all rights reserved',
    ]
    for pattern in boilerplate_patterns:
        main_text = re.sub(pattern, '', main_text, flags=re.IGNORECASE)

    # Truncate text to reasonable max length (e.g. 4000 chars) for safe LLM processing
    if len(main_text) > 4000:
        main_text = main_text[:4000] + "..."

    return {
        "title": title,
        "author": author or "MindEase Health Editorial",
        "date": date_str,
        "main_text": main_text.strip(),
        "original_url": original_url,
    }
