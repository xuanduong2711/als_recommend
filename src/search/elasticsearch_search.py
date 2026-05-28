"""Elasticsearch indexing and search for the transformed book dataset.

This module is intentionally independent from the Flask routes. It can be used
directly from Python or via:

    python -m src.search.elasticsearch_search index
    python -m src.search.elasticsearch_search search "harry potter"
"""

from __future__ import annotations

import argparse
import json
import os
import re
import unicodedata
from collections.abc import Iterable, Iterator, Mapping, Sequence
from difflib import SequenceMatcher
from functools import lru_cache
from pathlib import Path
from typing import Any

import pandas as pd
from elasticsearch import Elasticsearch, helpers

try:
    from rapidfuzz import fuzz
except ModuleNotFoundError:

    class _FallbackFuzz:
        @staticmethod
        def WRatio(query: str, text: str) -> float:
            return SequenceMatcher(None, query, text).ratio() * 100

        @staticmethod
        def ratio(query: str, text: str) -> float:
            return SequenceMatcher(None, query, text).ratio() * 100

        @staticmethod
        def token_set_ratio(query: str, text: str) -> float:
            query_tokens = set(query.split())
            text_tokens = set(text.split())
            if not query_tokens or not text_tokens:
                return 0.0
            overlap = len(query_tokens & text_tokens)
            return 100 * overlap / max(len(query_tokens), len(text_tokens))

        @staticmethod
        def token_sort_ratio(query: str, text: str) -> float:
            query_text = " ".join(sorted(query.split()))
            text_text = " ".join(sorted(text.split()))
            return SequenceMatcher(None, query_text, text_text).ratio() * 100

    fuzz = _FallbackFuzz()


TRANSFORMED_BOOKS_PATH = "data/book_features_dataset"
DEFAULT_ELASTICSEARCH_URL = "http://localhost:9200"
DEFAULT_INDEX_NAME = "books"
DEFAULT_SEARCH_LIMIT = 20
MAX_SEARCH_LIMIT = 50
BOOK_FIELDS = (
    "work_id",
    "book_id",
    "title",
    "book_title",
    "authors",
    "author",
    "year",
    "average_rating",
    "avg_star",
    "total_ratings_count",
    "num_rating",
    "image_url",
    "image_path",
    "tags",
    "genre",
)
SEARCH_COLUMNS = (
    "title",
    "book_title",
    "authors",
    "author",
    "tags",
    "genre",
    "tag_name",
    "year",
    "work_id",
    "book_id",
)
TITLE_COLUMNS = ("book_title", "title")
AUTHOR_COLUMNS = ("author", "authors")
TAG_COLUMNS = ("genre", "tags", "tag_name")
ID_COLUMNS = ("work_id", "book_id")
SPACE_RE = re.compile(r"\s+")
PUNCT_RE = re.compile(r"[^\w\s]", flags=re.UNICODE)

BOOK_INDEX_SETTINGS = {
    "analysis": {
        "filter": {
            "book_edge_ngram_filter": {
                "type": "edge_ngram",
                "min_gram": 2,
                "max_gram": 20,
            }
        },
        "analyzer": {
            "book_text_analyzer": {
                "type": "custom",
                "tokenizer": "standard",
                "filter": ["lowercase", "asciifolding"],
            },
            "book_prefix_analyzer": {
                "type": "custom",
                "tokenizer": "standard",
                "filter": ["lowercase", "asciifolding", "book_edge_ngram_filter"],
            },
            "book_prefix_search_analyzer": {
                "type": "custom",
                "tokenizer": "standard",
                "filter": ["lowercase", "asciifolding"],
            },
        },
        "normalizer": {
            "book_keyword_normalizer": {
                "type": "custom",
                "filter": ["lowercase", "asciifolding"],
            }
        },
    }
}

