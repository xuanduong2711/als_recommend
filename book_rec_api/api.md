# Hướng Dẫn Sử Dụng Book Recommendation API

## Tóm Tắt Đầu Vào & Đầu Ra

| API | Đầu vào | Đầu ra |
|-----|---------|--------|
| **ALS** `GET /recommend/als/{user_id}` | `user_id` (UUID) | JSON array — mỗi item theo canonical schema |
| **TF-IDF** `GET /recommend/tfidf/{book_id}` | `book_id` (UUID) | JSON array — mỗi item theo canonical schema |
| **Hybrid** `GET /recommend/hybrid/{user_id}` | `user_id` (UUID) + context | JSON array — ALS nếu có history, TF-IDF fallback |
| **ES Search** `GET /recommend/es/search` | `q` (keyword) | JSON array — mỗi item theo canonical schema, ES có thể fallback local fuzzy |

---

## Cách Chạy API (Local)

### 1. Tạo môi trường ảo & cài dependencies

```bash
cd book_rec_api
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 1b. Chạy trên Windows 11

```powershell
cd book_rec_api
py -3.12 -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python run.py
```

### 2. Chạy API server

```bash
source .venv/bin/activate
python run.py
```

Mặc định:
- **Base URL:** `http://127.0.0.1:8000`
- **Swagger UI:** `http://127.0.0.1:8000/docs`
- **OpenAPI JSON:** `http://127.0.0.1:8000/openapi.json`

Đổi host/port:
```bash
HOST=0.0.0.0 PORT=8001 python run.py
```

### 3. Kiểm tra API hoạt động

```bash
curl http://127.0.0.1:8000/health
```

---

## API Endpoints

### 📌 Health Check
```http
GET /health
```
Kiểm tra model ALS, TF-IDF và Elasticsearch đã sẵn sàng chưa. Elasticsearch ở đây chỉ đóng vai trò search engine.

### 📌 ALS Recommendation (gợi ý theo user)
```http
GET /recommend/als/{user_id}?limit=10
```
- `user_id`: UUID của user
- `limit`: 1-50, số lượng sách gợi ý
- User có lịch sử → `source: "als"`
- User mới → `source: "popular_fallback"`

### 📌 TF-IDF Recommendation (gợi ý theo sách)
```http
GET /recommend/tfidf/{book_id}?limit=10
```
- `book_id`: UUID của sách
- `limit`: 1-50
- Dùng nội dung sách để tìm sách tương tự

### 📌 Hybrid Recommendation (ALS + TF-IDF)
```http
GET /recommend/hybrid/{user_id}?item_id={book_id}&limit=10
```
- `user_id`: UUID của user
- `item_id`: UUID sách (context cho TF-IDF fallback)
- `limit`: 1-50
- ALS nếu user có history, fallback TF-IDF nếu không

### 📌 ES Search (tìm kiếm full-text)
```http
GET /recommend/es/search?q={keyword}&limit=10
```
- `q`: từ khóa tìm kiếm
- `limit`: 1-50
- Elasticsearch chỉ dùng cho search query nhanh
- Backend ưu tiên trả kết quả từ index Elasticsearch
- Nếu ES lỗi, hết kết quả, hoặc cấu hình chưa đúng, backend sẽ fallback về local fuzzy search trên file dữ liệu local

### Chi Tiết Elasticsearch

Elasticsearch trong `book_rec_api` là search engine, không phải recommendation engine. Endpoint public duy nhất là:

```http
GET /recommend/es/search?q={keyword}&limit=10
```

#### Hành Vi Trả Kết Quả

- Response luôn là JSON array, không bọc trong `items`, `totalCount`, hay envelope khác.
- Mỗi phần tử trong array phải theo canonical schema giống ALS/TF-IDF/Hybrid.
- `limit` chỉ giới hạn số phần tử tối đa trong array.
- Nếu `q` trống hoặc chỉ chứa khoảng trắng, API trả lỗi validate `422`.

#### Nguồn Dữ Liệu

