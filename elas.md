# Elasticsearch Contract

Elasticsearch trong project nay chi co mot vai tro:

- phuc vu tim kiem sach full-text nhanh theo `query`
- tra ve danh sach book object theo canonical schema
- khong dong vai tro recommendation, similar-item, hoac hybrid inference

## Public API

### `GET /recommend/es/search?q=keyword&limit=20`

- `q`: keyword tim kiem
- `limit`: chi gioi han so phan tu trong list, tu 1 den 50
- response: plain JSON array (`list[canonical_item]`), khong boc `items`, `total`, hoac envelope khac

## Rule

- Neu ES co ket qua, tra ket qua tu index.
- Neu ES khong tra ra data hoac gap loi, backend co the fallback sang local fuzzy search.
- Endpoint khong expose `similar` hoac `hybrid` cho ES.
- Truoc khi index, map `book_id -> work_id`, `original_title -> title/book_title`, va `total_ratings -> total_ratings_count/num_rating`.

## Runtime configuration

Elasticsearch 8 Docker mac dinh dung HTTPS va authentication. `python book_rec_api/run.py` tu nap file `.env` o project root; API can cac bien:

```bash
export ELASTICSEARCH_URL=https://127.0.0.1:9200
export ELASTICSEARCH_USERNAME=elastic
export ELASTICSEARCH_PASSWORD='<password>'
export ELASTICSEARCH_CA_CERTS=/path/to/http_ca.crt
export ELASTICSEARCH_INDEX=books
```

Chi cho local development co the thay CA path bang `ELASTICSEARCH_VERIFY_CERTS=false`.

Khong dung `http://localhost:9200` neu container log bao `plaintext http traffic on an https channel`.

Sau khi doi mapping/alias, bat buoc recreate va reindex:

```bash
python -m src.search.elasticsearch_search index --data-path data/books.csv --recreate
```

`GET /health` phai tra `available`, `index_exists`, `documents`; khi ket noi loi se co them `error`.
## Test Cases

- `GET /recommend/es/search?q=harry+potter&limit=3` should return a JSON array.
- `limit=1` should only reduce the array size, not change the response shape.
- `harry poster` should still return relevant search results when the index or fallback search can match it.
- Missing or blank `q` should be rejected with validation error.
- If Elasticsearch is down, the endpoint should fall back to local search and still return a list when local data is available.