BOOK_INDEX_MAPPINGS = {
    "properties": {
        "work_id": {"type": "keyword"},
        "book_id": {"type": "keyword"},
        "title": {
            "type": "text",
            "analyzer": "book_text_analyzer",
            "fields": {
                "keyword": {
                    "type": "keyword",
                    "ignore_above": 256,
                    "normalizer": "book_keyword_normalizer",
                },
                "prefix": {
                    "type": "text",
                    "analyzer": "book_prefix_analyzer",
                    "search_analyzer": "book_prefix_search_analyzer",
                },
            },
        },
        "book_title": {
            "type": "text",
            "analyzer": "book_text_analyzer",
            "fields": {
                "keyword": {
                    "type": "keyword",
                    "ignore_above": 256,
                    "normalizer": "book_keyword_normalizer",
                },
                "prefix": {
                    "type": "text",
                    "analyzer": "book_prefix_analyzer",
                    "search_analyzer": "book_prefix_search_analyzer",
                },
            },
        },
        "authors": {
            "type": "text",
            "analyzer": "book_text_analyzer",
            "fields": {
                "keyword": {
                    "type": "keyword",
                    "ignore_above": 256,
                    "normalizer": "book_keyword_normalizer",
                },
                "prefix": {
                    "type": "text",
                    "analyzer": "book_prefix_analyzer",
                    "search_analyzer": "book_prefix_search_analyzer",
                },
            },
        },
        "author": {
            "type": "text",
            "analyzer": "book_text_analyzer",
            "fields": {
                "keyword": {
                    "type": "keyword",
                    "ignore_above": 256,
                    "normalizer": "book_keyword_normalizer",
                },
                "prefix": {
                    "type": "text",
                    "analyzer": "book_prefix_analyzer",
                    "search_analyzer": "book_prefix_search_analyzer",
                },
            },
        },
        "year": {"type": "integer"},
        "average_rating": {"type": "float"},
        "avg_star": {"type": "float"},
        "total_ratings_count": {"type": "integer"},
        "num_rating": {"type": "integer"},
        "image_url": {"type": "keyword", "index": False},
        "image_path": {"type": "keyword", "index": False},
        "tags": {
            "type": "text",
            "analyzer": "book_text_analyzer",
            "fields": {
                "keyword": {
                    "type": "keyword",
                    "ignore_above": 512,
                    "normalizer": "book_keyword_normalizer",
                }
            },
        },
        "genre": {
            "type": "text",
            "analyzer": "book_text_analyzer",
            "fields": {
                "keyword": {
                    "type": "keyword",
                    "ignore_above": 512,
                    "normalizer": "book_keyword_normalizer",
                }
            },
        },
    }
}


def load_transformed_books(path: str | Path = TRANSFORMED_BOOKS_PATH) -> pd.DataFrame:
    """Load and normalize the transformed book feature dataset."""
    return _normalize_books_dataframe(_load_transformed_books_cached(str(path)))


def clear_transformed_books_cache() -> None:
    """Clear cached transformed data after regenerating the dataset."""
    _load_transformed_books_cached.cache_clear()


@lru_cache(maxsize=4)
def _load_transformed_books_cached(path: str) -> pd.DataFrame:
    data_path = Path(path)
    if not data_path.exists():
        raise FileNotFoundError(f"Transformed book data not found: {data_path}")

    if data_path.is_file():
        return _read_data_file(data_path)

    parquet_files = sorted(data_path.glob("*.parquet"))
    if parquet_files:
        return pd.read_parquet(data_path)

    csv_files = sorted(
        file_path
        for file_path in data_path.glob("*.csv")
        if not file_path.name.startswith(".")
    )
    if csv_files:
        frames = [pd.read_csv(file_path, on_bad_lines="skip") for file_path in csv_files]
        return pd.concat(frames, ignore_index=True)

    raise FileNotFoundError(f"No CSV or parquet files found in {data_path}")