- Elasticsearch index dùng dữ liệu sách đã transform.
- Khi index, hệ thống map các field canonical như `book_id`, `original_title`, `authors`, `total_ratings` sang field search nội bộ như `work_id`, `title`, `book_title`, `num_rating`.
- Nếu dữ liệu CSV có BOM ở header, loader vẫn tự đọc đúng bằng `utf-8-sig`.

#### Fallback

Luồng search hiện tại:

1. Gọi Elasticsearch trước.
2. Nếu ES có hit, trả luôn hit từ index.
3. Nếu ES không có hit hoặc có lỗi kết nối / TLS / auth, backend fallback sang fuzzy search local.
4. Nếu local cũng không trả được gì, endpoint trả `[]`.

#### Health Metadata

`GET /health` trả thêm metadata Elasticsearch:

- `available`: `true/false`
- `url`: URL ES đang được dùng
- `index`: tên index
- `index_exists`: index có tồn tại không
- `documents`: số document trong index
- `error`: thông tin lỗi nếu ping/kết nối/index fail

Ví dụ:

```json
{
  "status": "ok",
  "models": {
    "elasticsearch": {
      "available": true,
      "url": "https://127.0.0.1:9200",
      "index": "books",
      "index_exists": true,
      "documents": 10000
    }
  }
}
```

#### Cấu Hình Local

Elasticsearch 8 mặc định chạy HTTPS và cần auth. Với project này, cấu hình local nên dùng:

```bash
ELASTICSEARCH_URL=https://127.0.0.1:9200
ELASTICSEARCH_USERNAME=elastic
ELASTICSEARCH_PASSWORD=...
ELASTICSEARCH_CA_CERTS=/path/to/http_ca.crt
ELASTICSEARCH_INDEX=books
```

Nếu chỉ test local nhanh, có thể tắt verify certificate bằng:

```bash
ELASTICSEARCH_VERIFY_CERTS=false
```

Nếu log ES báo `plaintext http traffic on an https channel`, nghĩa là API đang trỏ nhầm sang `http://...` thay vì `https://...`.

#### Reindex

Sau khi đổi mapping hoặc dữ liệu nguồn, cần recreate và reindex:

```bash
python -m src.search.elasticsearch_search index --data-path data/books.csv --recreate
```

#### Ví Dụ Kết Quả

```bash
curl -s "http://127.0.0.1:8000/recommend/es/search?q=harry+poster&limit=10" | python3 -m json.tool
```

Kết quả có thể vẫn trả sách liên quan như `Harry Potter Collection`, `Harry Potter Boxed Set` hoặc các item tương tự, vì search ưu tiên match gần đúng và fallback fuzzy.

---

## Cách Gọi API (curl)

Tất cả API đều là **GET**, gọi bằng curl, browser, hoặc Swagger UI tại http://127.0.0.1:8000/docs

### Health Check
```bash
curl -s http://127.0.0.1:8000/health | python3 -m json.tool
```
```json
{
  "status": "ok",
  "models": {
    "als": { "exists": true, "loaded": true, "users": 2116, "items": 687 },
    "tfidf": { "exists": true, "loaded": true },
    "elasticsearch": {
      "available": true,
      "url": "https://127.0.0.1:9200",
      "index": "books",
      "index_exists": true,
      "documents": 10000
    }
  }
}
```

### ALS — gợi ý theo user
```bash
curl -s "http://127.0.0.1:8000/recommend/als/00000000-0000-0000-0000-00000000001d?limit=3" | python3 -m json.tool
```
```json
[
  {
    "book_id": "00000000-0000-0000-0000-000000000163",
    "authors": "Robert A. Heinlein",
    "original_publication_year": 1984,
    "original_title": "Job: A Comedy of Justice",
    "language_code": "eng",
    "tags": ["fantasy", "science-fiction"],
    "image_url": "https://images.gr-assets.com/books/1438043968m/355.jpg",
    "price": 150000.0,
    "average_rating": 3.77,
    "total_ratings": 14901
  }
]
```

