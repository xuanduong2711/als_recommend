from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import Any

import pandas as pd
from fastapi import APIRouter, HTTPException, Query

from src.search.elasticsearch_search import (
    fuzzy_search_books,
    search_books_elasticsearch,
)

from .schema import canonical_item


HERE = Path(__file__).resolve().parent
PROJECT_ROOT = HERE.parents[1]
DEFAULT_DATA_PATH = str(PROJECT_ROOT / "data" / "books.csv")
LEGACY_DATA_PATH = str((PROJECT_ROOT / "database_data" / "books.csv").resolve())

router = APIRouter()


def _resolve_data_path() -> str:
    configured_path = os.environ.get("TRANSFORMED_BOOKS_PATH")
    if configured_path:
        return configured_path
    if Path(DEFAULT_DATA_PATH).exists():
        return DEFAULT_DATA_PATH
    return LEGACY_DATA_PATH


@lru_cache(maxsize=1)
def _load_fallback_books(path: str) -> pd.DataFrame:
    df = pd.read_csv(path, sep=";", encoding="utf-8-sig", dtype=str, low_memory=False)
    df["title"] = df.get("original_title", "")
    df["book_title"] = df.get("original_title", "")
    df["author"] = df.get("authors", "")
    for col in ("tags", "genre", "tag_name"):
        if col not in df.columns:
            df[col] = ""
    for col in ("year", "work_id"):
        if col not in df.columns:
            df[col] = ""
    return df


@router.get("/recommend/es/search")
def es_search(
    q: str = Query(..., min_length=1),
    limit: int = Query(10, ge=1, le=100),
):
    if not q.strip():
        raise HTTPException(
            status_code=422,
            detail={"code": "invalid_query", "message": "Query must not be empty or whitespace-only"},
        )
    results = search_books_elasticsearch(
        q,
        limit=limit,
        data_path=_resolve_data_path(),
        fallback_to_local=True,
    )
    if results:
        return [canonical_item(r) for r in results]

    try:
        books = _load_fallback_books(_resolve_data_path())
        results = fuzzy_search_books(books, query=q, limit=limit, normalize_output=True)
        return [canonical_item(r) for r in results]
    except Exception:
        return []
