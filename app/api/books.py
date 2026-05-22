"""Compatibility imports for book API services.

FastAPI routes live in :mod:`app.main`. This module intentionally avoids Flask
so older imports do not pull in the retired framework.
"""

from app.services.recommender import (
    find_books_by_query,
    get_popular_books,
    get_recommendations_for_book,
    get_recommendations_for_user,
)

__all__ = [
    "find_books_by_query",
    "get_popular_books",
    "get_recommendations_for_book",
    "get_recommendations_for_user",
]