### TF-IDF — gợi ý theo sách
```bash
curl -s "http://127.0.0.1:8000/recommend/tfidf/00000000-0000-0000-0000-000000000001?limit=2" | python3 -m json.tool
```
```json
[
  {
    "book_id": "00000000-0000-0000-0000-000000000005",
    "authors": "J.K. Rowling, Mary GrandPré, Rufus Beck",
    "original_publication_year": 1999,
    "original_title": "Harry Potter and the Prisoner of Azkaban",
    "language_code": "eng",
    "tags": ["fantasy", "young-adult", "harry-potter", "adventure"],
    "image_url": "https://images.gr-assets.com/books/1499277281m/5.jpg",
    "price": 180000,
    "average_rating": 4.53,
    "total_ratings": 1969375
  }
]
```

### Hybrid
```bash
curl -s "http://127.0.0.1:8000/recommend/hybrid/00000000-0000-0000-0000-00000000001d?item_id=00000000-0000-0000-0000-000000000001&limit=3" | python3 -m json.tool
```

### ES Search
```bash
curl -s "http://127.0.0.1:8000/recommend/es/search?q=harry+potter&limit=3" | python3 -m json.tool
```

---

## Item Fields

Mỗi item trong `items[]` có các field sau:

| Field | Ý nghĩa |
|-------|---------|
| `book_id` | UUID của sách |
| `authors` | Tác giả |
| `original_publication_year` | Năm xuất bản |
| `original_title` | Tên sách gốc |
| `language_code` | Mã ngôn ngữ |
| `tags` | Danh sách thể loại |
| `ratings_1..5` | Số lượng đánh giá từng mức sao |
| `image_url` | Ảnh bìa lớn |
| `small_image_url` | Ảnh bìa nhỏ |
| `price` | Giá |
| `mood` | Tâm trạng (JSON string) |
| `description` | Mô tả ngắn |
| `longDescription` | Mô tả chi tiết |
| `pages` | Số trang |
| `readTime` | Thời gian đọc |
| `status` | Trạng thái |
| `chapters` | Số chương |
| `previewText` | Đoạn trích |
| `accentColor` | Màu chủ đạo |
| `total_ratings` | Tổng lượt đánh giá |
| `average_rating` | Điểm trung bình |
| `badges` | Danh sách huy hiệu |

Tất cả model đều trả về cùng shape, không có field model-specific nào khác ngoài các field trên.

---

## Sử Dụng Model Trực Tiếp Bằng Python

Thay vì gọi HTTP API, bạn có thể load model và gọi trực tiếp trong code Python:

### TF-IDF

```python
from pathlib import Path
from book_rec_api.serving import TfidfServingModel

model = TfidfServingModel.load(Path("artifacts/model_tfidf.pkl"))
recs = model.recommend("00000000-0000-0000-0000-000000000001", top_k=5)
print(recs[["book_id", "book_title", "score"]])
```

### ALS

```python
from pathlib import Path
from book_rec_api.serving import ALSServingModel

model = ALSServingModel.load(Path("artifacts/model_als.pkl"))
recs = model.recommend_for_user("00000000-0000-0000-0000-00000000001d", num_items=5)
print(recs[["book_id", "book_title", "score"]])
```

### Giải thích

- `model.recommend(item_id, top_k, metric, exclude_self, min_score)` — TF-IDF: tìm sách tương tự theo nội dung
  - `item_id`: UUID sách gốc
  - `top_k`: số lượng kết quả (mặc định 10)
  - `metric`: `"cosine"` (mặc định)
  - `exclude_self`: `True` (loại sách gốc khỏi kết quả)
  - `min_score`: ngưỡng điểm tối thiểu (optional)

- `model.recommend_for_user(user_id, num_items, exclude_seen)` — ALS: gợi ý cá nhân hóa theo user
  - `user_id`: UUID user
  - `num_items`: số lượng gợi ý (mặc định 10)
  - `exclude_seen`: `True` (loại sách đã đọc)

---

## Cấu Hình Môi Trường

| Biến | Mặc định | Mô tả |
|------|----------|-------|
| `HOST` | `0.0.0.0` | Host bind |
| `PORT` | `8000` | Port listen |
| `ELASTICSEARCH_URL` | `http://localhost:9200` | Elasticsearch URL |
| `ELASTICSEARCH_INDEX` | `books` | Elasticsearch index name |
| `ELASTICSEARCH_USERNAME` | - | Username cho ES HTTPS |
| `ELASTICSEARCH_PASSWORD` | - | Password cho ES HTTPS |
| `ELASTICSEARCH_CA_CERTS` | - | Đường dẫn CA cert (`http_ca.crt`) |
| `ELASTICSEARCH_VERIFY_CERTS` | `true` | Bật/tắt verify TLS cert |

