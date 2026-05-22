"""Build recommendation datasets from the Goodreads archive CSV files.

Outputs:
* ``data/interactions_dataset/part-00000.csv``
  ``user_id,work_id,book_id,rating`` averaged per user/work.
* ``data/book_features_dataset/part-00000.csv``
  canonical book fields plus UI/model compatibility aliases.

The script intentionally uses only the Python standard library so it can run in
minimal environments where pandas or pyspark are not installed.
"""

from __future__ import annotations

import argparse
import csv
import shutil
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


DEFAULT_ARCHIVE_DIR = Path("archive")
DEFAULT_OUTPUT_DIR = Path("data")
DEFAULT_TOP_TAGS = 20
INTERACTION_COLUMNS = ["user_id", "work_id", "book_id", "rating"]
BOOK_FEATURE_COLUMNS = [
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
]


@dataclass(frozen=True)
class Paths:
    archive_dir: Path
    output_dir: Path

    @property
    def books(self) -> Path:
        return self.archive_dir / "books.csv"

    @property
    def ratings(self) -> Path:
        return self.archive_dir / "ratings.csv"

    @property
    def book_tags(self) -> Path:
        return self.archive_dir / "book_tags.csv"

    @property
    def tags(self) -> Path:
        return self.archive_dir / "tags.csv"

    @property
    def interactions_output(self) -> Path:
        return self.output_dir / "interactions_dataset"

    @property
    def features_output(self) -> Path:
        return self.output_dir / "book_features_dataset"


def main() -> None:
    parser = argparse.ArgumentParser(description="Transform archive CSV files for recommendation models.")
    parser.add_argument("--archive-dir", type=Path, default=DEFAULT_ARCHIVE_DIR)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--top-tags", type=int, default=DEFAULT_TOP_TAGS)
    args = parser.parse_args()

    paths = Paths(args.archive_dir, args.output_dir)
    validate_inputs(paths)

    print("Loading books...")
    book_work_map, book_features = load_books(paths.books)
    print(f"Loaded {len(book_features):,} works from {paths.books}")

    print("Building interactions dataset...")
    interactions = build_interactions(paths.ratings, book_work_map)
    write_csv_dataset(
        paths.interactions_output,
        INTERACTION_COLUMNS,
        iter_interaction_rows(interactions),
    )
    print(f"Wrote {len(interactions):,} interactions to {paths.interactions_output}")

    print("Building book features dataset...")
    tag_names = load_tag_names(paths.tags)
    work_tags = build_work_tags(
        book_tags_path=paths.book_tags,
        tag_names=tag_names,
        book_work_map=book_work_map,
        top_tags=max(0, args.top_tags),
    )
    write_csv_dataset(
        paths.features_output,
        BOOK_FEATURE_COLUMNS,
        iter_feature_rows(book_features, work_tags),
    )
    print(f"Wrote {len(book_features):,} book features to {paths.features_output}")


def validate_inputs(paths: Paths) -> None:
    missing = [
        path
        for path in (paths.books, paths.ratings, paths.book_tags, paths.tags)
        if not path.exists()
    ]
    if missing:
        missing_text = ", ".join(str(path) for path in missing)
        raise FileNotFoundError(f"Missing required input file(s): {missing_text}")


def load_books(books_path: Path) -> tuple[dict[str, str], dict[str, dict[str, str]]]:
    """Return ``book_id -> work_id`` and one metadata row per work."""
    book_work_map: dict[str, str] = {}
    book_features: dict[str, dict[str, str]] = {}

    with books_path.open(newline="", encoding="utf-8") as file:
        for row in csv.DictReader(file):
            book_id = clean_value(row.get("book_id"))
            work_id = clean_value(row.get("work_id"))
            if not book_id or not work_id:
                continue

            book_work_map[book_id] = work_id
            book_features.setdefault(
                work_id,
                {
                    "work_id": work_id,
                    "title": first_text(row.get("original_title"), row.get("title")),
                    "authors": clean_value(row.get("authors")),
                    "year": clean_year(row.get("original_publication_year")),
                    "average_rating": clean_value(row.get("average_rating")),
                    "total_ratings_count": clean_value(row.get("work_ratings_count")),
                    "image_url": clean_value(row.get("image_url")),
                },
            )

    return book_work_map, book_features


