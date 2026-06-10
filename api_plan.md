# API Plan - Book Recommendation API

Tai lieu nay mo ta contract canonical cho 4 provider chinh:

- TF-IDF: goi y sach tuong tu theo noi dung.
- ALS: goi y sach theo user history.
- Hybrid: ket hop ALS va TF-IDF, uu tien ALS khi co user history va fallback sang TF-IDF khi can.
- Elasticsearch: chi phuc vu truy van tim kiem full-text nhanh (`query`), khong dong vai tro recommendation.

Muc tieu la cho ALS, TF-IDF, hybrid, va Elasticsearch tra ve cung mot format book object, de Frontend va Backend khong phai xu ly nhieu format khac nhau.

## Muc tieu

Runtime khong train model khi startup hoac khi nhan request. API chi load artifact da dong goi va tra ket qua inference.

## Canonical response

Moi book trong output cua cac endpoint recommendation chinh phai co dung format:

```json
{
  "book_id": null,
  "authors": null,
  "original_publication_year": null,
  "original_title": null,
  "language_code": null,
  "tags": [],
  "ratings_1": null,
  "ratings_2": null,
  "ratings_3": null,
  "ratings_4": null,
  "ratings_5": null,
  "image_url": null,
  "small_image_url": null,
  "price": null,
  "mood": "[]",
  "description": null,
  "longDescription": null,
  "pages": null,
  "readTime": null,
  "status": null,
  "chapters": null,
  "previewText": null,
  "accentColor": null,
  "total_ratings": null,
  "average_rating": null,
  "badges": []
}
```

Quy uoc:

- Endpoint tra mot danh sach book object theo schema tren khi co nhieu ket qua.
- Endpoint tra truc tiep mot book object theo schema tren khi chi co mot ket qua.
- Khong boc output trong `pageNumber`, `pageSize`, `totalCount`, hoac `items`.

## Endpoint chinh

### `GET /recommend/tfidf/{book_id}?limit=10`

- Input: `book_id` la UUID book hoac book id da chuan hoa.
- Output: danh sach book object theo canonical schema.
- Dung cho similar-book recommendation theo noi dung.

### `GET /recommend/als/{user_id}?limit=10`

- Input: `user_id` la UUID user hoac user id da chuan hoa.
- Output: danh sach book object theo canonical schema.
- Dung cho personalized recommendation theo user history.
- Neu user moi, tra fallback danh sach phu hop thay vi fail neu co du lieu fallback.

### `GET /recommend/hybrid/{user_id}?item_id={book_id}&query={text}&limit=10`

- Input: `user_id` la user can goi y; `item_id` va `query` la ngu canh fallback khi user khong co history ro rang.
- Output: danh sach book object theo canonical schema.
- Dung cho truong hop muon 1 API duy nhat, uu tien ALS neu co history, fallback sang TF-IDF neu khong.

### `GET /recommend/es/search?q=keyword&limit=20`

- Input: `q` la keyword, `limit` gioi han ket qua.
- Output: `list[book object]` theo canonical schema.
- `limit` chi gioi han so phan tu trong list, khong doi shape response.
- Elasticsearch chi duoc dung de tim kiem full-text nhanh theo query. Neu ES khong tra ra ket qua hoac gap loi, backend co the fallback sang local fuzzy search.

## Mapping field

Payload item canonical nen lay tu cac field co san trong data/model:

- `book_id`: id sach canonical.
- `authors`: tu `authors` hoac `author`.
- `original_title`: tu `original_title`, fallback `book_title` hoac `title`.
- `language_code`: ma ngon ngu.
- `tags`: array tag da split/clean.
- `ratings_1` -> `ratings_5`: breakdown so luong rating.
- `image_url` va `small_image_url`: anh bia.
- `price`: gia sach.
- `mood`: string hoac JSON-string, mac dinh "[]" neu khong co du lieu.
- `description` va `longDescription`: mo ta ngan/dai.
- `pages`, `readTime`, `chapters`: metadata doc sach.
- `status`, `previewText`, `accentColor`: metadata UI.
- `total_ratings`: alias cua `num_rating`.
- `average_rating`: alias cua `avg_star`.
- `badges`: danh sach badge.
- Search response can dong nhat voi schema canonical; neu ES khong co data thi backend fallback truoc khi tra response.

## Cac file can dong bo

Neu can sua implementation de khop contract, uu tien cac file sau:

- `book_rec_api/api/schema.py`: khai bao schema response chung (`canonical_item()`).
- `app/services/recommender.py`: normalize item data cho dung field names.
- `book_rec_api/api/tfidf_routes.py`: tra response TF-IDF theo canonical schema.
- `book_rec_api/api/als_routes.py`: tra response ALS theo canonical schema.
- `src/model/hybrid.py`: logic hybrid ALS + TF-IDF.
- `app/api/routes/web.py`: UI legacy cho hybrid_books, neu con giu.
- `book_rec_api/api/es_routes.py`: router public cho Elasticsearch search API.
- `src/search/elasticsearch_search.py`: engine search/index ES va fallback local.

## Tests

- Unit test backend search adapter with a mocked Elasticsearch client and verify query/limit handling.
- Unit test fallback path when ES request fails or returns empty, so search helper still returns data from fallback local source.
- Contract test for ES endpoint shape to confirm frontend can call it as a search API and receive a plain list of canonical items.
- Case 1: `GET /recommend/es/search?q=harry+potter&limit=3` returns a JSON array, not an envelope object.
- Case 2: `limit` only caps array length; `limit=1` still returns a list with at most one item.
- Case 3: typo query such as `harry poster` still returns the closest matching books when ES or fallback search can score them.
- Case 4: empty or whitespace-only query is rejected by request validation.
- Case 5: when ES is unavailable, endpoint still falls back to local search and returns a list if local data exists.
- Case 6: canonical CSV fields (`book_id`, `original_title`, `total_ratings`) must be mapped to ES search aliases before indexing.

## Acceptance criteria

- Ca TF-IDF, ALS, hybrid, va Elasticsearch tra ve cung 1 shape response.
- Moi item co du field nhu payload mau.
- `book_rec_api/api/es_routes.py`: router public cho Elasticsearch search API.
- `src/search/elasticsearch_search.py`: engine search/index ES va fallback local.
- FE co the goi Elasticsearch nhu mot search API thong qua backend endpoint, khong can biet ES la engine ben trong.
- `/health` bao `elasticsearch.available=true`, `index_exists=true`, va document count khi TLS/auth/index deu hop le; neu loi phai co field `error` de chan doan.
