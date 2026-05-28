from __future__ import annotations

import argparse
import csv
from datetime import datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any, Iterable

import pymssql


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DATA_DIR = ROOT / "database_data"
DEFAULT_SERVER = "127.0.0.1"
DEFAULT_PORT = 1433
DEFAULT_DATABASE = "BookRecDb"
DEFAULT_USER = "sa"
DEFAULT_PASSWORD = "BookRec!Passw0rd"
BATCH_SIZE = 500


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle, delimiter=";", quotechar='"'))


def blank_to_none(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value)
    if text == "" or text.upper() == "NULL":
        return None
    return text


def required_text(value: Any, default: str = "") -> str:
    return blank_to_none(value) or default


def to_int(value: Any, default: int = 0) -> int:
    text = blank_to_none(value)
    if text is None:
        return default
    try:
        return int(float(text.replace(",", ".")))
    except ValueError:
        return default


def to_float(value: Any, default: float | None = None) -> float | None:
    text = blank_to_none(value)
    if text is None:
        return default
    try:
        return float(text.replace(",", "."))
    except ValueError:
        return default


def to_decimal(value: Any, default: Decimal = Decimal("0")) -> Decimal:
    text = blank_to_none(value)
    if text is None:
        return default
    try:
        return Decimal(text.replace(",", "."))
    except InvalidOperation:
        return default