def normalize_book_record(record: Mapping[str, Any]) -> dict[str, Any]:
    """Return a record with aliases expected by the current app templates."""
    result = {
        key: None if _clean_value(value) is None else value
        for key, value in dict(record).items()
    }

    if "book_id" not in result and "work_id" in result:
        result["book_id"] = result.get("work_id")
    if "book_title" not in result and "title" in result:
        result["book_title"] = result.get("title")
    if "author" not in result and "authors" in result:
        result["author"] = result.get("authors")
    if "image_path" not in result and "image_url" in result:
        result["image_path"] = result.get("image_url")
    if "avg_star" not in result and "average_rating" in result:
        result["avg_star"] = _to_float(result.get("average_rating"))
    if "num_rating" not in result and "total_ratings_count" in result:
        result["num_rating"] = _to_int(result.get("total_ratings_count"))
    if "genre" not in result and "tags" in result:
        result["genre"] = _format_tags(result.get("tags"))

    result.setdefault("price", None)
    return result


def create_client(
    url: str | None = None,
    *,
    api_key: str | None = None,
    username: str | None = None,
    password: str | None = None,
    request_timeout: int = 30,
    verify_certs: bool | None = None,
) -> Elasticsearch:
    """Create an Elasticsearch client from arguments or environment values."""
    url = url or os.environ.get("ELASTICSEARCH_URL", DEFAULT_ELASTICSEARCH_URL)
    api_key = api_key or os.environ.get("ELASTICSEARCH_API_KEY")
    username = username or os.environ.get("ELASTICSEARCH_USERNAME")
    password = password or os.environ.get("ELASTICSEARCH_PASSWORD")
    verify_certs = _env_bool("ELASTICSEARCH_VERIFY_CERTS", True) if verify_certs is None else verify_certs

    client_options: dict[str, Any] = {
        "request_timeout": request_timeout,
        "verify_certs": verify_certs,
    }
    if api_key:
        client_options["api_key"] = api_key
    elif username and password:
        client_options["basic_auth"] = (username, password)

    return Elasticsearch(url, **client_options)


def create_books_index(
    client: Elasticsearch,
    index_name: str | None = None,
    *,
    recreate: bool = False,
) -> bool:
    """Create the books index.

    Returns True when an index is created and False when it already exists.
    """
    index_name = index_name or os.environ.get("ELASTICSEARCH_INDEX", DEFAULT_INDEX_NAME)
    exists = bool(client.indices.exists(index=index_name))

    if exists and recreate:
        client.indices.delete(index=index_name)
        exists = False

    if exists:
        return False

    client.indices.create(
        index=index_name,
        settings=BOOK_INDEX_SETTINGS,
        mappings=BOOK_INDEX_MAPPINGS,
    )
    return True


def index_transformed_books(
    client: Elasticsearch | None = None,
    *,
    index_name: str | None = None,
    data_path: str = TRANSFORMED_BOOKS_PATH,
    recreate: bool = False,
    refresh: bool = True,
    chunk_size: int = 500,
) -> int:
    """Index books from the transformed dataset and return indexed count."""
    client = client or create_client()
    index_name = index_name or os.environ.get("ELASTICSEARCH_INDEX", DEFAULT_INDEX_NAME)

    create_books_index(client, index_name=index_name, recreate=recreate)

    indexed_count, _ = helpers.bulk(
        client,
        _iter_bulk_actions(data_path=data_path, index_name=index_name),
        chunk_size=chunk_size,
    )
    if refresh:
        client.indices.refresh(index=index_name)
    return int(indexed_count)


