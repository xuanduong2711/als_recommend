"""TF-IDF content-based recommender for transformed book data.

``src/transform.py`` writes ``data/book_features_dataset`` with ``work_id`` as
the canonical item id. This module loads that dataset, builds text features from
book metadata, and returns recommendations with both canonical fields and
template-friendly aliases.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass, field
from pathlib import Path
import pickle
import re
import unicodedata
from typing import Any, Iterable, Optional

import pandas as pd
from scipy import sparse
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import euclidean_distances, linear_kernel


DEFAULT_DATA_PATH = "data/book_features_dataset"
FALLBACK_DATA_PATHS = (
    "data/book_features_dataset",
    "data/clean_books_temp",
    "data/clean_books_temp/clean",
    "data/clean_books_temp/partques_output",
    "data/final_ratings_parquet",
    "test_code/data/final_ratings_parquet",
)
DEFAULT_TEXT_COLUMNS = (
    "title",
    "authors",
    "tags",
    "year",
    "book_title",
    "author",
    "genre",
    "tag_name",
    "language_code",
)
DEFAULT_METADATA_COLUMNS = (
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
    "tag_name",
    "genre",
)
TRANSFORM_OUTPUT_COLUMNS = (
    "work_id",
    "title",
    "authors",
    "year",
    "average_rating",
    "total_ratings_count",
    "image_url",
    "tags",
)
FEATURE_SEPARATOR_RE = re.compile(r"[|_/]+")
WHITESPACE_RE = re.compile(r"\s+")
PUNCT_RE = re.compile(r"[^\w\s-]", flags=re.UNICODE)


def load_from_transform_output(
    path: str | Path = "data/book_features_dataset",
    expand_tags: bool = True,
) -> pd.DataFrame:
    """Load book features dataset from transform.py output.

    Args:
        path: Path to the book_features_dataset directory.
        expand_tags: If True, expand pipe-separated tags into separate words.

    Returns:
        DataFrame with combined_features column ready for TF-IDF.
    """
    data = load_books_dataframe(path)
    missing = [column for column in TRANSFORM_OUTPUT_COLUMNS if column not in data.columns]
    if missing:
        raise ValueError(
            "Transform output is missing expected columns: "
            f"{', '.join(missing)}"
        )
    data = add_book_aliases(data)
    return build_combined_features(data, expand_tags=expand_tags)


def train_from_transform_output(
    path: str | Path = "data/book_features_dataset",
    id_col: str = "work_id",
    content_col: str = "combined_features",
    max_features: int = 5000,
    expand_tags: bool = True,
    metadata_cols: Optional[Iterable[str]] = None,
) -> ContentBasedRecommender:
    """Load data from transform.py output and fit a content-based recommender.

    Args:
        path: Path to the book_features_dataset directory.
        id_col: Column to use as item identifier (default: work_id).
        content_col: Column containing combined text features.
        max_features: Maximum number of TF-IDF features.
        expand_tags: If True, expand pipe-separated tags into separate words.
        metadata_cols: Metadata columns to keep with recommendations.

    Returns:
        Fitted ContentBasedRecommender instance.
    """
    data = load_from_transform_output(path, expand_tags=expand_tags)
    recommender = ContentBasedRecommender(max_features=max_features)
    return recommender.fit(
        data,
        id_col=id_col,
        content_col=content_col,
        metadata_cols=metadata_cols,
    )


def resolve_data_path(path: str | Path = DEFAULT_DATA_PATH) -> Path:
    """Return the first existing data path, trying project fallbacks when needed."""
    candidate = Path(path)
    if candidate.exists():
        return candidate

    for fallback in FALLBACK_DATA_PATHS:
        fallback_path = Path(fallback)
        if fallback_path.exists():
            return fallback_path

    return candidate


def load_books_dataframe(path: str | Path = DEFAULT_DATA_PATH) -> pd.DataFrame:
    """Load a CSV/parquet file or Spark-style output directory into pandas."""
    resolved_path = resolve_data_path(path)
    if not resolved_path.exists():
        raise FileNotFoundError(f"Data path does not exist: {resolved_path}")

    if resolved_path.is_file():
        return _read_table_file(resolved_path)

    parquet_files = sorted(resolved_path.glob("*.parquet"))
    if parquet_files:
        return pd.read_parquet(resolved_path)

    csv_files = sorted(
        file_path
        for file_path in resolved_path.glob("*.csv")
        if not file_path.name.startswith(".")
    )
    if csv_files:
        frames = [pd.read_csv(file_path, on_bad_lines="skip") for file_path in csv_files]
        return pd.concat(frames, ignore_index=True)

    raise FileNotFoundError(f"No readable .csv or .parquet files found in {resolved_path}")


def build_combined_features(
    df: pd.DataFrame,
    text_cols: Iterable[str] = DEFAULT_TEXT_COLUMNS,
    output_col: str = "combined_features",
    expand_tags: bool = True,
) -> pd.DataFrame:
    """Create a text column for TF-IDF from available title, author, tag, and year columns."""
    available_cols = _select_text_columns(df, text_cols)
    if not available_cols:
        raise ValueError(
            "None of the requested text columns exist. "
            f"Available columns: {', '.join(df.columns)}"
        )

    result = df.copy()
    parts = []
    for column in available_cols:
        series = result[column].map(
            lambda value: _clean_feature_text(
                value,
                is_year=column == "year",
                expand_separators=expand_tags or column not in ("tags", "tag_name"),
            )
        )
        parts.append(series)

    result[output_col] = parts[0]
    for series in parts[1:]:
        result[output_col] = result[output_col].str.cat(series, sep=" ")

    result[output_col] = result[output_col].str.replace(r"\s+", " ", regex=True).str.strip()
    return result


@dataclass
class ContentBasedRecommender:
    """Recommend similar books using TF-IDF vectors over book metadata."""

    max_features: int = 5000
    ngram_range: tuple[int, int] = (1, 2)
    min_df: int | float = 1
    stop_words: Optional[str | list[str]] = "english"
    lowercase: bool = True
    sublinear_tf: bool = True
    token_pattern: str = r"(?u)\b[\w-]+\b"

    vectorizer: TfidfVectorizer = field(init=False)
    matrix: Optional[sparse.csr_matrix] = field(default=None, init=False)
    items_df: Optional[pd.DataFrame] = field(default=None, init=False)
    id_col: Optional[str] = field(default=None, init=False)
    content_col: Optional[str] = field(default=None, init=False)
    _id_lookup: dict[str, int] = field(default_factory=dict, init=False)

    def __post_init__(self) -> None:
        self.vectorizer = TfidfVectorizer(
            max_features=self.max_features,
            ngram_range=self.ngram_range,
            min_df=self.min_df,
            stop_words=self.stop_words,
            lowercase=self.lowercase,
            sublinear_tf=self.sublinear_tf,
            token_pattern=self.token_pattern,
            norm="l2",
        )

    def fit(
        self,
        df: pd.DataFrame,
        id_col: str,
        content_col: str = "combined_features",
        metadata_cols: Optional[Iterable[str]] = None,
    ) -> "ContentBasedRecommender":
        """Fit TF-IDF vectors from a DataFrame.

        Duplicate ids are collapsed into one row by joining their text fields.
        Metadata columns keep the first non-null value for each item.
        """
        self._validate_fit_input(df, id_col, content_col)

        metadata = tuple(metadata_cols) if metadata_cols is not None else DEFAULT_METADATA_COLUMNS
        metadata = tuple(column for column in metadata if column in df.columns and column != id_col)

        working_df = df[[id_col, content_col, *metadata]].copy()
        working_df = working_df.dropna(subset=[id_col])
        working_df[content_col] = working_df[content_col].fillna("").astype(str)
        working_df = working_df[working_df[content_col].str.strip().ne("")]
        if working_df.empty:
            raise ValueError(f"No non-empty text found in column {content_col!r}.")

        aggregations = {content_col: _join_unique_text}
        aggregations.update({column: _first_non_missing for column in metadata})
        items_df = working_df.groupby(id_col, as_index=False, sort=False).agg(aggregations)

        self.matrix = self.vectorizer.fit_transform(items_df[content_col])
        self.items_df = items_df.reset_index(drop=True)
        self.id_col = id_col
        self.content_col = content_col
        self._id_lookup = {
            item_id: index for index, item_id in enumerate(self.items_df[id_col].astype(str))
        }
        return self

    def recommend(
        self,
        item_id: str | int,
        top_k: int = 10,
        metric: str = "cosine",
        exclude_self: bool = True,
        min_score: Optional[float] = None,
    ) -> pd.DataFrame:
        """Return the top-k books most similar to ``item_id``."""
        self._require_fitted()
        assert self.items_df is not None
        assert self.matrix is not None
        assert self.id_col is not None

        lookup_key = str(item_id)
        if lookup_key not in self._id_lookup:
            raise KeyError(f"Unknown item id: {item_id}")

        item_index = self._id_lookup[lookup_key]
        scores = self._score_vector(self.matrix[item_index], metric)
        exclude_indices = {item_index} if exclude_self else None
        if exclude_self:
            scores = scores.drop(index=item_index)

        return self._top_k_frame(
            scores,
            top_k,
            min_score=min_score,
            exclude_indices=exclude_indices,
        )

    def recommend_by_text(
        self,
        text: str,
        top_k: int = 10,
        metric: str = "cosine",
        min_score: Optional[float] = None,
    ) -> pd.DataFrame:
        """Return the top-k books most similar to a free-text query."""
        self._require_fitted()
        if not text or not text.strip():
            raise ValueError("text must be a non-empty string.")

        query_vector = self.vectorizer.transform([text])
        scores = self._score_vector(query_vector, metric)
        return self._top_k_frame(scores, top_k, min_score=min_score)

    def get_item(self, item_id: str | int) -> pd.Series:
        """Return one fitted item row by id."""
        self._require_fitted()
        assert self.items_df is not None

        lookup_key = str(item_id)
        if lookup_key not in self._id_lookup:
            raise KeyError(f"Unknown item id: {item_id}")
        return self.items_df.iloc[self._id_lookup[lookup_key]].copy()

    def feature_names(self) -> list[str]:
        """Return learned TF-IDF feature names."""
        self._require_fitted()
        return self.vectorizer.get_feature_names_out().tolist()

    def save(self, path: str | Path) -> None:
        """Persist the fitted recommender to disk."""
        self._require_fitted()
        output_path = Path(path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with output_path.open("wb") as file:
            pickle.dump(self, file)

    @classmethod
    def load(cls, path: str | Path) -> "ContentBasedRecommender":
        """Load a recommender saved with ``save``."""
        with Path(path).open("rb") as file:
            model = pickle.load(file)
        if not isinstance(model, cls):
            raise TypeError(f"File does not contain a {cls.__name__}: {path}")
        return model

    def _score_vector(self, vector: sparse.csr_matrix, metric: str) -> pd.Series:
        assert self.matrix is not None

        normalized_metric = metric.lower()
        if normalized_metric in {"cosine", "linear"}:
            scores = linear_kernel(vector, self.matrix).ravel()
        elif normalized_metric == "euclidean":
            distances = euclidean_distances(vector, self.matrix).ravel()
            scores = 1.0 / (1.0 + distances)
        else:
            raise ValueError("metric must be one of: 'cosine', 'linear', 'euclidean'.")

        return pd.Series(scores)

    def _top_k_frame(
        self,
        scores: pd.Series,
        top_k: int,
        min_score: Optional[float] = None,
        exclude_indices: Optional[set[int]] = None,
    ) -> pd.DataFrame:
        assert self.items_df is not None

        if top_k <= 0:
            raise ValueError("top_k must be greater than 0.")

        if exclude_indices:
            scores = scores.drop(index=list(exclude_indices), errors="ignore")
        if min_score is not None:
            scores = scores[scores >= min_score]
        if scores.empty:
            return self.items_df.iloc[0:0].copy().assign(score=pd.Series(dtype=float))

        limit = min(top_k, len(scores))
        top_indices = scores.nlargest(limit).index
        recommendations = self.items_df.iloc[top_indices].copy()
        recommendations["score"] = scores.loc[top_indices].to_numpy()
        recommendations = add_book_aliases(recommendations)
        return recommendations.sort_values("score", ascending=False).reset_index(drop=True)

    def _require_fitted(self) -> None:
        if self.matrix is None or self.items_df is None or self.id_col is None:
            raise ValueError("No fitted TF-IDF model available. Call fit() first.")

    @staticmethod
    def _validate_fit_input(df: pd.DataFrame, id_col: str, content_col: str) -> None:
        missing = [column for column in (id_col, content_col) if column not in df.columns]
        if missing:
            raise ValueError(f"Missing required columns: {', '.join(missing)}")
        if df.empty:
            raise ValueError("Cannot fit recommender with an empty DataFrame.")


def fit_content_recommender(
    data: pd.DataFrame,
    id_col: Optional[str] = None,
    content_col: str = "combined_features",
    max_features: int = 5000,
    expand_tags: bool = True,
    metadata_cols: Optional[Iterable[str]] = None,
) -> ContentBasedRecommender:
    """Build text features when needed and fit a ``ContentBasedRecommender``."""
    feature_df = add_book_aliases(data)
    selected_id_col = id_col or infer_id_column(feature_df)
    if content_col not in feature_df.columns:
        feature_df = build_combined_features(
            feature_df,
            output_col=content_col,
            expand_tags=expand_tags,
        )

    recommender = ContentBasedRecommender(max_features=max_features)
    return recommender.fit(
        feature_df,
        id_col=selected_id_col,
        content_col=content_col,
        metadata_cols=metadata_cols,
    )


def train_from_path(
    path: str | Path = DEFAULT_DATA_PATH,
    id_col: Optional[str] = None,
    content_col: str = "combined_features",
    max_features: int = 5000,
    expand_tags: bool = True,
    metadata_cols: Optional[Iterable[str]] = None,
) -> ContentBasedRecommender:
    """Load project data and fit a content-based recommender."""
    data = load_books_dataframe(path)
    return fit_content_recommender(
        data,
        id_col=id_col,
        content_col=content_col,
        max_features=max_features,
        expand_tags=expand_tags,
        metadata_cols=metadata_cols,
    )


def infer_id_column(df: pd.DataFrame) -> str:
    """Infer the item id column used by known project datasets."""
    for column in ("work_id", "book_id", "product_id", "id"):
        if column in df.columns:
            return column
    raise ValueError(
        "Could not infer item id column. Pass id_col explicitly. "
        f"Available columns: {', '.join(df.columns)}"
    )


def _read_table_file(path: Path) -> pd.DataFrame:
    suffix = path.suffix.lower()
    if suffix in {".parquet", ".pq"}:
        return pd.read_parquet(path)
    if suffix == ".csv":
        return pd.read_csv(path, on_bad_lines="skip")
    raise ValueError(f"Unsupported data file type: {path}")


def _join_unique_text(values: pd.Series) -> str:
    seen: set[str] = set()
    unique_values: list[str] = []
    for value in values.dropna().astype(str):
        normalized = value.strip()
        if normalized and normalized not in seen:
            seen.add(normalized)
            unique_values.append(normalized)
    return " ".join(unique_values)


def add_book_aliases(df: pd.DataFrame) -> pd.DataFrame:
    """Add Flask-template friendly aliases without dropping source columns."""
    result = df.copy()
    aliases = {
        "book_id": "work_id",
        "book_title": "title",
        "author": "authors",
        "image_path": "image_url",
        "avg_star": "average_rating",
        "num_rating": "total_ratings_count",
    }
    for alias, source in aliases.items():
        if alias not in result.columns and source in result.columns:
            result[alias] = result[source]

    if "genre" not in result.columns and "tags" in result.columns:
        result["genre"] = result["tags"].map(_format_tags)
    if "price" not in result.columns:
        result["price"] = None
    return result


def _select_text_columns(df: pd.DataFrame, text_cols: Iterable[str]) -> list[str]:
    """Pick available text columns without duplicating canonical/alias pairs."""
    alias_groups = (
        ("title", "book_title"),
        ("authors", "author"),
        ("tags", "genre", "tag_name"),
    )
    selected: list[str] = []
    skipped_aliases: set[str] = set()

    for group in alias_groups:
        canonical = next((column for column in group if column in df.columns), None)
        if canonical is None:
            continue
        selected.append(canonical)
        skipped_aliases.update(column for column in group if column != canonical)

    for column in text_cols:
        if column in df.columns and column not in selected and column not in skipped_aliases:
            selected.append(column)

    return selected


def _first_non_missing(values: pd.Series) -> Any:
    for value in values:
        if not _is_missing(value):
            return value
    return None


def _clean_feature_text(
    value: Any,
    is_year: bool = False,
    expand_separators: bool = True,
) -> str:
    if _is_missing(value):
        return ""

    text = str(value)
    if is_year:
        text = re.sub(r"\.0$", "", text)
    text = unicodedata.normalize("NFKD", text)
    text = "".join(char for char in text if not unicodedata.combining(char))
    if expand_separators:
        text = FEATURE_SEPARATOR_RE.sub(" ", text)
    text = PUNCT_RE.sub(" ", text)
    return WHITESPACE_RE.sub(" ", text).strip()


def _format_tags(value: Any, max_tags: int = 3) -> str:
    if _is_missing(value):
        return ""
    tags = [tag.strip() for tag in str(value).split("|") if tag.strip()]
    return ", ".join(tags[:max_tags])


def _is_missing(value: Any) -> bool:
    if value is None:
        return True
    try:
        result = pd.isna(value)
    except (TypeError, ValueError):
        return False
    return bool(result) if isinstance(result, bool) else False


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Train a TF-IDF content recommender.")
    parser.add_argument("--data", default=DEFAULT_DATA_PATH)
    parser.add_argument("--id-col")
    parser.add_argument("--item-id")
    parser.add_argument("--query")
    parser.add_argument("--top-k", type=int, default=5)
    parser.add_argument("--max-features", type=int, default=5000)
    parser.add_argument("--metric", choices=("cosine", "linear", "euclidean"), default="cosine")
    args = parser.parse_args()

    content_recommender = train_from_transform_output(
        args.data,
        id_col=args.id_col or "work_id",
        max_features=args.max_features,
    )

    if args.query:
        results = content_recommender.recommend_by_text(
            args.query,
            top_k=args.top_k,
            metric=args.metric,
        )
    else:
        item_id = args.item_id or str(content_recommender.items_df[content_recommender.id_col].iloc[0])
        print(f"Recommendations for item id: {item_id}")
        results = content_recommender.recommend(
            item_id,
            top_k=args.top_k,
            metric=args.metric,
        )

    display_cols = [
        column
        for column in ("book_id", "work_id", "title", "book_title", "authors", "author", "score")
        if column in results.columns
    ]
    print(results[display_cols].to_string(index=False))
