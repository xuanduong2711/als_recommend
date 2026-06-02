from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI

from book_rec_api.api.als_routes import router as als_router
from book_rec_api.api.tfidf_routes import router as tfidf_router

BASE_DIR = Path(__file__).resolve().parent
ARTIFACTS_DIR = BASE_DIR / "artifacts"
ALS_MODEL_PATH = ARTIFACTS_DIR / "model_als.pkl"
TFIDF_MODEL_PATH = ARTIFACTS_DIR / "model_tfidf.pkl"

app = FastAPI(title="Book Recommendation API")
app.include_router(als_router)
app.include_router(tfidf_router)


@app.get("/health")
def health():
    als_loaded = False
    tfidf_loaded = False
    try:
        from book_rec_api.api.als_routes import _load_als_model

        _load_als_model()
        als_loaded = True
    except Exception:
        pass
    try:
        from book_rec_api.api.tfidf_routes import _load_tfidf_model

        _load_tfidf_model()
        tfidf_loaded = True
    except Exception:
        pass
    status = "ok" if als_loaded and tfidf_loaded else "degraded"
    return {
        "status": status,
        "models": {
            "als": {"loaded": als_loaded, "path": str(ALS_MODEL_PATH)},
            "tfidf": {"loaded": tfidf_loaded, "path": str(TFIDF_MODEL_PATH)},
        },
    }
