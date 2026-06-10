from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.als_routes import router as als_router
from .api.es_routes import router as es_router
from .api.hybrid_routes import router as hybrid_router
from .api.tfidf_routes import router as tfidf_router


BASE_DIR = Path(__file__).resolve().parent
ARTIFACTS_DIR = (BASE_DIR / "artifacts").resolve()
ALS_MODEL_PATH = (ARTIFACTS_DIR / "model_als.pkl").resolve()
TFIDF_MODEL_PATH = (ARTIFACTS_DIR / "model_tfidf.pkl").resolve()

app = FastAPI(title="Book Recommendation API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(als_router)
app.include_router(tfidf_router)
app.include_router(hybrid_router)
app.include_router(es_router) 


@app.get("/health")
def health():
    model_status: dict[str, dict[str, object]] = {
        "als": {"exists": ALS_MODEL_PATH.exists(), "loaded": False},
        "tfidf": {"exists": TFIDF_MODEL_PATH.exists(), "loaded": False},
        "elasticsearch": {
            "available": False,
            "url": os.environ.get("ELASTICSEARCH_URL", "http://localhost:9200"),
            "index": os.environ.get("ELASTICSEARCH_INDEX", "books"),
        },
    }
    try:
        from .api.als_routes import _load_als_model

        als_model = _load_als_model()
        model_status["als"].update(
            {"loaded": True, **als_model.model_info()}
        )
    except Exception:
        pass
    try:
        from .api.tfidf_routes import _load_tfidf_model

        _load_tfidf_model()
        model_status["tfidf"]["loaded"] = True
    except Exception:
        pass
    try:
        from src.search.elasticsearch_search import create_client

        es_client = create_client()
        if es_client.ping():
            index_name = str(model_status["elasticsearch"]["index"])
            index_exists = bool(es_client.indices.exists(index=index_name))
            model_status["elasticsearch"].update(
                {
                    "available": True,
                    "index_exists": index_exists,
                    "documents": (
                        int(es_client.count(index=index_name)["count"])
                        if index_exists
                        else 0
                    ),
                }
            )
        else:
            model_status["elasticsearch"]["error"] = "Elasticsearch ping failed"
    except Exception as exc:
        model_status["elasticsearch"]["error"] = str(exc)
    status = (
        "ok"
        if model_status["als"]["loaded"] and model_status["tfidf"]["loaded"]
        else "degraded"
    )
    return {"status": status, "models": model_status}