## Mã Lỗi

| Status | Ý nghĩa |
|--------|---------|
| `200` | Thành công |
| `404` | User/book không tìm thấy |
| `422` | UUID hoặc parameter không hợp lệ |
| `500` | Lỗi inference |
| `503` | Artifact thiếu/hỏng |

---

## File Cần Upload (Production)

```text
book_rec_api/
|-- api/
|   |-- __init__.py
|   |-- als_routes.py
|   |-- es_routes.py
|   |-- hybrid_routes.py
|   |-- schema.py
|   +-- tfidf_routes.py
|-- artifacts/
|   |-- model_als.pkl
|   +-- model_tfidf.pkl
|-- __init__.py
|-- app.py
|-- requirements.txt
|-- run.py
+-- serving.py
```

Không cần source data, database, Spark, scheduler hoặc code training trên máy production.

## Cài Đặt

Yêu cầu Python 3.12 64-bit.

### Linux/macOS

```bash
BOOK_REC_API_DIR=/absolute/path/to/book_rec_api
BOOK_REC_VENV="$BOOK_REC_API_DIR/.venv"

python3.12 -m venv "$BOOK_REC_VENV"
"$BOOK_REC_VENV/bin/python" -m pip install \
  -r "$BOOK_REC_API_DIR/requirements.txt"
```

### Windows PowerShell

```powershell
$BookRecApiDir = "C:\services\book_rec_api"
$BookRecVenv = "$BookRecApiDir\.venv"

py -3.12 -m venv $BookRecVenv
& "$BookRecVenv\Scripts\python.exe" -m pip install `
  -r "$BookRecApiDir\requirements.txt"
```

## Chạy API

### Linux/macOS

```bash
"$BOOK_REC_VENV/bin/python" "$BOOK_REC_API_DIR/run.py"
```

Đổi host hoặc port:

```bash
HOST=0.0.0.0 PORT=8001 \
  "$BOOK_REC_VENV/bin/python" "$BOOK_REC_API_DIR/run.py"
