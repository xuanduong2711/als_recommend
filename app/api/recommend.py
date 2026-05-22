"""Compatibility imports for recommendation services.

FastAPI routes live in :mod:`app.main`.
"""

from app.services.recommender import get_popular_books, get_recommendations_for_user

__all__ = ["get_popular_books", "get_recommendations_for_user"]
