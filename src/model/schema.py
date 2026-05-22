"""Pydantic models for transformed book recommendation data."""

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


class Book(BaseModel):
    """Book metadata from ``data/book_features_dataset``."""

    work_id: int
    book_id: Optional[int] = None
    title: Optional[str] = None
    book_title: Optional[str] = None
    authors: Optional[str] = None
    author: Optional[str] = None
    year: Optional[int | str] = None
    average_rating: Optional[float] = None
    avg_star: Optional[float] = None
    total_ratings_count: Optional[int] = None
    num_rating: Optional[int] = None
    image_url: Optional[str] = None
    image_path: Optional[str] = None
    tags: Optional[str] = None
    genre: Optional[str] = None
    score: Optional[float] = None
    pred_rating: Optional[float] = None


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


class RecommendationResponse(BaseModel):
    """Response model for book recommendations."""

    books: list[Book]
    based_on_book: Optional[Book] = None
    message: Optional[str] = None


class ErrorResponse(BaseModel):
    """Error response model."""

    error: str
    detail: Optional[str] = None


# Backward-compatible names for older app code.
Product = Book
Purchase = RatingInteraction
