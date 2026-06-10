from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Any
from uuid import UUID

import pandas as pd
from fastapi import APIRouter, HTTPException, Query

from ..serving import ALSServingModel, TfidfServingModel
from .schema import canonical_item


HERE = Path(__file__).resolve().parent
ARTIFACT_DIR = (HERE.parent / "artifacts").resolve()
ALS_ARTIFACT_PATH = (ARTIFACT_DIR / "model_als.pkl").resolve()
TFIDF_ARTIFACT_PATH = (ARTIFACT_DIR / "model_tfidf.pkl").resolve()
BOOKS_CATALOG_PATH = (HERE.parents[2] / "database_data" / "books.csv").resolve()

router = APIRouter()


@lru_cache(maxsize=1)
def _load_books_catalog(path: str) -> dict[str, dict[str, Any]]:
    df = pd.read_csv(path, sep=";", dtype=str, low_memory=False)
    catalog: dict[str, dict[str, Any]] = {}
    for _, row in df.iterrows():
        book_id = row.get("book_id", "")
        if book_id:
            catalog[book_id] = row.dropna().to_dict()
    return catalog


def _build_item(book_id: str, catalog: dict[str, dict[str, Any]]) -> dict[str, Any]:
    meta = catalog.get(book_id, {})
    if meta:
        return canonical_item(meta)
    return canonical_item({"book_id": book_id})


@lru_cache(maxsize=2)
def _load_als_model_cached(
    path_value: str,
    modified_ns: int,
    size: int,
) -> ALSServingModel:
    del modified_ns, size
    return ALSServingModel.load(path_value)


@lru_cache(maxsize=2)
def _load_tfidf_model_cached(
    path_value: str,
    modified_ns: int,
    size: int,
) -> TfidfServingModel:
    del modified_ns, size
    return TfidfServingModel.load(path_value)


def _load_als_model() -> ALSServingModel:
    path = ALS_ARTIFACT_PATH
    if not path.exists():
        raise HTTPException(
            status_code=503,
            detail={"code": "service_unavailable", "message": "ALS artifact not found"},
        )
    stat = path.stat()
    if stat.st_size == 0:
        raise HTTPException(
            status_code=503,
            detail={"code": "service_unavailable", "message": "ALS artifact is empty"},
        )
    try:
        return _load_als_model_cached(str(path), stat.st_mtime_ns, stat.st_size)
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail={"code": "service_unavailable", "message": f"Failed to load ALS artifact: {exc}"},
        ) from exc


def _load_tfidf_model() -> TfidfServingModel:
    path = TFIDF_ARTIFACT_PATH
    if not path.exists():
        raise HTTPException(
            status_code=503,
            detail={"code": "service_unavailable", "message": "TF-IDF artifact not found"},
        )
    stat = path.stat()
    if stat.st_size == 0:
        raise HTTPException(
            status_code=503,
            detail={"code": "service_unavailable", "message": "TF-IDF artifact is empty"},
        )
    try:
        return _load_tfidf_model_cached(str(path), stat.st_mtime_ns, stat.st_size)
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail={"code": "service_unavailable", "message": f"Failed to load TF-IDF artifact: {exc}"},
        ) from exc


@router.get("/recommend/hybrid/{user_id}")
def recommend_hybrid(
    user_id: UUID,
    item_id: UUID | None = Query(None),
    query: str | None = Query(None),
    limit: int = Query(10, ge=1, le=50),
):
    user_id_value = str(user_id)
    als_model = _load_als_model()
    tfidf_model = _load_tfidf_model()
    catalog = _load_books_catalog(str(BOOKS_CATALOG_PATH))

    als_rows: list[dict] = []
    if als_model.has_user(user_id_value):
        try:
            recs = als_model.recommend_for_user(user_id_value, num_items=limit)
            als_rows = recs.to_dict("records") if hasattr(recs, "to_dict") else list(recs)[:limit]
        except Exception:
            als_rows = []

    tfidf_rows: list[dict] = []
    if item_id:
        try:
            recs = tfidf_model.recommend(str(item_id), top_k=limit)
            tfidf_rows = recs.to_dict("records") if hasattr(recs, "to_dict") else list(recs)[:limit]
        except Exception:
            tfidf_rows = []

    als_ids = {str(r.get("book_id") or r.get("work_id", "")) for r in als_rows}
    tfidf_unique = [
        r for r in tfidf_rows
        if str(r.get("book_id") or r.get("work_id", "")) not in als_ids
    ]

    combined = als_rows + tfidf_unique
    if not combined:
        raise HTTPException(
            status_code=404,
            detail={"code": "not_found", "message": f"No recommendations for user: {user_id_value}"},
        )

    return [_build_item(str(r.get("book_id") or r.get("work_id", "")), catalog) for r in combined[:limit]]