def search_books_elasticsearch(
    query: str,
    client: Elasticsearch | None = None,
    *,
    index_name: str | None = None,
    limit: int = 20,
    include_score: bool = False,
    data_path: str | Path = TRANSFORMED_BOOKS_PATH,
    fallback_to_local: bool = True,
    fallback_books: Any | None = None,
) -> list[dict[str, Any]]:
    """Search indexed books and return records normalized for the app templates."""
    query = str(query).strip()
    limit = _normalize_limit(limit)
    if not query or limit <= 0:
        return []

    elasticsearch_error: Exception | None = None
    try:
        client = client or create_client()
        index_name = index_name or os.environ.get("ELASTICSEARCH_INDEX", DEFAULT_INDEX_NAME)

        response = client.search(
            index=index_name,
            size=limit,
            query=_build_book_query(query),
        )

        results = _records_from_elasticsearch_response(response, include_score=include_score)
        if results or not fallback_to_local:
            return results
    except Exception as exc:
        elasticsearch_error = exc
        if not fallback_to_local:
            raise

    try:
        if fallback_books is not None:
            return fuzzy_search_books(
                fallback_books,
                query=query,
                limit=limit,
                include_score=include_score,
                normalize_output=True,
            )
        return search_transformed_books(
            query=query,
            data_path=data_path,
            limit=limit,
            include_score=include_score,
        )
    except Exception:
        if elasticsearch_error is not None:
            raise elasticsearch_error
        return []


def search_transformed_books(
    query: str,
    data_path: str | Path = TRANSFORMED_BOOKS_PATH,
    limit: int = 20,
    score_cutoff: int = 55,
    include_score: bool = False,
) -> list[dict[str, Any]]:
    """Search books from the transformed feature dataset without Elasticsearch."""
    books = load_transformed_books(data_path)
    return fuzzy_search_books(
        books,
        query=query,
        limit=limit,
        score_cutoff=score_cutoff,
        include_score=include_score,
        normalize_output=True,
    )


def fuzzy_search_books(
    books: Any,
    query: str,
    limit: int = 20,
    score_cutoff: int = 55,
    search_columns: Sequence[str] | None = None,
    include_score: bool = False,
    normalize_output: bool = True,
) -> list[dict[str, Any]]:
    """Return book records whose title, author, tag, or ID matches ``query``."""
    normalized_query = normalize_text(query)
    limit = _normalize_limit(limit)
    if not normalized_query or limit <= 0:
        return []

    columns = tuple(search_columns or SEARCH_COLUMNS)
    adaptive_cutoff = _adaptive_score_cutoff(normalized_query, score_cutoff)
    scored_books: list[tuple[float, int, dict[str, Any]]] = []

    for position, record in enumerate(_iter_records(books)):
        score = _score_record(record, normalized_query, columns)
        if score < adaptive_cutoff:
            continue

        result = normalize_book_record(record) if normalize_output else dict(record)
        if include_score:
            result["match_score"] = round(score, 2)
        scored_books.append((score, position, result))

    scored_books.sort(key=lambda item: (-item[0], item[1]))
    return [record for _, _, record in scored_books[:limit]]


def normalize_text(value: Any) -> str:
    """Normalize text for case-insensitive and accent-insensitive matching."""
    if _clean_value(value) is None:
        return ""

    text = unicodedata.normalize("NFKD", str(value))
    text = "".join(char for char in text if not unicodedata.combining(char))
    text = text.casefold().replace("|", " ").replace("_", " ")
    text = PUNCT_RE.sub(" ", text)
    return SPACE_RE.sub(" ", text).strip()


def _records_from_elasticsearch_response(
    response: Mapping[str, Any],
    *,
    include_score: bool,
) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    for hit in response.get("hits", {}).get("hits", []):
        record = normalize_book_record(hit.get("_source", {}))
        if include_score:
            record["match_score"] = hit.get("_score")
        results.append(record)
    return results


def _iter_records(books: Any) -> Iterable[Mapping[str, Any]]:
    if books is None:
        return

    if hasattr(books, "to_dict"):
        yield from books.to_dict("records")
        return

    if isinstance(books, Mapping):
        yield books
        return

    yield from books


