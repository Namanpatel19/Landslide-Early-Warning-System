"""
News Router — /news endpoint
Returns recent landslide/disaster news for NER dashboard context.
"""

from fastapi import APIRouter, Query
from ..services.news import fetch_landslide_news

router = APIRouter(prefix="/news", tags=["News"])


@router.get("")
async def get_news(
    q: str = Query(default="landslide northeast india assam meghalaya",
                   description="Search query for news"),
    limit: int = Query(default=6, le=10),
):
    """
    Fetch recent news articles about landslides/disasters in NER.
    Primary: GNews API (if GNEWS_API_KEY set in .env)
    Fallback: Google News RSS (free, no key)
    """
    articles = await fetch_landslide_news(query=q, max_results=limit)
    return {
        "articles": articles,
        "total": len(articles),
        "query": q,
    }
