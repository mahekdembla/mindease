from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends
from pydantic import BaseModel, HttpUrl
from typing import Optional
import ipaddress
import socket
from urllib.parse import urlparse

from auth import get_current_user
from services.content_service import (
    get_all_content_items,
    process_and_ingest_url,
    seed_default_content,
)

router = APIRouter(prefix="/api/content", tags=["Content"])

class IngestRequest(BaseModel):
    url: str
    category: str = "story" # "story" or "article"

def _is_public_http_url(url: str) -> bool:
    """Rejects non-HTTP schemes and hosts that resolve to private/loopback/link-local addresses,
    so /ingest cannot be used to probe the server's internal network."""
    parsed = urlparse(url if "://" in url else f"https://{url}")
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        return False
    try:
        infos = socket.getaddrinfo(parsed.hostname, None)
    except socket.gaierror:
        return False
    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast:
            return False
    return True

@router.get("/stories")
def get_stories(mood: Optional[str] = None):
    """Returns curated moral & wisdom stories, optionally filtered by mood."""
    seed_default_content()
    stories = get_all_content_items("story", mood=mood)
    return {"status": "success", "count": len(stories), "data": stories}

@router.get("/articles")
def get_articles(mood: Optional[str] = None):
    """Returns curated mental health articles, optionally filtered by mood."""
    seed_default_content()
    articles = get_all_content_items("article", mood=mood)
    return {"status": "success", "count": len(articles), "data": articles}

@router.post("/ingest")
def ingest_content_url(payload: IngestRequest, current_user: dict = Depends(get_current_user)):
    """
    Ingests, cleans, validates, summarizes, and persists content from a given URL.
    """
    if payload.category not in ["story", "article"]:
        raise HTTPException(status_code=400, detail="Category must be 'story' or 'article'")
    if not _is_public_http_url(payload.url):
        raise HTTPException(status_code=400, detail="URL must be a public http(s) address.")

    result = process_and_ingest_url(payload.url, payload.category)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "Ingestion failed."))
    
    return {"status": "success", "data": result.get("data")}

@router.post("/seed")
def seed_content(current_user: dict = Depends(get_current_user)):
    """Seeds default stories and articles into MongoDB."""
    success = seed_default_content(force=True)
    return {"status": "success", "seeded": success}
