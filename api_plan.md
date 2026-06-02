# API Plan

## Muc tieu

Xay dung mot FastAPI service trong `book_rec_api/` de serve 2 kieu goi y sach:

- `GET /recommend/als/{user_id}`: dung ALS de goi y sach theo hanh vi user.
- `GET /recommend/tfidf/{book_id}`: dung TF-IDF de goi y sach tuong tu sach dang xem.

Training code van nam o root `src/model/`. `book_rec_api/scheduler.py` chi goi lai training code do, sau do luu artifact moi vao `book_rec_api/artifacts/`. `book_rec_api/app.py` chi load artifact va tra API.

## Cau truc thu muc chuan

```text
RECOMMEND_BOOK/
|-- book_rec_api/
|   |-- app.py
|   |-- scheduler.py
|   |-- requirements.txt
|   |-- artifacts/
|   |   |-- model_als.pkl
|   |   +-- model_tfidf.pkl
|   +-- api/
|       |-- als_routes.py
|       +-- tfidf_routes.py
+-- src/
    +-- model/
        |-- als.py
        +-- tf_idf.py
```

## Vai tro tung module

| File | Vai tro |
| --- | --- |
| `src/model/als.py` | Code train ALS. Co the gom them ham export serving artifact cho API. |
| `src/model/tf_idf.py` | Code train/load TF-IDF. Co ham save/load model TF-IDF. |
| `book_rec_api/scheduler.py` | Goi code train tu `../src/model`, train xong luu model moi vao `book_rec_api/artifacts/`. |
| `book_rec_api/app.py` | Khoi tao FastAPI, include router, load/cache model trong `artifacts/`, expose `/health`. |
| `book_rec_api/api/als_routes.py` | Route ALS: `GET /recommend/als/{user_id}`. |
| `book_rec_api/api/tfidf_routes.py` | Route TF-IDF: `GET /recommend/tfidf/{book_id}`. |
| `book_rec_api/artifacts/model_als.pkl` | ALS artifact da train san de serve recommendation theo user. |
| `book_rec_api/artifacts/model_tfidf.pkl` | TF-IDF artifact da train san de serve similar-book recommendation. |

## Luong chay dung

### 1. Training / refresh model

`book_rec_api/scheduler.py` la noi dieu phoi train lai model:

1. Import training code tu root project:
   - `src.model.als`
   - `src.model.tf_idf`
2. Train ALS va TF-IDF bang data pipeline hien co.
3. Ghi artifact moi vao:
   - `book_rec_api/artifacts/model_als.pkl`
   - `book_rec_api/artifacts/model_tfidf.pkl`
4. Ghi theo cach atomic neu co the:
   - save vao file tam `.tmp`
   - validate file non-empty
   - rename thanh file `.pkl` chinh
5. Khong expose endpoint public de train model neu khong can.

### 2. API runtime

`book_rec_api/app.py` chi phuc vu inference:

1. Khi startup hoac request dau tien, load model tu `book_rec_api/artifacts/`.
2. Cache model trong memory, khong load lai moi request.
3. Include 2 router:
   - `book_rec_api.api.als_routes`
   - `book_rec_api.api.tfidf_routes`
4. Khi request den:
   - ALS route goi ALS model da load.
   - TF-IDF route goi TF-IDF model da load.
5. API runtime khong goi `fit()`, `train_from_transform_output()`, Spark training, SQL loader, hay scheduler job.

## API endpoints

### ALS

```http
GET /recommend/als/{user_id}?limit=10
```

Y nghia:

- Dung `book_rec_api/artifacts/model_als.pkl`.
- Goi y sach theo hanh vi cua `user_id`.
- `limit` optional, default `10`, nen gioi han toi da `50`.

Response:

```json
{
  "source": "als",
  "query": {
    "user_id": 123,
    "limit": 10
  },
  "items": [
    {
      "book_id": "456",
      "work_id": "456",
      "title": "Example Book",
      "author": "Example Author",
      "score": 4.82
    }
  ]
}
```

### TF-IDF

```http
GET /recommend/tfidf/{book_id}?limit=10
```

Y nghia:

- Dung `book_rec_api/artifacts/model_tfidf.pkl`.
- Goi y sach tuong tu voi `book_id` dang xem.
- `limit` optional, default `10`, nen gioi han toi da `50`.

Response:

```json
{
  "source": "tfidf",
  "query": {
    "book_id": "123",
    "limit": 10
  },
  "items": [
    {
      "book_id": "789",
      "work_id": "789",
      "title": "Similar Book",
      "author": "Another Author",
      "score": 0.91
    }
  ]
}
```

