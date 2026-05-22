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
from collections.abc import Iterable, Iterator, Mapping
from typing import Any

import pandas as pd
from elasticsearch import Elasticsearch, helpers

from src.search.fuzzy_search import (
    TRANSFORMED_BOOKS_PATH,
    load_transformed_books,
    normalize_book_record,
)


DEFAULT_ELASTICSEARCH_URL = "http://localhost:9200"
DEFAULT_INDEX_NAME = "books"
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

BOOK_INDEX_SETTINGS = {
    "analysis": {
        "analyzer": {
            "book_text_analyzer": {
                "type": "standard",
                "stopwords": "_english_",
            }
        }
    }
}

BOOK_INDEX_MAPPINGS = {
    "properties": {
        "work_id": {"type": "keyword"},
        "book_id": {"type": "keyword"},
        "title": {
            "type": "text",
            "analyzer": "book_text_analyzer",
            "fields": {"keyword": {"type": "keyword", "ignore_above": 256}},
        },
        "book_title": {
            "type": "text",
            "analyzer": "book_text_analyzer",
            "fields": {"keyword": {"type": "keyword", "ignore_above": 256}},
        },
        "authors": {
            "type": "text",
            "analyzer": "book_text_analyzer",
            "fields": {"keyword": {"type": "keyword", "ignore_above": 256}},
        },
        "author": {
            "type": "text",
            "analyzer": "book_text_analyzer",
            "fields": {"keyword": {"type": "keyword", "ignore_above": 256}},
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
            "fields": {"keyword": {"type": "keyword", "ignore_above": 512}},
        },
        "genre": {
            "type": "text",
            "analyzer": "book_text_analyzer",
            "fields": {"keyword": {"type": "keyword", "ignore_above": 512}},
        },
    }
}


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
) -> list[dict[str, Any]]:
    """Search indexed books and return records normalized for the app templates."""
    query = query.strip()
    if not query or limit <= 0:
        return []

    client = client or create_client()
    index_name = index_name or os.environ.get("ELASTICSEARCH_INDEX", DEFAULT_INDEX_NAME)

    response = client.search(
        index=index_name,
        size=limit,
        query=_build_book_query(query),
    )

    results: list[dict[str, Any]] = []
    for hit in response["hits"]["hits"]:
        record = normalize_book_record(hit.get("_source", {}))
        if include_score:
            record["match_score"] = hit.get("_score")
        results.append(record)
    return results


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
    should_clauses: list[dict[str, Any]] = [
        {
            "multi_match": {
                "query": query,
                "fields": ["title^4", "book_title^4", "authors^2", "author^2", "tags", "genre"],
                "type": "best_fields",
                "fuzziness": "AUTO",
            }
        },
        {
            "multi_match": {
                "query": query,
                "fields": ["title^5", "book_title^5", "authors^2", "author^2"],
                "type": "phrase_prefix",
            }
        },
    ]
    if query.isdigit():
        should_clauses.append({"term": {"work_id": query}})
        should_clauses.append({"term": {"book_id": query}})

    return {
        "bool": {
            "should": should_clauses,
            "minimum_should_match": 1,
        }
    }


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
