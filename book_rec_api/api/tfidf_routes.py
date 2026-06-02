from __future__ import annotations

import sys
from functools import lru_cache
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException, Query

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

ARTIFACT_PATH = ROOT / "book_rec_api" / "artifacts" / "model_tfidf.pkl"

router = APIRouter()


@lru_cache(maxsize=1)
def _load_tfidf_model() -> Any:
    path = ARTIFACT_PATH
    if not path.exists():
        raise HTTPException(
            status_code=503,
            detail={"code": "service_unavailable", "message": f"TF-IDF artifact not found: {path}"},
        )
    if path.stat().st_size == 0:
        raise HTTPException(
            status_code=503,
            detail={"code": "service_unavailable", "message": "TF-IDF artifact is empty"},
        )
    import pickle

    try:
        with path.open("rb") as f:
            model = pickle.load(f)
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail={"code": "service_unavailable", "message": f"Failed to load TF-IDF artifact: {exc}"},
        )

    if not callable(getattr(model, "recommend", None)):
        raise HTTPException(
            status_code=503,
            detail={
                "code": "service_unavailable",
                "message": f"TF-IDF artifact ({type(model).__name__}) has no recommend()",
            },
        )
    return model


def _normalize(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    results = []
    for r in items:
        item = {
            "book_id": str(r.get("book_id") or r.get("work_id", "")),
            "work_id": str(r.get("work_id") or r.get("book_id", "")),
            "title": r.get("book_title") or r.get("title"),
            "author": r.get("author") or r.get("authors"),
        }
        score = r.get("score")
        if score is not None:
            item["score"] = round(float(score), 4)
        for field in ("image_url", "avg_star", "num_rating"):
            if field in r and r[field] is not None:
                item[field] = r[field]
        results.append(item)
    return results


@router.get("/recommend/tfidf/{book_id}")
def recommend_tfidf(book_id: str, limit: int = Query(10, ge=1, le=50)):
    model = _load_tfidf_model()
    try:
        recs = model.recommend(book_id, top_k=limit)
    except KeyError as exc:
        raise HTTPException(
            status_code=404,
            detail={"code": "not_found", "message": str(exc)},
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail={"code": "internal_error", "message": str(exc)},
        )
    rows = recs.to_dict("records") if hasattr(recs, "to_dict") else list(recs)[:limit]
    items = _normalize(rows)
    return {"source": "tfidf", "query": {"book_id": book_id, "limit": limit}, "items": items}
