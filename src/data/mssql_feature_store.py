"""Build recommendation-ready datasets from MSSQL business snapshots.

The input is a directory containing exported tables (CSV, parquet, or JSON).
Expected table names follow the documented schema in ``databases/MSSQL``:

* ``Books``
* ``Users``
* ``Ratings``
* ``Reviews``
* ``UserFavoriteBooks``
* ``UserPurchasedBooks``

The pipeline emits:

* ``items_features`` for content-based models and search.
* ``interactions_dataset`` for ALS training on integer ids.
* ``id_mappings`` to map UUID business ids to internal integer ids.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
import json
from pathlib import Path
from typing import Any
import uuid

import pandas as pd

DEFAULT_SNAPSHOT_DIR = "data/mssql_snapshot"
DEFAULT_OUTPUT_DIR = "data/mssql_feature_store"

DEFAULT_TABLE_ALIASES = {
    "books": ("Books", "books", "dbo.Books"),
    "users": ("Users", "users", "dbo.Users"),
    "ratings": ("Ratings", "ratings", "dbo.Ratings"),
    "reviews": ("Reviews", "reviews", "dbo.Reviews"),
    "favorites": (
        "UserFavoriteBooks",
        "userfavoritebooks",
        "dbo.UserFavoriteBooks",
    ),
    "purchases": (
        "UserPurchasedBooks",
        "userpurchasedbooks",
        "dbo.UserPurchasedBooks",
    ),
}


@dataclass(frozen=True)
class InteractionWeights:
    """Weight configuration for converting implicit events into ratings."""

    rating_multiplier: float = 1.0
    favorite_score: float = 4.0
    review_score: float = 3.5
    purchase_base_score: float = 4.3
    purchase_quantity_boost: float = 0.25
    min_rating: float = 1.0
    max_rating: float = 5.0


@dataclass(frozen=True)
class FeatureStoreBundle:
    """Normalized datasets used by training/runtime layers."""

    items_features: pd.DataFrame
    interactions_dataset: pd.DataFrame
    users_mapping: pd.DataFrame
    books_mapping: pd.DataFrame
    metadata: dict[str, Any]


def build_feature_store(
    snapshot_dir: str | Path = DEFAULT_SNAPSHOT_DIR,
    *,
    weights: InteractionWeights = InteractionWeights(),
) -> FeatureStoreBundle:
    """Build model datasets from an exported MSSQL snapshot directory."""
    tables = load_snapshot_tables(snapshot_dir)
    books = _prepare_books_table(tables["books"])
    ratings = _prepare_ratings_table(tables.get("ratings"))
    reviews = _prepare_reviews_table(tables.get("reviews"))
    favorites = _prepare_favorites_table(tables.get("favorites"))
    purchases = _prepare_purchases_table(tables.get("purchases"))

    items_features = _build_items_features(books, ratings, reviews)
    interactions_raw = _build_interactions(
        ratings=ratings,
        reviews=reviews,
        favorites=favorites,
        purchases=purchases,
        weights=weights,
    )
    users_mapping, books_mapping = _build_id_mappings(items_features, interactions_raw)
    interactions_dataset = _map_interactions_to_internal_ids(
        interactions_raw=interactions_raw,
        users_mapping=users_mapping,
        books_mapping=books_mapping,
    )

    metadata = {
        "snapshot_dir": str(Path(snapshot_dir)),
        "weights": asdict(weights),
        "counts": {
            "items": int(len(items_features)),
            "interactions": int(len(interactions_dataset)),
            "users": int(len(users_mapping)),
            "books": int(len(books_mapping)),
        },
    }

    return FeatureStoreBundle(
        items_features=items_features,
        interactions_dataset=interactions_dataset,
        users_mapping=users_mapping,
        books_mapping=books_mapping,
        metadata=metadata,
    )


def materialize_feature_store(
    snapshot_dir: str | Path = DEFAULT_SNAPSHOT_DIR,
    output_dir: str | Path = DEFAULT_OUTPUT_DIR,
    *,
    weights: InteractionWeights = InteractionWeights(),
) -> FeatureStoreBundle:
    """Build and persist feature-store datasets."""
    bundle = build_feature_store(snapshot_dir=snapshot_dir, weights=weights)
    output = Path(output_dir)
    output.mkdir(parents=True, exist_ok=True)

    bundle.items_features.to_parquet(output / "items_features.parquet", index=False)
    bundle.interactions_dataset.to_parquet(output / "interactions_dataset.parquet", index=False)
    bundle.users_mapping.to_parquet(output / "users_mapping.parquet", index=False)
    bundle.books_mapping.to_parquet(output / "books_mapping.parquet", index=False)

    id_mappings = {
        "user_id_to_index": {
            str(row["source_user_id"]): int(row["user_id"])
            for _, row in bundle.users_mapping.iterrows()
        },
        "book_id_to_index": {
            str(row["source_book_id"]): int(row["work_id"])
            for _, row in bundle.books_mapping.iterrows()
        },
    }
    with (output / "id_mappings.json").open("w", encoding="utf-8") as file_obj:
        json.dump(id_mappings, file_obj, ensure_ascii=True, indent=2, sort_keys=True)

    with (output / "metadata.json").open("w", encoding="utf-8") as file_obj:
        json.dump(bundle.metadata, file_obj, ensure_ascii=True, indent=2, sort_keys=True)

    return bundle


def load_snapshot_tables(snapshot_dir: str | Path) -> dict[str, pd.DataFrame]:
    """Load snapshot tables from local files."""
    snapshot = Path(snapshot_dir)
    if not snapshot.exists():
        raise FileNotFoundError(f"Snapshot directory does not exist: {snapshot}")

    loaded: dict[str, pd.DataFrame] = {}
    for table_key, aliases in DEFAULT_TABLE_ALIASES.items():
        table = _find_table_file(snapshot, aliases)
        if table is None:
            if table_key == "books":
                raise FileNotFoundError("Missing Books table in MSSQL snapshot directory.")
            continue
        loaded[table_key] = _read_table_file(table)

    return loaded


def _find_table_file(snapshot_dir: Path, aliases: tuple[str, ...]) -> Path | None:
    suffixes = (".parquet", ".csv", ".json")
    candidates: list[Path] = []

    for alias in aliases:
        base = alias.lower().replace(".", "_")
        for suffix in suffixes:
            candidates.extend(
                (
                    snapshot_dir / f"{alias}{suffix}",
                    snapshot_dir / f"{base}{suffix}",
                    snapshot_dir / alias / f"{alias}{suffix}",
                    snapshot_dir / alias / f"{base}{suffix}",
                )
            )

    for candidate in candidates:
        if candidate.exists():
            return candidate
    return None


def _read_table_file(path: Path) -> pd.DataFrame:
    suffix = path.suffix.lower()
    if suffix == ".parquet":
        return pd.read_parquet(path)
    if suffix == ".csv":
        return pd.read_csv(path, on_bad_lines="skip")
    if suffix == ".json":
        return pd.read_json(path)
    raise ValueError(f"Unsupported table file type: {path}")


def _prepare_books_table(books: pd.DataFrame) -> pd.DataFrame:
    required = {"book_id", "title", "author", "category", "description"}
    missing = required.difference(books.columns)
    if missing:
        raise ValueError(
            "Books table missing columns: " + ", ".join(sorted(missing))
        )

    frame = books.copy()
    frame["book_id"] = frame["book_id"].map(_normalize_identifier)
    frame = frame[frame["book_id"].ne("")]
    frame = frame.drop_duplicates(subset=["book_id"])
    frame["title"] = frame["title"].fillna("").astype(str)
    frame["author"] = frame["author"].fillna("").astype(str)
    frame["category"] = frame["category"].fillna("").astype(str)
    frame["description"] = frame["description"].fillna("").astype(str)
    frame["published_year"] = pd.to_datetime(
        frame.get("published_at"),
        errors="coerce",
    ).dt.year
    return frame


def _prepare_ratings_table(ratings: pd.DataFrame | None) -> pd.DataFrame:
    if ratings is None or ratings.empty:
        return pd.DataFrame(columns=["user_id", "book_id", "rating_value"])

    required = {"user_id", "book_id", "rating_value"}
    missing = required.difference(ratings.columns)
    if missing:
        raise ValueError("Ratings table missing columns: " + ", ".join(sorted(missing)))

    frame = ratings.copy()
    frame["user_id"] = frame["user_id"].map(_normalize_identifier)
    frame["book_id"] = frame["book_id"].map(_normalize_identifier)
    frame["rating_value"] = pd.to_numeric(frame["rating_value"], errors="coerce")
    frame = frame.dropna(subset=["user_id", "book_id", "rating_value"])
    frame = frame[frame["user_id"].ne("") & frame["book_id"].ne("")]
    return frame



def _prepare_reviews_table(reviews: pd.DataFrame | None) -> pd.DataFrame:
    if reviews is None or reviews.empty:
        return pd.DataFrame(columns=["user_id", "book_id", "review_content"])

    required = {"user_id", "book_id"}
    missing = required.difference(reviews.columns)
    if missing:
        raise ValueError("Reviews table missing columns: " + ", ".join(sorted(missing)))

    frame = reviews.copy()
    frame["user_id"] = frame["user_id"].map(_normalize_identifier)
    frame["book_id"] = frame["book_id"].map(_normalize_identifier)
    if "review_content" in frame.columns:
        frame["review_content"] = frame["review_content"].fillna("").astype(str)
    else:
        frame["review_content"] = ""
    frame = frame.dropna(subset=["user_id", "book_id"])
    frame = frame[frame["user_id"].ne("") & frame["book_id"].ne("")]
    return frame


def _prepare_favorites_table(favorites: pd.DataFrame | None) -> pd.DataFrame:
    if favorites is None or favorites.empty:
        return pd.DataFrame(columns=["user_id", "book_id"])

    column_candidates = {
        "book_id": ("FavoriteBooksbook_id", "book_id"),
        "user_id": ("UserEntityUserId", "user_id"),
    }
    return _prepare_bridge_table(favorites, column_candidates)


def _prepare_purchases_table(purchases: pd.DataFrame | None) -> pd.DataFrame:
    if purchases is None or purchases.empty:
        return pd.DataFrame(columns=["user_id", "book_id", "quantity"])

    column_candidates = {
        "book_id": ("PurchaseBooksbook_id", "book_id"),
        "user_id": ("UserEntity1UserId", "user_id"),
    }
    quantity_col = next((name for name in ("quantity", "qty") if name in purchases.columns), None)
    optional_columns = [quantity_col] if quantity_col is not None else None
    frame = _prepare_bridge_table(
        purchases,
        column_candidates,
        optional_columns=optional_columns,
    )
    if quantity_col is None:
        frame["quantity"] = 1.0
    else:
        frame["quantity"] = pd.to_numeric(frame[quantity_col], errors="coerce").fillna(1.0)
        frame = frame.drop(columns=[quantity_col])
    return frame


def _prepare_bridge_table(
    frame: pd.DataFrame,
    column_candidates: dict[str, tuple[str, ...]],
    *,
    optional_columns: list[str] | None = None,
) -> pd.DataFrame:
    mapped: dict[str, str] = {}
    for output_col, candidates in column_candidates.items():
        selected = next((name for name in candidates if name in frame.columns), None)
        if selected is None:
            raise ValueError(
                f"Bridge table missing expected column for {output_col}: {candidates}"
            )
        mapped[output_col] = selected

    selected_columns = list(mapped.values())
    if optional_columns:
        selected_columns.extend(column for column in optional_columns if column in frame.columns)

    result = frame[selected_columns].rename(columns={src: dest for dest, src in mapped.items()}).copy()
    result["user_id"] = result["user_id"].map(_normalize_identifier)
    result["book_id"] = result["book_id"].map(_normalize_identifier)
    result = result[result["user_id"].ne("") & result["book_id"].ne("")]
    return result

def _build_items_features(
    books: pd.DataFrame,
    ratings: pd.DataFrame,
    reviews: pd.DataFrame,
) -> pd.DataFrame:
    rating_agg = (
        ratings.groupby("book_id")["rating_value"]
        .agg(["mean", "count"])
        .rename(columns={"mean": "average_rating", "count": "total_ratings_count"})
    )
    review_agg = (
        reviews.groupby("book_id")["review_content"]
        .agg(
            review_count="count",
            review_excerpt=lambda values: " ".join(
                _safe_text(value) for value in values if _safe_text(value)
            )[:600],
        )
    )

    items = books.merge(rating_agg, left_on="book_id", right_index=True, how="left")
    items = items.merge(review_agg, left_on="book_id", right_index=True, how="left")
    items["average_rating"] = pd.to_numeric(items["average_rating"], errors="coerce")
    items["total_ratings_count"] = (
        pd.to_numeric(items["total_ratings_count"], errors="coerce")
        .fillna(0)
        .astype(int)
    )
    items["review_count"] = pd.to_numeric(items["review_count"], errors="coerce").fillna(0).astype(int)
    items["tags"] = items["category"].fillna("").astype(str)
    items["genre"] = items["category"].fillna("").astype(str)
    items["authors"] = items["author"]
    items["book_title"] = items["title"]
    items["avg_star"] = items["average_rating"]
    items["num_rating"] = items["total_ratings_count"]
    items["image_url"] = None
    items["image_path"] = None
    items["work_id"] = range(1, len(items) + 1)
    items["year"] = items["published_year"]
    items["combined_features"] = (
        items["title"].fillna("")
        + " "
        + items["author"].fillna("")
        + " "
        + items["category"].fillna("")
        + " "
        + items["description"].fillna("")
        + " "
        + items["review_excerpt"].fillna("")
    ).str.replace(r"\s+", " ", regex=True).str.strip()

    return items[
        [
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
            "description",
            "combined_features",
        ]
    ].copy()


def _build_interactions(
    *,
    ratings: pd.DataFrame,
    reviews: pd.DataFrame,
    favorites: pd.DataFrame,
    purchases: pd.DataFrame,
    weights: InteractionWeights,
) -> pd.DataFrame:
    frames: list[pd.DataFrame] = []

    if not ratings.empty:
        explicit = ratings[["user_id", "book_id", "rating_value"]].copy()
        explicit["rating"] = pd.to_numeric(explicit["rating_value"], errors="coerce")
        explicit["event_type"] = "rating"
        frames.append(explicit[["user_id", "book_id", "rating", "event_type"]])

    if not favorites.empty:
        fav = favorites[["user_id", "book_id"]].copy()
        fav["rating"] = weights.favorite_score
        fav["event_type"] = "favorite"
        frames.append(fav[["user_id", "book_id", "rating", "event_type"]])

    if not reviews.empty:
        rev = reviews[["user_id", "book_id"]].copy()
        rev["rating"] = weights.review_score
        rev["event_type"] = "review"
        frames.append(rev[["user_id", "book_id", "rating", "event_type"]])

    if not purchases.empty:
        pur = purchases[["user_id", "book_id", "quantity"]].copy()
        quantity = pd.to_numeric(pur["quantity"], errors="coerce").fillna(1.0).clip(lower=1.0)
        pur["rating"] = weights.purchase_base_score + (quantity - 1.0) * weights.purchase_quantity_boost
        pur["event_type"] = "purchase"
        frames.append(pur[["user_id", "book_id", "rating", "event_type"]])

    if not frames:
        return pd.DataFrame(columns=["source_user_id", "source_book_id", "rating"])

    stacked = pd.concat(frames, ignore_index=True)
    stacked["rating"] = pd.to_numeric(stacked["rating"], errors="coerce")
    stacked = stacked.dropna(subset=["user_id", "book_id", "rating"])
    stacked["rating"] = stacked["rating"] * weights.rating_multiplier
    stacked["rating"] = stacked["rating"].clip(lower=weights.min_rating, upper=weights.max_rating)

    collapsed = (
        stacked.groupby(["user_id", "book_id"], as_index=False)
        .agg(
            rating=("rating", "mean"),
            event_count=("event_type", "count"),
        )
        .rename(columns={"user_id": "source_user_id", "book_id": "source_book_id"})
    )
    return collapsed


def _build_id_mappings(
    items_features: pd.DataFrame,
    interactions_raw: pd.DataFrame,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    book_ids = set(items_features["book_id"].astype(str))
    if not interactions_raw.empty:
        book_ids.update(interactions_raw["source_book_id"].astype(str))
    users = sorted(set(interactions_raw["source_user_id"].astype(str))) if not interactions_raw.empty else []
    books = sorted(book_ids)

    users_mapping = pd.DataFrame(
        {
            "source_user_id": users,
            "user_id": range(1, len(users) + 1),
        }
    )
    books_mapping = pd.DataFrame(
        {
            "source_book_id": books,
            "work_id": range(1, len(books) + 1),
            "book_id_index": range(1, len(books) + 1),
        }
    )
    return users_mapping, books_mapping


def _map_interactions_to_internal_ids(
    *,
    interactions_raw: pd.DataFrame,
    users_mapping: pd.DataFrame,
    books_mapping: pd.DataFrame,
) -> pd.DataFrame:
    if interactions_raw.empty:
        return pd.DataFrame(
            columns=[
                "user_id",
                "work_id",
                "book_id",
                "rating",
                "source_user_id",
                "source_book_id",
                "event_count",
            ]
        )

    data = interactions_raw.merge(users_mapping, on="source_user_id", how="left")
    data = data.merge(books_mapping, on="source_book_id", how="left")
    data = data.dropna(subset=["user_id", "work_id", "rating"])

    data["user_id"] = data["user_id"].astype(int)
    data["work_id"] = data["work_id"].astype(int)
    data["book_id"] = data["book_id_index"].astype(int)
    data["rating"] = pd.to_numeric(data["rating"], errors="coerce").astype(float)
    return data[
        [
            "user_id",
            "work_id",
            "book_id",
            "rating",
            "source_user_id",
            "source_book_id",
            "event_count",
        ]
    ].copy()


def _normalize_identifier(value: Any) -> str:
    text = str(value).strip() if value is not None else ""
    if not text:
        return ""
    try:
        return str(uuid.UUID(text))
    except (ValueError, AttributeError, TypeError):
        return text


def _safe_text(value: Any) -> str:
    if value is None:
        return ""
    text = str(value).strip()
    return text


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Build feature store from MSSQL snapshots.")
    parser.add_argument("--snapshot-dir", default=DEFAULT_SNAPSHOT_DIR)
    parser.add_argument("--output-dir", default=DEFAULT_OUTPUT_DIR)
    args = parser.parse_args()

    bundle = materialize_feature_store(args.snapshot_dir, args.output_dir)
    print(json.dumps(bundle.metadata, ensure_ascii=True, indent=2))