### Health

```http
GET /health
```

Response:

```json
{
  "status": "ok",
  "models": {
    "als": {
      "loaded": true,
      "path": "book_rec_api/artifacts/model_als.pkl"
    },
    "tfidf": {
      "loaded": true,
      "path": "book_rec_api/artifacts/model_tfidf.pkl"
    }
  }
}
```

## Skeleton `book_rec_api/app.py`

```python
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
    return {
        "status": "ok",
        "models": {
            "als": {"path": str(ALS_MODEL_PATH), "exists": ALS_MODEL_PATH.exists()},
            "tfidf": {"path": str(TFIDF_MODEL_PATH), "exists": TFIDF_MODEL_PATH.exists()},
        },
    }
```

## Skeleton `book_rec_api/api/als_routes.py`

```python
from fastapi import APIRouter, HTTPException, Query


router = APIRouter()


@router.get("/recommend/als/{user_id}")
def recommend_als(user_id: int, limit: int = Query(10, ge=1, le=50)):
    try:
        items = recommend_for_user(user_id=user_id, limit=limit)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return {
        "source": "als",
        "query": {"user_id": user_id, "limit": limit},
        "items": items,
    }
```

## Skeleton `book_rec_api/api/tfidf_routes.py`

```python
from fastapi import APIRouter, HTTPException, Query


router = APIRouter()


@router.get("/recommend/tfidf/{book_id}")
def recommend_tfidf(book_id: str, limit: int = Query(10, ge=1, le=50)):
    try:
        items = recommend_similar_books(book_id=book_id, limit=limit)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return {
        "source": "tfidf",
        "query": {"book_id": book_id, "limit": limit},
        "items": items,
    }
```

## Skeleton `book_rec_api/scheduler.py`

```python
from pathlib import Path

from src.model.als import train_als_from_transform_output
from src.model.tf_idf import train_from_transform_output


BASE_DIR = Path(__file__).resolve().parent
ARTIFACTS_DIR = BASE_DIR / "artifacts"
ALS_MODEL_PATH = ARTIFACTS_DIR / "model_als.pkl"
TFIDF_MODEL_PATH = ARTIFACTS_DIR / "model_tfidf.pkl"


def train_and_save_models() -> None:
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)

    als_model = train_als_from_transform_output()
    save_als_artifact(als_model, ALS_MODEL_PATH)

    tfidf_model = train_from_transform_output()
    tfidf_model.save(TFIDF_MODEL_PATH)
```

Skeleton tren chi mo ta flow. Khi implement can map dung return value hien tai cua `src/model/als.py`, vi ham train ALS co the tra tuple hoac Spark recommender thay vi object pickle-safe.

## Error contract

Tat ca loi API nen co shape nhat quan:

```json
{
  "error": {
    "code": "not_found",
    "message": "Unknown book_id: 123"
  }
}
```

Status code:

- `400`: query param sai, vi du `limit <= 0`.
- `404`: khong tim thay `user_id` hoac `book_id` trong artifact.
- `422`: FastAPI validate path/query param sai type.
- `503`: artifact thieu, rong, hong, hoac model load fail.
- `500`: loi runtime khong mong doi.

## Nguyen tac artifact

- `model_als.pkl` va `model_tfidf.pkl` phai ton tai truoc khi API serve production.
- File artifact phai non-empty va load duoc bang loader tuong ung.
- Scheduler duoc phep train/retrain; route API khong duoc train model.
- ALS artifact nen la object/table pickle-safe cho inference. Neu training dung Spark, khong nen pickle live `SparkSession`.
- TF-IDF artifact nen la fitted `ContentBasedRecommender` hoac wrapper co method `recommend(book_id, top_k=limit)`.

## Command de chay

Development API:

```bash
uvicorn book_rec_api.app:app --host 0.0.0.0 --port 8001 --reload
```

Manual refresh model:

```bash
python -m book_rec_api.scheduler
```

## Checklist implement

1. Tao `book_rec_api/api/als_routes.py`.
2. Tao `book_rec_api/api/tfidf_routes.py`.
3. Tao/cap nhat `book_rec_api/app.py` de include 2 router.
4. Tao `book_rec_api/artifacts/`.
5. Cap nhat `book_rec_api/scheduler.py` de train tu `src/model` va save artifact.
6. Them loader/cache rieng cho ALS va TF-IDF trong API runtime.
7. Them tests cho:
   - missing artifact tra `503`
   - unknown `user_id` tra `404`
   - unknown `book_id` tra `404`
   - ALS route tra `source=als`
   - TF-IDF route tra `source=tfidf`