```

### Windows PowerShell

```powershell
$env:HOST = "0.0.0.0"
$env:PORT = "8000"
& "$BookRecVenv\Scripts\python.exe" "$BookRecApiDir\run.py"
```

Mặc định:

```text
Base URL: http://127.0.0.1:8000
Swagger:  http://127.0.0.1:8000/docs
OpenAPI:  http://127.0.0.1:8000/openapi.json
```

## Cập Nhật Model Trên Production

Model phải được train và validate ở môi trường khác. Production chỉ nhận artifact đã hoàn chỉnh.

Tên file luôn cố định:

```text
book_rec_api/artifacts/model_als.pkl
book_rec_api/artifacts/model_tfidf.pkl
```

Quy trình cập nhật:

1. Train model ở máy train hoặc staging.
2. Xuất file `model_als.pkl` và `model_tfidf.pkl` ra một thư mục staging.
3. Chạy CLI deploy để copy sang prod bằng atomic replace.
4. Không xóa model cũ trước khi model mới được validate.
5. Không để lại file tạm hoặc backup trong package production.

## Xử Lý Sự Cố

### `/health` trả `degraded`

Kiểm tra:
- Có đủ hai file `.pkl`.
- File không có kích thước `0`.
- Process có quyền đọc artifact.
- Artifact được tạo bởi phiên bản serving tương thích.

### API không nhận model mới

Kiểm tra:
- File mới đã replace đúng tên canonical.
- Artifact có mtime hoặc file size mới.
- Không upload nhầm sang thư mục khác.

## Checklist Deploy

- [ ] Chỉ có các file được liệt kê trong mục `File Cần Upload`
- [ ] Có `model_als.pkl` và `model_tfidf.pkl`
- [ ] Dependency đã được cài từ `requirements.txt`
- [ ] `/health` trả `status="ok"`
- [ ] Swagger mở được tại `/docs`
- [ ] ALS route trả recommendation
- [ ] TF-IDF route trả recommendation
- [ ] Hybrid route trả recommendation
- [ ] ES routes trả kết quả

---

## Giải Thích Chi Tiết Các File Trong `book_rec_api/api/`

Thư mục `api/` chứa 5 file route + `schema.py` (helper chuẩn hóa output).

### `schema.py` — Chuẩn hóa dữ liệu đầu ra

Định nghĩa hàm `canonical_item(row)` — là "khuôn mẫu" chung cho tất cả recommend routes. Hàm này nhận một row dữ liệu thô (dict) và trả ra dict với các field canonical như bảng ở trên. Cả 5 route đều dùng chung hàm này để đảm bảo output đồng nhất.

### `als_routes.py` — ALS Collaborative Filtering

| Route | `GET /recommend/als/{user_id}?limit=N` |
|-------|----------------------------------------|

**Luồng xử lý:**
1. Load model từ file `artifacts/model_als.pkl`
2. Gọi `model.recommend_for_user(user_id, num_items=limit)`
3. Vì ALS không lưu metadata, route load catalog từ `database_data/books.csv`
4. Lookup metadata cho từng book_id, pass vào `canonical_item`
5. Trả về paginated response

### `hybrid_routes.py` — Hybrid ALS + TF-IDF

| Route | `GET /recommend/hybrid/{user_id}?item_id={book_id}&limit=N` |
|-------|-------------------------------------------------------------|

**Luồng xử lý:**
1. Kiểm tra user có history trong ALS model không
2. Nếu có → trả ALS recommendations (giống `als_routes.py`)
3. Nếu không → fallback sang TF-IDF similar dựa trên `item_id`

### `tfidf_routes.py` — TF-IDF Content-Based

| Route | `GET /recommend/tfidf/{book_id}?limit=N` |
|-------|------------------------------------------|

**Luồng xử lý:**
1. Load model từ file `artifacts/model_tfidf.pkl`
2. Gọi `model.recommend(book_id, top_k=limit)` — cosine similarity
3. Kết quả đã có sẵn metadata, pass vào `canonical_item`
4. Trả về paginated response

### `es_routes.py` — Elasticsearch Search

| Route | Mô tả |
|-------|-------|
| `GET /recommend/es/search` | Full-text search qua ES, fallback local fuzzy |

**Luồng xử lý (search):**
1. Gọi `search_books_elasticsearch(q, limit)` từ `src.search.elasticsearch_search`
2. Nếu ES khả dụng → dùng ES query đa strategy (term, wildcard, multi_match, function_score)
3. Nếu ES không khả dụng → fallback về local fuzzy search (rapidfuzz)
4. Normalize kết quả qua `canonical_item`
5. Trả về plain JSON array

### Tổng quan kiến trúc

```
Client request
     │
     ├── /recommend/als/{user_id}      → als_routes.py     → model_als.pkl + books.csv → canonical_item → [...]
     ├── /recommend/tfidf/{book_id}    → tfidf_routes.py   → model_tfidf.pkl           → canonical_item → [...]
     ├── /recommend/hybrid/{uid}       → hybrid_routes.py  → ALS → TF-IDF              → canonical_item → [...]
     └── /recommend/es/search          → es_routes.py      → ES / local fuzzy          → canonical_item → [...]
```

---

## Elasticsearch Production Setup

Elasticsearch trong project này **chỉ dùng cho tìm kiếm full-text** (`/recommend/es/search`), không tham gia recommendation, similar-item hay hybrid inference.

### 1. Chạy Elasticsearch bằng Docker

Container ES 8.x bật security mặc định (HTTPS + basic auth), cần mount volume để dữ liệu persistent:

```bash
docker network create es-net

docker run -d \
  --name elasticsearch \
  --net es-net \
  -p 9200:9200 \
  -e "discovery.type=single-node" \
  -e "xpack.security.enabled=true" \
  -e "xpack.security.http.ssl.enabled=true" \
  -e "xpack.security.transport.ssl.enabled=true" \
  -e "ELASTIC_PASSWORD=your_admin_password" \
  -v es-data:/usr/share/elasticsearch/data \
  docker.elastic.co/elasticsearch/elasticsearch:8.11.0
