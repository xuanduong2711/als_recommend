from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable

from fastapi.templating import Jinja2Templates


@dataclass(frozen=True)
class ServiceHooks:
    find_books_by_query: Callable[..., tuple[list[dict[str, Any]], str | None]]
    get_book_detail_for_frontend: Callable[[str], tuple[dict[str, Any], str | None, int]]
    get_popular_book_entities: Callable[[int], list[dict[str, Any]]]
    get_popular_books: Callable[[int], list[dict[str, Any]]]
    get_recommendations_after_purchase: Callable[..., tuple[list[dict[str, Any]], str | None, int]]
    get_recommendations_for_book: Callable[[str, int], tuple[list[dict[str, Any]], str | None, int]]
    get_recommendations_for_user: Callable[..., tuple[list[dict[str, Any]], str | None, int]]
    list_books_for_frontend: Callable[..., dict[str, Any]]


@dataclass(frozen=True)
class WebContext:
    templates: Jinja2Templates
