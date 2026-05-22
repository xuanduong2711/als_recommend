"""Fuzzy search over the transformed book feature dataset.

``src/transform.py`` writes the content-based book table with this schema:

    work_id,title,authors,year,average_rating,total_ratings_count,image_url,tags

Newer transformed datasets may also include UI aliases such as ``book_title``,
``author``, ``image_path``, ``avg_star``, ``num_rating``, and ``genre``. Search
supports both canonical and alias columns.
"""

from __future__ import annotations

from collections.abc import Iterable, Mapping, Sequence
from difflib import SequenceMatcher
from functools import lru_cache
from pathlib import Path
import re
import unicodedata
from typing import Any, Optional

import pandas as pd

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
        def partial_ratio(query: str, text: str) -> float:
            if not query or not text:
                return 0.0
            if len(query) > len(text):
                query, text = text, query

            best = 0.0
            window_size = len(query)
            for index in range(len(text) - window_size + 1):
                window = text[index : index + window_size]
                score = SequenceMatcher(None, query, window).ratio()
                best = max(best, score)
            return best * 100

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


def load_transformed_books(path: str | Path = TRANSFORMED_BOOKS_PATH) -> pd.DataFrame:
    """Load the book feature dataset produced by ``src/transform.py``."""
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


def search_transformed_books(
    query: str,
    data_path: str | Path = TRANSFORMED_BOOKS_PATH,
    limit: int = 20,
    score_cutoff: int = 55,
    include_score: bool = False,
) -> list[dict[str, Any]]:
    """Search books from the transformed feature dataset."""
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
    search_columns: Optional[Sequence[str]] = None,
    include_score: bool = False,
    normalize_output: bool = True,
) -> list[dict[str, Any]]:
    """Return book records that fuzzily match ``query``.

    ``books`` may be a pandas DataFrame, a sequence of dictionaries, or any
    iterable of mapping-like records.
    """
    normalized_query = normalize_text(query)
    if not normalized_query or limit <= 0:
        return []

    columns = tuple(search_columns or SEARCH_COLUMNS)
    scored_books: list[tuple[float, int, dict[str, Any]]] = []

    for position, record in enumerate(_iter_records(books)):
        score = _score_record(record, normalized_query, columns)
        if score < score_cutoff:
            continue

        result = normalize_book_record(record) if normalize_output else dict(record)
        if include_score:
            result["match_score"] = round(score, 2)
        scored_books.append((score, position, result))

    scored_books.sort(key=lambda item: (-item[0], item[1]))
    return [record for _, _, record in scored_books[:limit]]


def search_books(
    books_or_query: Any,
    query: Optional[str] = None,
    limit: int = 20,
    score_cutoff: int = 55,
    include_score: bool = False,
) -> list[dict[str, Any]]:
    """Compatibility wrapper.

    ``search_books("harry potter")`` searches the transformed dataset.
    ``search_books(records, "harry potter")`` searches the provided records.
    """
    if query is None:
        return search_transformed_books(
            query=str(books_or_query),
            limit=limit,
            score_cutoff=score_cutoff,
            include_score=include_score,
        )

    return fuzzy_search_books(
        books_or_query,
        query=query,
        limit=limit,
        score_cutoff=score_cutoff,
        include_score=include_score,
    )


def fuzzy_search(
    books_or_query: Any,
    query: Optional[str] = None,
    limit: int = 20,
    score_cutoff: int = 55,
    include_score: bool = False,
) -> list[dict[str, Any]]:
    """Short alias for ``search_books``."""
    return search_books(
        books_or_query,
        query=query,
        limit=limit,
        score_cutoff=score_cutoff,
        include_score=include_score,
    )


def normalize_text(value: Any) -> str:
    """Normalize text for case-insensitive and accent-insensitive matching."""
    if _is_missing(value):
        return ""

    text = unicodedata.normalize("NFKD", str(value))
    text = "".join(char for char in text if not unicodedata.combining(char))
    text = text.casefold().replace("|", " ").replace("_", " ")
    text = PUNCT_RE.sub(" ", text)
    return SPACE_RE.sub(" ", text).strip()


def normalize_book_record(record: Mapping[str, Any]) -> dict[str, Any]:
    """Return a record with aliases expected by the current Flask templates."""
    result = {
        key: None if _is_missing(value) else value
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
        result["avg_star"] = _to_number(result.get("average_rating"))
    if "num_rating" not in result and "total_ratings_count" in result:
        result["num_rating"] = _to_int(result.get("total_ratings_count"))
    if "genre" not in result and "tags" in result:
        result["genre"] = _format_tags(result.get("tags"))

    result.setdefault("price", None)
    return result


def _normalize_books_dataframe(data: pd.DataFrame) -> pd.DataFrame:
    records = [normalize_book_record(record) for record in data.to_dict("records")]
    return pd.DataFrame.from_records(records)


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
        and not _is_missing(record.get(column))
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

    return max(title_score, author_score, tag_score, id_score, combined_score)


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


def _read_data_file(path: Path) -> pd.DataFrame:
    suffix = path.suffix.lower()
    if suffix == ".csv":
        return pd.read_csv(path, on_bad_lines="skip")
    if suffix in {".parquet", ".pq"}:
        return pd.read_parquet(path)
    raise ValueError(f"Unsupported transformed data file type: {path}")


def _format_tags(value: Any, max_tags: int = 3) -> str:
    if _is_missing(value):
        return ""
    tags = [tag.strip() for tag in str(value).split("|") if tag.strip()]
    return ", ".join(tags[:max_tags])


def _to_number(value: Any) -> Optional[float]:
    try:
        if _is_missing(value):
            return None
        number = float(value)
        if pd.isna(number):
            return None
        return number
    except (TypeError, ValueError):
        return None


def _to_int(value: Any) -> Optional[int]:
    number = _to_number(value)
    if number is None:
        return None
    return int(number)


def _is_missing(value: Any) -> bool:
    if value is None:
        return True
    try:
        result = pd.isna(value)
    except (TypeError, ValueError):
        return False
    return bool(result) if isinstance(result, bool) else False