def _score_record(
    record: Mapping[str, Any],
    normalized_query: str,
    search_columns: Sequence[str],
) -> float:
    field_values = {
        column: normalize_text(record.get(column))
        for column in search_columns
        if column in record
        and _clean_value(record.get(column)) is not None
        and str(record.get(column)).strip() != ""
    }

    if not field_values:
        return 0.0

    title_score = _best_column_score(field_values, TITLE_COLUMNS, normalized_query)
    author_score = _best_column_score(field_values, AUTHOR_COLUMNS, normalized_query) * 0.92
    tag_score = _best_column_score(field_values, TAG_COLUMNS, normalized_query) * 0.78
    id_score = _best_column_score(field_values, ID_COLUMNS, normalized_query) * 0.70

    combined_text = " ".join(field_values.values())
    if _is_weak_multi_token_match(normalized_query, combined_text):
        combined_score = 0.0
    else:
        combined_score = max(
            fuzz.token_set_ratio(normalized_query, combined_text),
            fuzz.token_sort_ratio(normalized_query, combined_text),
        ) * 0.86

    lexical_score = max(title_score, author_score, tag_score, id_score, combined_score)
    if lexical_score <= 0:
        return 0.0

    rerank_prior = _record_rerank_prior(record)
    return min(100.0, lexical_score * 0.9 + rerank_prior * 0.1)


def _best_column_score(
    values: Mapping[str, str],
    columns: Sequence[str],
    normalized_query: str,
) -> float:
    scores = []
    for column, value in values.items():
        if column not in columns or not value:
            continue
        token_score = max(
            fuzz.token_set_ratio(normalized_query, value),
            fuzz.token_sort_ratio(normalized_query, value),
        )
        if column in TAG_COLUMNS:
            score = token_score
        elif _is_weak_multi_token_match(normalized_query, value):
            score = 0.0
        else:
            score = max(fuzz.WRatio(normalized_query, value), token_score)
        if value.startswith(normalized_query):
            score = max(score, 98.0)
        elif normalized_query in value:
            score = max(score, 92.0)
        scores.append(score)
    return max(scores, default=0.0)


def _is_weak_multi_token_match(normalized_query: str, value: str) -> bool:
    query_tokens = normalized_query.split()
    value_tokens = value.split()
    if len(query_tokens) < 2 or not value_tokens:
        return False

    for query_token in query_tokens:
        best_token_score = max(
            fuzz.ratio(query_token, value_token)
            for value_token in value_tokens
        )
        if best_token_score < 70:
            return True
    return False


def _adaptive_score_cutoff(normalized_query: str, base_cutoff: int) -> float:
    token_count = len(normalized_query.split())
    if token_count <= 1:
        return max(float(base_cutoff), 62.0)
    if token_count == 2:
        return max(float(base_cutoff), 58.0)
    return float(base_cutoff)


def _record_rerank_prior(record: Mapping[str, Any]) -> float:
    avg_star = _to_float(record.get("avg_star"))
    if avg_star is None:
        avg_star = _to_float(record.get("average_rating"))

    num_rating = _to_float(record.get("num_rating"))
    if num_rating is None:
        num_rating = _to_float(record.get("total_ratings_count"))

    rating_signal = 0.0
    if avg_star is not None:
        rating_signal = min(max(avg_star / 5.0, 0.0), 1.0)

    popularity_signal = 0.0
    if num_rating is not None and num_rating > 0:
        popularity_signal = min(1.0, (num_rating ** 0.5) / 50.0)

    return (rating_signal * 75.0) + (popularity_signal * 25.0)


def _iter_bulk_actions(data_path: str, index_name: str) -> Iterator[dict[str, Any]]:
    for record in _iter_book_records(data_path):
        work_id = record.get("work_id")
        action = {
            "_op_type": "index",
            "_index": index_name,
            "_source": record,
        }
        if work_id is not None:
            action["_id"] = str(work_id)
        yield action


def _iter_book_records(data_path: str) -> Iterable[dict[str, Any]]:
    books = load_transformed_books(data_path)
    books = books.astype(object).where(pd.notnull(books), None)

    for raw_record in books.to_dict("records"):
        record = _clean_book_record(raw_record)
        if record.get("work_id") is not None:
            yield record


