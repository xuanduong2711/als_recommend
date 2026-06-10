from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Any
from uuid import UUID

import pandas as pd
from fastapi import APIRouter, HTTPException, Query

from ..serving import ALSServingModel
from .schema import canonical_item


HERE = Path(__file__).resolve().parent
ARTIFACT_PATH = (HERE.parent / "artifacts" / "model_als.pkl").resolve()
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


def _load_als_model() -> ALSServingModel:
    path = ARTIFACT_PATH
    if not path.exists():
        raise HTTPException(
            status_code=503,
            detail={
                "code": "service_unavailable",
                "message": f"ALS artifact not found: {path}",
            },
        )
    stat = path.stat()
    if stat.st_size == 0:
        raise HTTPException(
            status_code=503,
            detail={
                "code": "service_unavailable",
                "message": "ALS artifact is empty",
            },
        )
    try:
        return _load_als_model_cached(
            str(path),
            stat.st_mtime_ns,
            stat.st_size,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail={
                "code": "service_unavailable",
                "message": f"Failed to load ALS artifact: {exc}",
            },
        ) from exc


@router.get("/recommend/als/{user_id}")
def recommend_als(user_id: UUID, limit: int = Query(10, ge=1, le=50)):
    user_id_value = str(user_id)
    model = _load_als_model()
    try:
        source = model.source_for_user(user_id_value)
        recs = model.recommend_for_user(user_id_value, num_items=limit)
    except KeyError as exc:
        raise HTTPException(
            status_code=404,
            detail={"code": "not_found", "message": str(exc)},
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail={"code": "internal_error", "message": str(exc)},
        ) from exc

    rows = recs.to_dict("records") if hasattr(recs, "to_dict") else list(recs)[:limit]
    catalog = _load_books_catalog(str(BOOKS_CATALOG_PATH))
    return [_build_item(str(r.get("book_id") or r.get("work_id", "")), catalog) for r in rows]
