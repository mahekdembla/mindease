import logging
from typing import Dict, Any, Optional

logger = logging.getLogger("mindease.content_validator")

def is_valid_content(data: Dict[str, Any]) -> bool:
    """
    Checks if extracted content contains required fields.
    """
    title = data.get("title", "").strip()
    main_text = data.get("main_text", "").strip()
    
    if not title or len(title) < 3:
        logger.warning("Validation failed: Title is too short or missing.")
        return False
        
    if not main_text or len(main_text) < 50:
        logger.warning("Validation failed: Main text is too short or missing.")
        return False
        
    return True


def is_duplicate(db: Optional[Any], original_url: str, title: str) -> bool:
    """
    Checks if an article/story with the same original_url or title already exists in MongoDB.
    """
    if db is None:
        return False

    try:
        content_collection = db["content"]
        # Check by URL or exact title
        existing = content_collection.find_one({
            "$or": [
                {"original_url": original_url},
                {"title": title}
            ]
        })
        return existing is not None
    except Exception as e:
        logger.warning(f"Error checking duplicate in MongoDB: {e}")
        return False