def _clean_book_record(record: Mapping[str, Any]) -> dict[str, Any]:
    cleaned = {field: _clean_value(record.get(field)) for field in BOOK_FIELDS}
    cleaned["work_id"] = _clean_text(cleaned.get("work_id"))
    cleaned["book_id"] = _clean_text(cleaned.get("book_id"))
    cleaned["title"] = _clean_text(cleaned.get("title"))
    cleaned["book_title"] = _clean_text(cleaned.get("book_title"))
    cleaned["authors"] = _clean_text(cleaned.get("authors"))
    cleaned["author"] = _clean_text(cleaned.get("author"))
    cleaned["tags"] = _clean_text(cleaned.get("tags"))
    cleaned["genre"] = _clean_text(cleaned.get("genre"))
    cleaned["image_url"] = _clean_text(cleaned.get("image_url"))
    cleaned["image_path"] = _clean_text(cleaned.get("image_path"))
    cleaned["year"] = _to_int(cleaned.get("year"))
    cleaned["average_rating"] = _to_float(cleaned.get("average_rating"))
    cleaned["avg_star"] = _to_float(cleaned.get("avg_star"))
    cleaned["total_ratings_count"] = _to_int(cleaned.get("total_ratings_count"))
    cleaned["num_rating"] = _to_int(cleaned.get("num_rating"))
    return {key: value for key, value in cleaned.items() if value is not None}


def _build_book_query(query: str) -> dict[str, Any]:
    normalized_query = query.strip()
    keyword_query = normalized_query.lower()
    should_clauses: list[dict[str, Any]] = [
        {"term": {"title.keyword": {"value": keyword_query, "boost": 18}}},
        {"term": {"book_title.keyword": {"value": keyword_query, "boost": 18}}},
        {"term": {"authors.keyword": {"value": keyword_query, "boost": 9}}},
        {"term": {"author.keyword": {"value": keyword_query, "boost": 9}}},
        {"wildcard": {"title.keyword": {"value": f"*{keyword_query}*", "boost": 7}}},
        {"wildcard": {"book_title.keyword": {"value": f"*{keyword_query}*", "boost": 7}}},
        {"wildcard": {"authors.keyword": {"value": f"*{keyword_query}*", "boost": 3}}},
        {"wildcard": {"author.keyword": {"value": f"*{keyword_query}*", "boost": 3}}},
        {
            "multi_match": {
                "query": normalized_query,
                "fields": ["title^12", "book_title^12", "authors^5", "author^5"],
                "type": "phrase",
                "slop": 1,
                "boost": 4,
            }
        },
        {
            "multi_match": {
                "query": normalized_query,
                "fields": [
                    "title.prefix^8",
                    "book_title.prefix^8",
                    "authors.prefix^3",
                    "author.prefix^3",
                ],
                "type": "best_fields",
                "boost": 2,
            }
        },
        {
            "multi_match": {
                "query": normalized_query,
                "fields": ["title^6", "book_title^6", "authors^3", "author^3", "tags", "genre"],
                "type": "best_fields",
                "operator": "and",
                "boost": 1.5,
            }
        },
        {
            "multi_match": {
                "query": normalized_query,
                "fields": ["title^3", "book_title^3", "authors^1.5", "author^1.5", "tags", "genre"],
                "type": "best_fields",
                "fuzziness": "AUTO",
                "prefix_length": 1,
                "max_expansions": 25,
            }
        },
    ]
    if normalized_query.isdigit():
        should_clauses.insert(0, {"term": {"work_id": {"value": normalized_query, "boost": 30}}})
        should_clauses.insert(1, {"term": {"book_id": {"value": normalized_query, "boost": 30}}})

    base_query = {
        "bool": {
            "should": should_clauses,
            "minimum_should_match": 1,
        }
    }

    return {
        "function_score": {
            "query": base_query,
            "score_mode": "sum",
            "boost_mode": "sum",
            "functions": [
                {
                    "field_value_factor": {
                        "field": "average_rating",
                        "factor": 0.15,
                        "missing": 0,
                    }
                },
                {
                    "field_value_factor": {
                        "field": "avg_star",
                        "factor": 0.15,
                        "missing": 0,
                    }
                },
                {
                    "field_value_factor": {
                        "field": "total_ratings_count",
                        "factor": 0.00002,
                        "modifier": "log1p",
                        "missing": 0,
                    }
                },
                {
                    "field_value_factor": {
                        "field": "num_rating",
                        "factor": 0.00002,
                        "modifier": "log1p",
                        "missing": 0,
                    }
                },
            ],
        }
    }


