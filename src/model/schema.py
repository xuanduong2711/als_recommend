"""Pydantic models for recommendation API payloads."""

from typing import Any, Optional

try:
    from pydantic import BaseModel
except ModuleNotFoundError:

    class BaseModel:
        """Small fallback when pydantic is not installed."""

        def __init__(self, **data: Any) -> None:
            annotations: dict[str, Any] = {}
            for cls in reversed(self.__class__.mro()):
                annotations.update(getattr(cls, "__annotations__", {}))

            for field_name in annotations:
                if field_name in data:
                    setattr(self, field_name, data.pop(field_name))
                elif hasattr(self.__class__, field_name):
                    setattr(self, field_name, getattr(self.__class__, field_name))
                else:
                    raise TypeError(f"Missing required field: {field_name}")

            if data:
                extra = ", ".join(sorted(data))
                raise TypeError(f"Unexpected field(s): {extra}")

        def dict(self) -> dict[str, Any]:
            return {
                field_name: getattr(self, field_name)
                for field_name in getattr(self.__class__, "__annotations__", {})
            }


class RecommendationItem(BaseModel):
    """Canonical book payload shared by TF-IDF and ALS APIs."""

    book_id: str
    authors: Optional[str] = None
    original_publication_year: Optional[int] = None
    original_title: Optional[str] = None
    language_code: Optional[str] = None
    tags: list[str] = []
    ratings_1: Optional[int] = None
    ratings_2: Optional[int] = None
    ratings_3: Optional[int] = None
    ratings_4: Optional[int] = None
    ratings_5: Optional[int] = None
    image_url: Optional[str] = None
    small_image_url: Optional[str] = None
    price: Optional[float] = None
    mood: Optional[str] = None
    description: Optional[str] = None
    longDescription: Optional[str] = None
    pages: Optional[int] = None
    readTime: Optional[int] = None
    status: Optional[str] = None
    chapters: Optional[int] = None
    previewText: Optional[str] = None
    accentColor: Optional[str] = None
    total_ratings: Optional[int] = None
    average_rating: Optional[float] = None
    badges: list[str] = []


class PagedRecommendationResponse(BaseModel):
    """Response envelope used by both recommendation models."""

    items: list[RecommendationItem]


class RatingInteraction(BaseModel):
    """User rating row from ``data/interactions_dataset``."""

    user_id: int
    work_id: int
    book_id: Optional[int] = None
    rating: float


class RecommendationRequest(BaseModel):
    """Request model for recommendations."""

    user_id: Optional[int] = None
    work_id: Optional[int] = None
    query: Optional[str] = None
    num_recommendations: Optional[int] = 15


class RecommendationResponse(PagedRecommendationResponse):
    """Backward-compatible alias for the paginated recommendation response."""


class ErrorResponse(BaseModel):
    """Error response model."""

    error: str
    detail: Optional[str] = None


# Backward-compatible names for older app code.
Book = RecommendationItem
Product = Book
Purchase = RatingInteraction
