"""Compatibility imports for search services.

FastAPI routes live in :mod:`app.main`.
"""

from app.services.recommender import find_books_by_query

__all__ = ["find_books_by_query"]
