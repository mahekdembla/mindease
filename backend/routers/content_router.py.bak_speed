from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel, HttpUrl
from typing import Optional

from services.content_service import (
    get_all_content_items,
    process_and_ingest_url,
    seed_default_content,
)

router = APIRouter(prefix="/api/content", tags=["Content"])

class IngestRequest(BaseModel):
    url: str
    category: str = "story" # "story" or "article"

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
def ingest_content_url(payload: IngestRequest):
    """
    Ingests, cleans, validates, summarizes, and persists content from a given URL.
    """
    if payload.category not in ["story", "article"]:
        raise HTTPException(status_code=400, detail="Category must be 'story' or 'article'")

    result = process_and_ingest_url(payload.url, payload.category)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "Ingestion failed."))
    
    return {"status": "success", "data": result.get("data")}

@router.post("/seed")
def seed_content():
    """Seeds default stories and articles into MongoDB."""
    success = seed_default_content()
    return {"status": "success", "seeded": success}