```

Sau khi container start, copy SSL certificate fingerprint để verify từ client:

```bash
docker exec elasticsearch bin/elasticsearch-certutil http
# Hoặc lấy fingerprint trực tiếp:
openssl s_client -connect localhost:9200 -servername localhost < /dev/null 2>/dev/null | openssl x509 -fingerprint -noout -in /dev/stdin
```

### 2. Lấy Elasticsearch password

```bash
docker exec elasticsearch bin/elasticsearch-reset-password -u elastic -b -s
```

Output là password dạng `dI89QYafjl56tncLPw8z`. Ghi lại để export vào biến môi trường.

### 3. Cấu hình biến môi trường

Bắt buộc export trước khi chạy API:

```bash
export ELASTICSEARCH_URL="https://localhost:9200"
export ELASTICSEARCH_USERNAME="elastic"
export ELASTICSEARCH_PASSWORD="dI89QYafjl56tncLPw8z"
export ELASTICSEARCH_VERIFY_CERTS="false"    # true nếu có CA thật
export ELASTICSEARCH_INDEX="books"
```

| Biến | Bắt buộc | Mặc định | Mô tả |
|------|----------|----------|-------|
| `ELASTICSEARCH_URL` | Có | `http://localhost:9200` | URL Elasticsearch (http/https) |
| `ELASTICSEARCH_USERNAME` | ES 8.x | `elastic` | Username basic auth |
| `ELASTICSEARCH_PASSWORD` | ES 8.x | (empty) | Password basic auth |
| `ELASTICSEARCH_VERIFY_CERTS` | ES 8.x HTTPS | `true` | `false` nếu dùng self-signed cert |
| `ELASTICSEARCH_INDEX` | Không | `books` | Tên index chứa sách |

> **Ghi chú ES 8.x:** Security được bật mặc định, bắt buộc username/password + HTTPS. Nếu dùng self-signed cert (mặc định), set `ELASTICSEARCH_VERIFY_CERTS=false`.

### 4. Tạo index và index dữ liệu

Script `scripts/setup_es.sh` tự động:
1. Kết nối ES với credentials từ môi trường
2. Tạo index `books` với mappings chuẩn (title, author, tags, genre, rating, …)
3. Đọc `database_data/books.csv` (10,000 đầu sách) và bulk index lên ES
4. In ra các biến môi trường cần export

```bash
bash scripts/setup_es.sh
```

Ép recreate index (xóa cũ + tạo mới + index lại toàn bộ):

```bash
ELASTICSEARCH_INDEX=books bash scripts/setup_es.sh
```

Để index từ code Python trực tiếp:

```python
from src.search.elasticsearch_search import (
    create_client, create_books_index, index_transformed_books,
)

client = create_client()
create_books_index(client, recreate=True)
count = index_transformed_books(client, data_path="database_data/books.csv")
print(f"Indexed {count} books")
```

### 5. Mappings & search behavior

Index `books` dùng mappings với các field chính:
- `title`, `book_title`: text — phân tích bằng lowercase + asciifolding, hỗ trợ prefix search
- `authors`, `author`: text — tương tự
- `tags`, `genre`: text — keyword + text
- `average_rating`, `avg_star`: float — dùng trong function_score boost
- `total_ratings_count`, `num_rating`: integer — log1p boost

Search strategy (`_build_book_query` trong `elasticsearch_search.py`):

| Strategy | Weight | Mô tả |
|----------|--------|-------|
| `term` (keyword) | 18 | Match chính xác title |
| `term` (author keyword) | 9 | Match chính xác author |
| `wildcard` (keyword) | 7 | Match chứa từ khóa |
| `multi_match phrase` | 4 | Phrase matching với slop=1 |
| `multi_match prefix` | 2 | Prefix matching |
| `multi_match operator=and` | 1.5 | All terms phải xuất hiện |
| `multi_match fuzziness=AUTO` | 1 | Fuzzy search (chịu lỗi chính tả) |
| `function_score` | — | Boost theo rating (field_value_factor) |