def to_datetime(value: Any) -> datetime | None:
    text = blank_to_none(value)
    if text is None:
        return None
    if "." in text:
        head, fraction = text.split(".", 1)
        text = f"{head}.{fraction[:6]}"
    for fmt in ("%Y-%m-%d %H:%M:%S.%f", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(text, fmt)
        except ValueError:
            continue
    raise ValueError(f"Invalid datetime: {text}")


def batched(rows: list[tuple[Any, ...]], size: int = BATCH_SIZE) -> Iterable[list[tuple[Any, ...]]]:
    for start in range(0, len(rows), size):
        yield rows[start : start + size]


def execute_many(cursor: Any, sql: str, rows: list[tuple[Any, ...]], label: str) -> None:
    inserted = 0
    for batch in batched(rows):
        cursor.executemany(sql, batch)
        inserted += len(batch)
        print(f"{label}: {inserted}/{len(rows)}")


def book_tuple(row: dict[str, str]) -> tuple[Any, ...]:
    return (
        required_text(row["book_id"]),
        required_text(row.get("authors")),
        to_float(row.get("original_publication_year")),
        required_text(row.get("original_title")),
        required_text(row.get("language_code")),
        required_text(row.get("tags"), "[]"),
        to_int(row.get("ratings_1")),
        to_int(row.get("ratings_2")),
        to_int(row.get("ratings_3")),
        to_int(row.get("ratings_4")),
        to_int(row.get("ratings_5")),
        required_text(row.get("image_url")),
        required_text(row.get("small_image_url")),
        to_decimal(row.get("price")),
        blank_to_none(row.get("mood")),
        blank_to_none(row.get("badge")),
        blank_to_none(row.get("description")),
        blank_to_none(row.get("longDescription")),
        to_int(row.get("pages")),
        to_int(row.get("readTime")),
        blank_to_none(row.get("status")),
        to_int(row.get("chapters")),
        blank_to_none(row.get("previewText")),
        blank_to_none(row.get("accentColor")),
        required_text(row.get("badges"), "[]"),
        to_int(row.get("views_7d")),
        to_int(row.get("favorite_7d")),
        to_int(row.get("purchases_7d")),
        to_int(row.get("views_30d")),
        to_int(row.get("favorite_30d")),
        to_int(row.get("purchases_30d")),
        to_int(row.get("total_ratings")),
        to_float(row.get("average_rating"), 0.0),
    )


def user_tuple(row: dict[str, str]) -> tuple[Any, ...]:
    return (
        required_text(row["user_id"]),
        required_text(row.get("user_name")),
        required_text(row.get("email")),
        required_text(row.get("hashed_password")),
        required_text(row.get("full_name")),
        required_text(row.get("role"), "User"),
        blank_to_none(row.get("sex")),
        to_decimal(row.get("current_balance")),
    )


def review_tuple(row: dict[str, str]) -> tuple[Any, ...]:
    return (
        required_text(row["id"]),
        required_text(row["user_id"]),
        required_text(row["book_id"]),
        required_text(row.get("review")),
        to_datetime(row.get("time")) or datetime.utcnow(),
    )


def tracking_tuple(row: dict[str, str]) -> tuple[Any, ...]:
    return (
        required_text(row["id"]),
        required_text(row["user_id"]),
        required_text(row.get("event_type")),
        required_text(row["book_id"]),
        to_datetime(row.get("created_at")) or datetime.utcnow(),
    )


def userbook_tuple(row: dict[str, str]) -> tuple[Any, ...]:
    return (
        required_text(row["id"]),
        required_text(row["book_id"]),
        required_text(row["user_id"]),
        to_decimal(row.get("purchase_price")),
        to_datetime(row.get("purchase_date")) or datetime.utcnow(),
        to_int(row.get("current_chapter")),
        to_datetime(row.get("last_read_at")),
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Replace BookRecDb data from database_data CSV files.")
    parser.add_argument("--data-dir", type=Path, default=DEFAULT_DATA_DIR)
    parser.add_argument("--server", default=DEFAULT_SERVER)
    parser.add_argument("--port", type=int, default=DEFAULT_PORT)
    parser.add_argument("--database", default=DEFAULT_DATABASE)
    parser.add_argument("--user", default=DEFAULT_USER)
    parser.add_argument("--password", default=DEFAULT_PASSWORD)
    args = parser.parse_args()

    data_dir = args.data_dir.resolve()
    files = {
        "books": data_dir / "books.csv",
        "users": data_dir / "users.csv",
        "reviews": data_dir / "reviews.csv",
        "tracking": data_dir / "tracking.csv",
        "userbooks": data_dir / "userbooks.csv",
    }
    missing = [str(path) for path in files.values() if not path.exists()]
    if missing:
        raise FileNotFoundError(f"Missing CSV files: {missing}")

    books = [book_tuple(row) for row in read_csv(files["books"])]
    users = [user_tuple(row) for row in read_csv(files["users"])]
    reviews = [review_tuple(row) for row in read_csv(files["reviews"])]
    tracking_events = [tracking_tuple(row) for row in read_csv(files["tracking"])]
    userbooks = [userbook_tuple(row) for row in read_csv(files["userbooks"])]

    conn = pymssql.connect(
        server=args.server,
        port=args.port,
        user=args.user,
        password=args.password,
        database=args.database,
        login_timeout=10,
        timeout=60,
    )
    conn.autocommit(False)

    try:
        cursor = conn.cursor()
        for table in ("Wishlists", "UserBooks", "TrackingEvents", "Reviews", "Ratings", "Users", "Books"):
            cursor.execute(f"DELETE FROM dbo.{table}")

        execute_many(
            cursor,
            """
            INSERT INTO dbo.Books (
                book_id, authors, original_publication_year, original_title,
                language_code, tags, ratings_1, ratings_2, ratings_3, ratings_4, ratings_5,
                image_url, small_image_url, price,
                mood, badge, description, longDescription, pages, readTime,
                status, chapters, previewText, accentColor, badges,
                views_7d, favorite_7d, purchases_7d,
                views_30d, favorite_30d, purchases_30d,
                total_ratings, average_rating
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            books,
            "Books",
        )
        execute_many(
            cursor,
            """
            INSERT INTO dbo.Users (
                user_id, user_name, email, hashed_password, full_name, role, sex, current_balance
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """,
            users,
            "Users",
        )
        execute_many(
            cursor,
            "INSERT INTO dbo.Reviews (id, user_id, book_id, review, [time]) VALUES (%s, %s, %s, %s, %s)",
            reviews,
            "Reviews",
        )
        execute_many(
            cursor,
            "INSERT INTO dbo.TrackingEvents (id, user_id, event_type, book_id, created_at) VALUES (%s, %s, %s, %s, %s)",
            tracking_events,
            "TrackingEvents",
        )
        execute_many(
            cursor,
            """
            INSERT INTO dbo.UserBooks (
                id, book_id, user_id, purchase_price, purchase_date, current_chapter, last_read_at
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            """,
            userbooks,
            "UserBooks",
        )

        conn.commit()

        cursor.execute(
            """
            SELECT 'Books', COUNT(*) FROM dbo.Books
            UNION ALL SELECT 'Users', COUNT(*) FROM dbo.Users
            UNION ALL SELECT 'Reviews', COUNT(*) FROM dbo.Reviews
            UNION ALL SELECT 'TrackingEvents', COUNT(*) FROM dbo.TrackingEvents
            UNION ALL SELECT 'UserBooks', COUNT(*) FROM dbo.UserBooks
            UNION ALL SELECT 'Ratings', COUNT(*) FROM dbo.Ratings
            UNION ALL SELECT 'Wishlists', COUNT(*) FROM dbo.Wishlists
            ORDER BY 1
            """
        )
        print("Final counts:")
        for table_name, count in cursor.fetchall():
            print(f"  {table_name}: {count}")
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    main()