def build_interactions(
    ratings_path: Path,
    book_work_map: dict[str, str],
) -> dict[tuple[str, str], tuple[float, int]]:
    """Average duplicate user ratings for the same work."""
    rating_totals: dict[tuple[str, str], tuple[float, int]] = {}

    with ratings_path.open(newline="", encoding="utf-8") as file:
        for row in csv.DictReader(file):
            book_id = clean_value(row.get("book_id"))
            user_id = clean_value(row.get("user_id"))
            rating = parse_float(row.get("rating"))
            work_id = book_work_map.get(book_id)

            if not user_id or not work_id or rating is None:
                continue

            key = (user_id, work_id)
            total, count = rating_totals.get(key, (0.0, 0))
            rating_totals[key] = (total + rating, count + 1)

    return rating_totals


def load_tag_names(tags_path: Path) -> dict[str, str]:
    tag_names: dict[str, str] = {}
    with tags_path.open(newline="", encoding="utf-8") as file:
        for row in csv.DictReader(file):
            tag_id = clean_value(row.get("tag_id"))
            tag_name = clean_value(row.get("tag_name"))
            if tag_id and tag_name:
                tag_names[tag_id] = tag_name
    return tag_names


def build_work_tags(
    book_tags_path: Path,
    tag_names: dict[str, str],
    book_work_map: dict[str, str],
    top_tags: int,
) -> dict[str, list[str]]:
    if top_tags == 0:
        return {}

    tag_counts: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))

    with book_tags_path.open(newline="", encoding="utf-8") as file:
        for row in csv.DictReader(file):
            book_id = clean_value(row.get("goodreads_book_id"))
            tag_id = clean_value(row.get("tag_id"))
            count = parse_int(row.get("count"))
            work_id = book_work_map.get(book_id)
            tag_name = tag_names.get(tag_id)

            if not work_id or not tag_name or count is None:
                continue
            tag_counts[work_id][tag_name] += count

    work_tags: dict[str, list[str]] = {}
    for work_id, counts in tag_counts.items():
        ranked_tags = sorted(counts.items(), key=lambda item: (-item[1], item[0]))
        work_tags[work_id] = [tag_name for tag_name, _ in ranked_tags[:top_tags]]

    return work_tags


def iter_interaction_rows(
    interactions: dict[tuple[str, str], tuple[float, int]],
) -> Iterable[dict[str, str]]:
    for (user_id, work_id), (total, count) in sorted(
        interactions.items(),
        key=lambda item: (int_or_text(item[0][0]), int_or_text(item[0][1])),
    ):
        yield {
            "user_id": user_id,
            "work_id": work_id,
            "book_id": work_id,
            "rating": format_float(total / count),
        }


def iter_feature_rows(
    book_features: dict[str, dict[str, str]],
    work_tags: dict[str, list[str]],
) -> Iterable[dict[str, str]]:
    for work_id, row in sorted(book_features.items(), key=lambda item: int_or_text(item[0])):
        result = dict(row)
        tags = "|".join(work_tags.get(work_id, []))
        result["book_id"] = work_id
        result["book_title"] = result.get("title", "")
        result["author"] = result.get("authors", "")
        result["avg_star"] = result.get("average_rating", "")
        result["num_rating"] = result.get("total_ratings_count", "")
        result["image_path"] = result.get("image_url", "")
        result["tags"] = tags
        result["genre"] = tags
        yield result


def write_csv_dataset(
    output_dir: Path,
    fieldnames: list[str],
    rows: Iterable[dict[str, str]],
) -> None:
    temp_dir = output_dir.with_name(f".{output_dir.name}.tmp")
    if temp_dir.exists():
        shutil.rmtree(temp_dir)
    temp_dir.mkdir(parents=True, exist_ok=True)

    output_file = temp_dir / "part-00000.csv"
    with output_file.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    (temp_dir / "_SUCCESS").touch()

    if output_dir.exists():
        shutil.rmtree(output_dir)
    temp_dir.replace(output_dir)


def clean_value(value: object) -> str:
    if value is None:
        return ""
    return str(value).strip()


def first_text(*values: object) -> str:
    for value in values:
        text = clean_value(value)
        if text:
            return text
    return ""


def clean_year(value: object) -> str:
    text = clean_value(value)
    if text.endswith(".0"):
        return text[:-2]
    return text


def parse_float(value: object) -> float | None:
    try:
        return float(clean_value(value))
    except ValueError:
        return None


def parse_int(value: object) -> int | None:
    try:
        return int(float(clean_value(value)))
    except ValueError:
        return None


def format_float(value: float) -> str:
    text = f"{value:.4f}".rstrip("0").rstrip(".")
    return text if "." in text else f"{text}.0"


def int_or_text(value: str) -> int | str:
    try:
        return int(value)
    except ValueError:
        return value


if __name__ == "__main__":
    main()