Fuzzy search dùng `fuzziness: AUTO` — ES tự động tính edit distance dựa trên độ dài query.

### 6. Fallback behavior

Nếu ES không khả dụng (connection error) hoặc trả về kết quả rỗng, backend tự động fallback:

1. **ES primary** → `search_books_elasticsearch()` với `fallback_to_local=True`
2. **Local fuzzy 1** → rapidfuzz trên `database_data/books.csv` (trong `search_books_elasticsearch`)
3. **Local fuzzy 2** → `fuzzy_search_books()` trên `database_data/books.csv` (trong route `es_routes.py`)

Cả hai fallback đều dùng rapidfuzz với:
- `WRatio`, `token_set_ratio`, `token_sort_ratio` cho title/author/tag
- Adaptive cutoff: 62 (1 token), 58 (2 tokens), 55 (3+ tokens)
- Rerank: rating (75%) + popularity (25%) boost

**Quan trọng:** File `database_data/books.csv` phải tồn tại trên production để fallback hoạt động. Nếu không có file này, ES search sẽ trả về `[]` khi ES down.

### 7. Kiểm tra ES hoạt động

```bash
# Health check (qua API)
curl http://127.0.0.1:8000/health
# → {"status":"ok","models":{"elasticsearch":{"available":true}}}

# Search thử
curl -s "http://127.0.0.1:8000/recommend/es/search?q=harry+potter&limit=3"
# → [{"book_id": "...", "original_title": "Harry Potter and the ..."}, ...]

# Kiểm tra ES trực tiếp
curl -k -u elastic:$ES_PASS "https://localhost:9200/books/_count"
# → {"count": 10000, ...}

# Search trực tiếp ES
curl -k -u elastic:$ES_PASS \
  "https://localhost:9200/books/_search?q=harry&pretty&size=2"
```

### 8. Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `/health` trả `elasticsearch.available: false` | ES down hoặc sai credentials | Kiểm tra container, export lại env |
| `ConnectionError: ... certificate verify failed` | Self-signed cert với `verify_certs=true` | Set `ELASTICSEARCH_VERIFY_CERTS=false` |
| `AuthorizationException: ... missing authentication` | Thiếu username/password | Export `ELASTICSEARCH_USERNAME` + `ELASTICSEARCH_PASSWORD` |
| `NotFoundError: index not found [books]` | Chưa chạy setup_es.sh | Chạy `bash scripts/setup_es.sh` |
| ES search trả về `[]` nhưng có data | Query không match index mapping | Kiểm tra index mappings có field `title` không |
| `TypeError: __init__() got unexpected keyword argument 'basic_auth'` | ES client version 9.x | Pin `elasticsearch>=8,<9` trong requirements.txt |

### 9. Production checklist

- [ ] ES container có volume persistent (`-v es-data:/usr/share/elasticsearch/data`)
- [ ] ES password được lưu trong secret manager (không hardcode)
- [ ] `ELASTICSEARCH_VERIFY_CERTS=true` nếu dùng CA chính thống
- [ ] `database_data/books.csv` được deploy cùng API (fallback khi ES down)
- [ ] Resource limits cho ES container (heap size, memory lock)
- [ ] Monitoring: ES health, index size, search latency
- [ ] Backup snapshot: `PUT _snapshot` định kỳ

### 10. Khởi động lại từ đầu (reset toàn bộ)

```bash
# Xóa container + volume cũ
docker rm -f elasticsearch
docker volume rm es-data

# Tạo container mới
docker run -d \
  --name elasticsearch \
  -p 9200:9200 \
  -e "discovery.type=single-node" \
  -e "ELASTIC_PASSWORD=myprodpass" \
  -v es-data:/usr/share/elasticsearch/data \
  docker.elastic.co/elasticsearch/elasticsearch:8.11.0

# Lấy password
ELASTICSEARCH_PASSWORD=$(docker exec elasticsearch bin/elasticsearch-reset-password -u elastic -b -s)

# Index dữ liệu
ELASTICSEARCH_PASSWORD=$ELASTICSEARCH_PASSWORD bash scripts/setup_es.sh
```
