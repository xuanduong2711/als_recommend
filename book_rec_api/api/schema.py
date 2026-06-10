from __future__ import annotations

import json
from typing import Any


def _clean(value: Any) -> Any:
    if value is None:
        return None
    try:
        if value != value:
            return None
    except (TypeError, ValueError):
        pass
    return value.item() if hasattr(value, "item") else value


def _tags(value: Any) -> list[str]:
    value = _clean(value)
    if isinstance(value, list):
        return [str(tag) for tag in value]
    if not isinstance(value, str) or not value.strip():
        return []
    try:
        parsed = json.loads(value)
        if isinstance(parsed, list):
            return [str(tag) for tag in parsed]
    except json.JSONDecodeError:
        pass
    return [tag.strip() for tag in value.replace("|", ",").split(",") if tag.strip()]


def _badges(value: Any) -> list[str]:
    value = _clean(value)
    if isinstance(value, list):
        return [str(b) for b in value]
    if isinstance(value, str) and value.strip():
        try:
            parsed = json.loads(value)
            if isinstance(parsed, list):
                return [str(b) for b in parsed]
        except json.JSONDecodeError:
            return [value.strip()]
    return []


def _parse_json_str(value: Any, default: Any = None) -> Any:
    value = _clean(value)
    if value is None:
        return default
    return value


def _int(value: Any, default: Any = None) -> Any:
    value = _clean(value)
    if value is None:
        return default
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _float(value: Any, default: Any = None) -> Any:
    value = _clean(value)
    if value is None:
        return default
    try:
        if isinstance(value, str):
            value = value.strip().replace(",", ".")
        return float(value)
    except (TypeError, ValueError):
        return default


def _str(value: Any, default: str = "") -> str:
    value = _clean(value)
    if value is None:
        return default
    return str(value)


def canonical_item(row: dict[str, Any]) -> dict[str, Any]:
    """Normalize a raw model row to the public recommendation schema."""
    book_id = _str(row.get("book_id") or row.get("work_id", ""))
    authors = _str(row.get("authors") or row.get("author", ""))
    title = _str(row.get("original_title") or row.get("book_title") or row.get("title", ""))
    item = {
        "book_id": book_id,
        "authors": authors,
        "original_publication_year": _int(row.get("original_publication_year")),
        "original_title": title,
        "language_code": _str(row.get("language_code", "")),
        "tags": _tags(row.get("tags")),
        "ratings_1": _int(row.get("ratings_1")),
        "ratings_2": _int(row.get("ratings_2")),
        "ratings_3": _int(row.get("ratings_3")),
        "ratings_4": _int(row.get("ratings_4")),
        "ratings_5": _int(row.get("ratings_5")),
        "image_url": _str(row.get("image_url", "")),
        "small_image_url": _str(row.get("small_image_url") or row.get("image_url", "")),
        "price": _float(row.get("price")),
        "mood": _parse_json_str(row.get("mood"), "[]"),
        "description": _str(row.get("description", "")),
        "longDescription": _str(row.get("longDescription", "")),
        "pages": _int(row.get("pages")),
        "readTime": _int(row.get("readTime")),
        "status": _str(row.get("status", "")),
        "chapters": _int(row.get("chapters")),
        "previewText": _str(row.get("previewText", "")),
        "accentColor": _str(row.get("accentColor", "")),
        "total_ratings": _int(row.get("total_ratings") or row.get("num_rating") or row.get("total_ratings_count")),
        "average_rating": _float(row.get("average_rating") or row.get("avg_star")),
        "badges": _badges(row.get("badges") or row.get("badge")),
    }
    return item