def _normalize_books_dataframe(data: pd.DataFrame) -> pd.DataFrame:
    records = [normalize_book_record(record) for record in data.to_dict("records")]
    return pd.DataFrame.from_records(records)


def _read_data_file(path: Path) -> pd.DataFrame:
    suffix = path.suffix.lower()
    if suffix == ".csv":
        return pd.read_csv(path, on_bad_lines="skip")
    if suffix in {".parquet", ".pq"}:
        return pd.read_parquet(path)
    raise ValueError(f"Unsupported transformed data file type: {path}")


def _format_tags(value: Any, max_tags: int = 3) -> str:
    if _clean_value(value) is None:
        return ""
    tags = [tag.strip() for tag in str(value).split("|") if tag.strip()]
    return ", ".join(tags[:max_tags])


def _normalize_limit(limit: int) -> int:
    try:
        value = int(limit)
    except (TypeError, ValueError):
        return DEFAULT_SEARCH_LIMIT
    if value <= 0:
        return 0
    return min(value, MAX_SEARCH_LIMIT)


def _clean_value(value: Any) -> Any:
    if value is None:
        return None
    try:
        if bool(pd.isna(value)):
            return None
    except (TypeError, ValueError):
        pass
    return value


def _clean_text(value: Any) -> str | None:
    value = _clean_value(value)
    if value is None:
        return None
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    text = str(value).strip()
    return text or None


def _to_int(value: Any) -> int | None:
    value = _clean_value(value)
    if value is None or value == "":
        return None
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return None


def _to_float(value: Any) -> float | None:
    value = _clean_value(value)
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _env_bool(name: str, default: bool) -> bool:
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip().lower() not in {"0", "false", "no", "off"}


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Index and search books with Elasticsearch.")
    parser.add_argument("--url", default=None, help="Elasticsearch URL. Defaults to ELASTICSEARCH_URL.")
    parser.add_argument("--index", default=None, help="Index name. Defaults to ELASTICSEARCH_INDEX or books.")
    parser.add_argument("--timeout", type=int, default=30, help="Elasticsearch request timeout in seconds.")

    subparsers = parser.add_subparsers(dest="command", required=True)

    index_parser = subparsers.add_parser("index", help="Index the transformed book dataset.")
    index_parser.add_argument("--data-path", default=TRANSFORMED_BOOKS_PATH)
    index_parser.add_argument("--recreate", action="store_true", help="Delete and recreate the index first.")
    index_parser.add_argument("--no-refresh", action="store_true", help="Skip index refresh after bulk indexing.")
    index_parser.add_argument("--chunk-size", type=int, default=500)

    search_parser = subparsers.add_parser("search", help="Search the Elasticsearch index.")
    search_parser.add_argument("query")
    search_parser.add_argument("--limit", type=int, default=20)
    search_parser.add_argument("--include-score", action="store_true")

    return parser


def main() -> None:
    args = _build_parser().parse_args()
    client = create_client(url=args.url, request_timeout=args.timeout)
    index_name = args.index or os.environ.get("ELASTICSEARCH_INDEX", DEFAULT_INDEX_NAME)

    if args.command == "index":
        count = index_transformed_books(
            client,
            index_name=index_name,
            data_path=args.data_path,
            recreate=args.recreate,
            refresh=not args.no_refresh,
            chunk_size=args.chunk_size,
        )
        print(f"Indexed {count} books into {index_name}")
        return

    if args.command == "search":
        results = search_books_elasticsearch(
            args.query,
            client,
            index_name=index_name,
            limit=args.limit,
            include_score=args.include_score,
        )
        print(json.dumps(results, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
