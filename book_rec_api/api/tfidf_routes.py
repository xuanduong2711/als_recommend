from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Any
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query

from ..serving import TfidfServingModel
from .schema import canonical_item


HERE = Path(__file__).resolve().parent
ARTIFACT_PATH = (HERE.parent / "artifacts" / "model_tfidf.pkl").resolve()

router = APIRouter()


@lru_cache(maxsize=2)
def _load_tfidf_model_cached(
    path_value: str,
    modified_ns: int,
    size: int,
) -> TfidfServingModel:
    del modified_ns, size
    return TfidfServingModel.load(path_value)


def _load_tfidf_model() -> TfidfServingModel:
    path = ARTIFACT_PATH
    if not path.exists():
        raise HTTPException(
            status_code=503,
            detail={
                "code": "service_unavailable",
                "message": f"TF-IDF artifact not found: {path}",
            },
        )
    stat = path.stat()
    if stat.st_size == 0:
        raise HTTPException(
            status_code=503,
            detail={
                "code": "service_unavailable",
                "message": "TF-IDF artifact is empty",
            },
        )
    try:
        return _load_tfidf_model_cached(
            str(path),
            stat.st_mtime_ns,
            stat.st_size,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail={
                "code": "service_unavailable",
                "message": f"Failed to load TF-IDF artifact: {exc}",
            },
        ) from exc


@router.get("/recommend/tfidf/{book_id}")
def recommend_tfidf(book_id: UUID, limit: int = Query(10, ge=1, le=50)):
    book_id_value = str(book_id)
    model = _load_tfidf_model()
    try:
        recs = model.recommend(book_id_value, top_k=limit)
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
    return [canonical_item(r) for r in rows]
