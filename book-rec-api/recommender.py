from __future__ import annotations

import json
import os
import sys
from functools import lru_cache
from pathlib import Path
from typing import Any

import pandas as pd
import pymssql

SERVICE_DIR = Path(__file__).resolve().parent
REPO_ROOT = SERVICE_DIR.parent
DEFAULT_DB_SERVER = "127.0.0.1"
DEFAULT_DB_PORT = 1433
DEFAULT_DB_NAME = "BookRecDb"
DEFAULT_DB_USER = "sa"

if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.model.tf_idf import ContentBasedRecommender, fit_content_recommender  # noqa: E402


class RecommenderUnavailable(RuntimeError):
    """Raised when database-backed recommendation data is unavailable."""


def _db_config() -> dict[str, Any]:
    password = os.environ.get("DB_PASSWORD") or os.environ.get("SA_PASSWORD")
    if not password:
        raise RecommenderUnavailable("Missing DB_PASSWORD or SA_PASSWORD for SQL Server connection.")

    return {
        "server": os.environ.get("DB_SERVER", DEFAULT_DB_SERVER),
        "port": int(os.environ.get("DB_PORT", DEFAULT_DB_PORT)),
        "database": os.environ.get("DB_NAME", DEFAULT_DB_NAME),
        "user": os.environ.get("DB_USER", DEFAULT_DB_USER),
        "password": password,
    }


def _connect():
    config = _db_config()
    return pymssql.connect(
        server=config["server"],
        port=config["port"],
        user=config["user"],
        password=config["password"],
        database=config["database"],
        login_timeout=10,
        timeout=30,
    )


def validate_runtime_artifacts() -> None:
    try:
        with _connect() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT TOP 1 1 FROM dbo.Books")
            cursor.fetchone()
    except RecommenderUnavailable:
        raise
    except Exception as exc:
        raise RecommenderUnavailable(f"Could not connect to BookRecDb: {exc}") from exc


def _format_db_tags(value: Any) -> str:
    if value is None or pd.isna(value):
        return ""

    text = str(value).strip()
    if not text:
        return ""

    if text.startswith("["):
        try:
            parsed = json.loads(text)
        except json.JSONDecodeError:
            return text
        if isinstance(parsed, list):
            return "|".join(str(item).strip() for item in parsed if str(item).strip())
    return text


@lru_cache(maxsize=1)
def _load_books() -> pd.DataFrame:
    query = """
        SELECT
            CONVERT(varchar(36), book_id) AS book_id,
            original_title AS title,
            authors,
            original_publication_year AS [year],
            average_rating,
            total_ratings AS total_ratings_count,
            image_url,
            tags
        FROM dbo.Books
        WHERE book_id IS NOT NULL
    """
    try:
        with _connect() as conn:
            cursor = conn.cursor(as_dict=True)
            cursor.execute(query)
            data = pd.DataFrame.from_records(cursor.fetchall())
    except RecommenderUnavailable:
        raise
    except Exception as exc:
        raise RecommenderUnavailable(f"Could not load books from BookRecDb: {exc}") from exc

    if data.empty:
        raise RecommenderUnavailable("BookRecDb.dbo.Books does not contain any books.")

    data["book_id"] = data["book_id"].astype(str)
    data["tags"] = data["tags"].map(_format_db_tags)
    return data


@lru_cache(maxsize=1)
def _load_model() -> ContentBasedRecommender:
    return fit_content_recommender(_load_books(), id_col="book_id")


def warm_runtime() -> None:
    _load_books()
    _load_model()


def _limit(value: int | str | None, default: int = 10, maximum: int = 50) -> int:
    try:
        number = int(value) if value is not None else default
    except (TypeError, ValueError):
        return default
    return max(1, min(number, maximum))


def _first_text(record: dict[str, Any], *keys: str, default: str = "") -> str:
    for key in keys:
        value = record.get(key)
        if value is None or pd.isna(value):
            continue
        text = str(value).strip()
        if text:
            return text
    return default


def _first_number(record: dict[str, Any], *keys: str) -> float | None:
    for key in keys:
        value = record.get(key)
        try:
            number = float(value)
        except (TypeError, ValueError):
            continue
        if not pd.isna(number):
            return number
    return None


def _book_payload(record: dict[str, Any]) -> dict[str, Any]:
    book_id = _first_text(record, "book_id")
    rating_count = _first_number(record, "num_rating", "total_ratings_count")
    average_rating = _first_number(record, "avg_star", "average_rating")

    return {
        "book_id": book_id,
        "book_title": _first_text(record, "book_title", "title", default="Untitled"),
        "author": _first_text(record, "author", "authors", default="Unknown"),
        "avg_star": average_rating,
        "num_rating": int(rating_count) if rating_count is not None else 0,
        "genre": _first_text(record, "genre", "tags"),
        "image_path": _first_text(record, "image_path", "image_url"),
    }


def _records(data: pd.DataFrame) -> list[dict[str, Any]]:
    clean_data = data.astype(object).where(pd.notnull(data), None)
    return [_book_payload(record) for record in clean_data.to_dict("records")]


def get_popular_books(num: int | str | None = 9) -> list[dict[str, Any]]:
    limit = _limit(num, default=9)
    data = _load_books().copy()
    data = data.sort_values(["total_ratings_count", "average_rating"], ascending=[False, False])
    return _records(data.head(limit))


def get_recommendations_for_book(book_id: str, num: int | str | None = 10) -> tuple[list[dict[str, Any]], str | None, int]:
    normalized_book_id = str(book_id).strip() if book_id is not None else ""
    if not normalized_book_id:
        return [], "Missing book_id.", 400

    limit = _limit(num)
    try:
        recommendations = _load_model().recommend(normalized_book_id, top_k=limit)
    except KeyError:
        return [], f"Book not found: {normalized_book_id}.", 404
    except RecommenderUnavailable as exc:
        return [], str(exc), 503
    except Exception as exc:
        return [], f"Recommendation service is unavailable: {exc}", 503

    return _records(recommendations.head(limit)), None, 200
