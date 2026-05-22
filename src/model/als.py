"""Spark ALS recommender for transformed Goodreads ratings.

``src/transform.py`` produces the two datasets this module uses:

* ``data/interactions_dataset`` with ``user_id,work_id,book_id,rating``.
* ``data/book_features_dataset`` with book metadata keyed by ``work_id``.

The ALS model trains on integer ``user_id`` and ``work_id`` values, then joins
recommendations back to the transformed book metadata.
"""

from __future__ import annotations

from dataclasses import dataclass, field
import math
from pathlib import Path
from typing import Any, Iterable, Optional


DEFAULT_INTERACTIONS_PATH = "data/interactions_dataset"
DEFAULT_METADATA_PATH = "data/book_features_dataset"
DEFAULT_PARQUET_PATH = "data/final_ratings_parquet"
DEFAULT_METADATA_COLS = (
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


def _require_pyspark() -> dict[str, Any]:
    """Import PySpark objects only when ALS functionality is used."""
    try:
        from pyspark.ml.evaluation import RegressionEvaluator
        from pyspark.ml.recommendation import ALS, ALSModel
        from pyspark.sql import SparkSession
        from pyspark.sql.functions import col, explode, posexplode, row_number, udf
        from pyspark.sql.window import Window
    except ImportError as exc:
        raise ImportError(
            "PySpark is required for ALSBookRecommender. "
            "Install it with `pip install pyspark` or from requirements.txt."
        ) from exc

    return {
        "ALS": ALS,
        "ALSModel": ALSModel,
        "RegressionEvaluator": RegressionEvaluator,
        "SparkSession": SparkSession,
        "col": col,
        "explode": explode,
        "posexplode": posexplode,
        "row_number": row_number,
        "udf": udf,
        "Window": Window,
    }


def create_spark_session(
    app_name: str = "BookRecommenderALS",
    master: str = "local[*]",
    executor_memory: str = "8g",
) -> Any:
    """Create a Spark session using the same local setup as the notebook."""
    spark_objects = _require_pyspark()
    spark_session = spark_objects["SparkSession"]

    return (
        spark_session.builder.appName(app_name)
        .master(master)
        .config("spark.executor.memory", executor_memory)
        .getOrCreate()
    )


def resolve_data_path(path: str | Path) -> str:
    """Resolve project-relative data paths, including old notebook locations."""
    input_path = Path(path)
    if input_path.exists():
        return str(input_path)

    notebook_path = Path("test_code") / input_path
    if notebook_path.exists():
        return str(notebook_path)

    return str(input_path)


def resolve_parquet_path(path: str | Path = DEFAULT_PARQUET_PATH) -> str:
    """Compatibility alias for old parquet-based callers."""
    return resolve_data_path(path)


@dataclass
class ALSBookRecommender:
    """Train and serve book recommendations with Spark ALS."""

    spark: Any
    user_col: str = "user_id"
    item_col: str = "work_id"
    rating_col: str = "rating"
    metadata_cols: Iterable[str] = DEFAULT_METADATA_COLS
    rank: int = 2
    max_iter: int = 10
    reg_param: float = 0.1
    nonnegative: bool = True
    cold_start_strategy: str = "drop"

    ratings_df: Optional[Any] = field(default=None, init=False)
    books_meta_df: Optional[Any] = field(default=None, init=False)
    training_df: Optional[Any] = field(default=None, init=False)
    test_df: Optional[Any] = field(default=None, init=False)
    model: Optional[Any] = field(default=None, init=False)

    def __post_init__(self) -> None:
        self.metadata_cols = tuple(self.metadata_cols)

    def load_data(
        self,
        interactions_path: str | Path = DEFAULT_INTERACTIONS_PATH,
        metadata_path: str | Path = DEFAULT_METADATA_PATH,
    ) -> Any:
        """Load transformed interactions and book metadata."""
        interactions = self._read_dataset(interactions_path)
        metadata = self._read_dataset(metadata_path)
        self.ratings_df = self._prepare_ratings(interactions)
        self.books_meta_df = self._prepare_metadata(metadata)
        return self.ratings_df

    def load_interactions(self, interactions_path: str | Path = DEFAULT_INTERACTIONS_PATH) -> Any:
        """Load only transformed ratings data."""
        interactions = self._read_dataset(interactions_path)
        self.ratings_df = self._prepare_ratings(interactions)
        return self.ratings_df

    def load_metadata(self, metadata_path: str | Path = DEFAULT_METADATA_PATH) -> Any:
        """Load only transformed book metadata."""
        metadata = self._read_dataset(metadata_path)
        self.books_meta_df = self._prepare_metadata(metadata)
        return self.books_meta_df

    def train_test_split(
        self,
        train_ratio: float = 0.7,
        test_ratio: float = 0.3,
        seed: int = 42,
    ) -> tuple[Any, Any]:
        """Split loaded data with the notebook's default 70/30 ratio."""
        if self.ratings_df is None:
            raise ValueError("No ratings data loaded. Call load_data() first.")

        self.training_df, self.test_df = self.ratings_df.randomSplit(
            [train_ratio, test_ratio],
            seed=seed,
        )
        return self.training_df, self.test_df

    def fit(self, training_df: Optional[Any] = None) -> Any:
        """Train the ALS model with notebook-equivalent defaults."""
        spark_objects = _require_pyspark()
        als_cls = spark_objects["ALS"]

        if training_df is not None:
            training = training_df
        elif self.training_df is not None:
            training = self.training_df
        else:
            training = self.ratings_df

        if training is None:
            raise ValueError("No training data available. Call load_data() first.")

        als = als_cls(
            maxIter=self.max_iter,
            regParam=self.reg_param,
            rank=self.rank,
            userCol=self.user_col,
            itemCol=self.item_col,
            ratingCol=self.rating_col,
            coldStartStrategy=self.cold_start_strategy,
            nonnegative=self.nonnegative,
        )
        self.model = als.fit(training)
        return self.model

    def evaluate(self, test_df: Optional[Any] = None) -> float:
        """Return RMSE for the trained model."""
        spark_objects = _require_pyspark()
        evaluator_cls = spark_objects["RegressionEvaluator"]

        if self.model is None:
            raise ValueError("No trained model available. Call fit() first.")

        test = test_df if test_df is not None else self.test_df
        if test is None:
            raise ValueError("No test data available. Call train_test_split() first.")

        predictions = self.model.transform(test)
        evaluator = evaluator_cls(
            metricName="rmse",
            labelCol=self.rating_col,
            predictionCol="prediction",
        )
        return float(evaluator.evaluate(predictions))

    def recommend_for_all_users(self, num_items: int = 3) -> Any:
        """Recommend books for every user and join title/author metadata."""
        spark_objects = _require_pyspark()
        col = spark_objects["col"]
        posexplode = spark_objects["posexplode"]

        if self.model is None:
            raise ValueError("No trained model available. Call fit() first.")
        if self.books_meta_df is None:
            raise ValueError("No book metadata available. Call load_data() first.")

        user_recs = self.model.recommendForAllUsers(num_items)
        recs_exploded = user_recs.select(
            col(self.user_col),
            posexplode("recommendations").alias("pos", "rec"),
        )
        recs_parsed = recs_exploded.select(
            col(self.user_col),
            col(f"rec.{self.item_col}").alias(self.item_col),
            col("rec.rating").alias("pred_rating"),
            (col("pos") + 1).alias("rank"),
        )

        return recs_parsed.join(self.books_meta_df, on=self.item_col, how="left")

    def recommend_for_user(
        self,
        user_id: int,
        num_items: int = 10,
        exclude_seen: bool = True,
    ) -> Any:
        """Recommend books for one user.

        If ``exclude_seen`` is true, candidate books already rated by the user are
        removed before scoring.
        """
        spark_objects = _require_pyspark()
        col = spark_objects["col"]

        if self.model is None:
            raise ValueError("No trained model available. Call fit() first.")
        if self.ratings_df is None or self.books_meta_df is None:
            raise ValueError("No ratings data loaded. Call load_data() first.")

        user_df = self.spark.createDataFrame([(int(user_id),)], [self.user_col])

        if exclude_seen:
            seen_df = self.ratings_df.filter(col(self.user_col) == int(user_id)).select(
                self.item_col
            )
            candidates = self.books_meta_df.select(self.item_col).join(
                seen_df,
                on=self.item_col,
                how="left_anti",
            )
            pairs = user_df.crossJoin(candidates)
            scored = self.model.transform(pairs).dropna(subset=["prediction"])
            recs = (
                scored.orderBy(col("prediction").desc())
                .limit(num_items)
                .withColumnRenamed("prediction", "pred_rating")
            )
        else:
            recs = self.model.recommendForUserSubset(user_df, num_items)
            recs = self._explode_user_recs(recs)

        return recs.join(self.books_meta_df, on=self.item_col, how="left")

    def recommend_similar_items(
        self,
        item_id: int | str,
        num_items: int = 10,
        exclude_items: Optional[Iterable[int | str]] = None,
    ) -> Any:
        """Recommend books similar to one purchased item using ALS item factors."""
        spark_objects = _require_pyspark()
        col = spark_objects["col"]
        row_number = spark_objects["row_number"]
        udf = spark_objects["udf"]
        window_cls = spark_objects["Window"]

        if self.model is None:
            raise ValueError("No trained model available. Call fit() first.")
        if self.books_meta_df is None:
            raise ValueError("No book metadata available. Call load_metadata() first.")

        try:
            normalized_item_id = int(item_id)
        except (TypeError, ValueError) as exc:
            raise ValueError("item_id must be an integer.") from exc

        if num_items <= 0:
            raise ValueError("num_items must be greater than zero.")

        target_rows = (
            self.model.itemFactors.filter(col("id") == normalized_item_id)
            .select("features")
            .limit(1)
            .collect()
        )
        if not target_rows:
            raise KeyError(f"Unknown item id: {normalized_item_id}")

        target_features = [float(value) for value in target_rows[0]["features"]]
        target_norm = math.sqrt(sum(value * value for value in target_features))
        if target_norm == 0:
            raise ValueError(f"Item id has an empty ALS factor vector: {normalized_item_id}")

        def cosine_similarity(features: Iterable[float] | None) -> float | None:
            if features is None:
                return None

            values = [float(value) for value in features]
            norm = math.sqrt(sum(value * value for value in values))
            if norm == 0:
                return None

            dot_product = sum(
                target_value * value
                for target_value, value in zip(target_features, values)
            )
            return float(dot_product / (target_norm * norm))

        similarity_udf = udf(cosine_similarity, "double")
        excluded_ids = {normalized_item_id}
        if exclude_items is not None:
            for value in exclude_items:
                try:
                    excluded_ids.add(int(value))
                except (TypeError, ValueError):
                    continue

        candidates = self.model.itemFactors.filter(~col("id").isin(sorted(excluded_ids)))
        scored = (
            candidates.withColumn("similarity_score", similarity_udf(col("features")))
            .dropna(subset=["similarity_score"])
            .select(col("id").alias(self.item_col), col("similarity_score"))
            .orderBy(col("similarity_score").desc(), col(self.item_col).asc())
            .limit(num_items)
        )
        ranked = scored.withColumn(
            "rank",
            row_number().over(
                window_cls.orderBy(col("similarity_score").desc(), col(self.item_col).asc())
            ),
        )

        return ranked.join(self.books_meta_df, on=self.item_col, how="left")

    def save_model(self, path: str | Path, overwrite: bool = True) -> None:
        """Persist the trained Spark ALS model."""
        if self.model is None:
            raise ValueError("No trained model available. Call fit() first.")

        writer = self.model.write()
        if overwrite:
            writer = writer.overwrite()
        writer.save(str(path))

    def write_user_recommendations(
        self,
        path: str | Path = "data/user_recommendations",
        num_items: int = 10,
        output_format: str = "parquet",
        mode: str = "overwrite",
    ) -> Any:
        """Write precomputed user recommendations for the FastAPI service."""
        recommendations = self.recommend_for_all_users(num_items)
        writer = recommendations.write.mode(mode)
        normalized_format = output_format.lower()

        if normalized_format == "parquet":
            writer.parquet(str(path))
        elif normalized_format == "csv":
            writer.option("header", True).csv(str(path))
        elif normalized_format == "json":
            writer.json(str(path))
        else:
            raise ValueError(f"Unsupported recommendations output format: {output_format}")

        return recommendations

    def load_model(self, path: str | Path) -> Any:
        """Load a persisted Spark ALS model."""
        spark_objects = _require_pyspark()
        als_model_cls = spark_objects["ALSModel"]

        self.model = als_model_cls.load(str(path))
        return self.model

    def train_from_parquet(
        self,
        parquet_path: str | Path = DEFAULT_PARQUET_PATH,
        train_ratio: float = 0.7,
        test_ratio: float = 0.3,
        seed: int = 42,
    ) -> float:
        """Compatibility wrapper for old single-parquet rating exports."""
        df = self._read_dataset(parquet_path)
        self.ratings_df = self._prepare_ratings(df)
        self.books_meta_df = self._prepare_metadata(df)
        self.train_test_split(train_ratio=train_ratio, test_ratio=test_ratio, seed=seed)
        self.fit()
        return self.evaluate()

    def train_from_transform_output(
        self,
        interactions_path: str | Path = DEFAULT_INTERACTIONS_PATH,
        metadata_path: str | Path = DEFAULT_METADATA_PATH,
        train_ratio: float = 0.7,
        test_ratio: float = 0.3,
        seed: int = 42,
    ) -> float:
        """Load transformed datasets, split, train, and return RMSE."""
        self.load_data(interactions_path, metadata_path)
        self.train_test_split(train_ratio=train_ratio, test_ratio=test_ratio, seed=seed)
        self.fit()
        return self.evaluate()

    def _read_dataset(self, path: str | Path) -> Any:
        resolved_path = Path(resolve_data_path(path))
        if not resolved_path.exists():
            raise FileNotFoundError(f"Data path does not exist: {resolved_path}")

        if resolved_path.is_file():
            suffix = resolved_path.suffix.lower()
            if suffix in {".parquet", ".pq"}:
                return self.spark.read.parquet(str(resolved_path))
            if suffix == ".csv":
                return self.spark.read.option("header", True).csv(str(resolved_path))
            raise ValueError(f"Unsupported data file type: {resolved_path}")

        parquet_files = list(resolved_path.glob("*.parquet"))
        if parquet_files:
            return self.spark.read.parquet(str(resolved_path))

        csv_files = list(resolved_path.glob("*.csv"))
        if csv_files:
            return self.spark.read.option("header", True).csv(str(resolved_path))

        raise FileNotFoundError(f"No readable .csv or .parquet files found in {resolved_path}")

    def _prepare_ratings(self, df: Any) -> Any:
        source_item_col = self._source_item_column(df)
        missing = [
            column
            for column in (self.user_col, self.rating_col)
            if column not in df.columns
        ]
        if missing:
            raise ValueError(f"Ratings data is missing columns: {', '.join(missing)}")

        return (
            df.select(
                self._col(self.user_col).cast("integer").alias(self.user_col),
                self._col(source_item_col).cast("integer").alias(self.item_col),
                self._col(self.rating_col).cast("float").alias(self.rating_col),
            )
            .dropna(subset=[self.user_col, self.item_col, self.rating_col])
            .dropDuplicates()
        )

    def _prepare_metadata(self, df: Any) -> Any:
        source_item_col = self._source_item_column(df)

        selected_columns = [self._col(source_item_col).cast("integer").alias(self.item_col)]
        selected_columns.extend(
            self._col(name)
            for name in self.metadata_cols
            if name in df.columns and name not in {self.item_col, source_item_col}
        )
        return df.select(*selected_columns).dropna(subset=[self.item_col]).dropDuplicates(
            [self.item_col]
        )

    def _source_item_column(self, df: Any) -> str:
        if self.item_col in df.columns:
            return self.item_col
        if self.item_col == "work_id" and "book_id" in df.columns:
            return "book_id"
        if self.item_col == "book_id" and "work_id" in df.columns:
            return "work_id"
        raise ValueError(f"Data is missing item column: {self.item_col}")

    def _col(self, column_name: str) -> Any:
        spark_objects = _require_pyspark()
        return spark_objects["col"](column_name)

    def _explode_user_recs(self, user_recs_df: Any) -> Any:
        spark_objects = _require_pyspark()
        col = spark_objects["col"]
        explode = spark_objects["explode"]

        return (
            user_recs_df.select(
                col(self.user_col),
                explode("recommendations").alias("rec"),
            )
            .select(
                col(self.user_col),
                col(f"rec.{self.item_col}").alias(self.item_col),
                col("rec.rating").alias("pred_rating"),
            )
        )


def train_als_from_notebook_data(
    spark: Optional[Any] = None,
    parquet_path: str | Path = DEFAULT_PARQUET_PATH,
    top_k: int = 3,
) -> tuple[ALSBookRecommender, float, Any]:
    """Compatibility wrapper for the old notebook parquet workflow."""
    active_spark = spark or create_spark_session()
    recommender = ALSBookRecommender(active_spark)
    rmse = recommender.train_from_parquet(parquet_path)
    recommendations = recommender.recommend_for_all_users(top_k)
    return recommender, rmse, recommendations


def train_als_from_transform_output(
    spark: Optional[Any] = None,
    interactions_path: str | Path = DEFAULT_INTERACTIONS_PATH,
    metadata_path: str | Path = DEFAULT_METADATA_PATH,
    top_k: int = 3,
) -> tuple[ALSBookRecommender, float, Any]:
    """Run the transformed-data ALS workflow."""
    active_spark = spark or create_spark_session()
    recommender = ALSBookRecommender(active_spark)
    rmse = recommender.train_from_transform_output(interactions_path, metadata_path)
    recommendations = recommender.recommend_for_all_users(top_k)
    return recommender, rmse, recommendations


def export_user_recommendations_from_transform_output(
    spark: Optional[Any] = None,
    interactions_path: str | Path = DEFAULT_INTERACTIONS_PATH,
    metadata_path: str | Path = DEFAULT_METADATA_PATH,
    output_path: str | Path = "data/user_recommendations",
    top_k: int = 10,
    output_format: str = "parquet",
) -> tuple[ALSBookRecommender, float, Any]:
    """Train ALS and export the local recommendations table used by FastAPI."""
    active_spark = spark or create_spark_session()
    recommender = ALSBookRecommender(active_spark)
    rmse = recommender.train_from_transform_output(interactions_path, metadata_path)
    recommendations = recommender.write_user_recommendations(
        output_path,
        num_items=top_k,
        output_format=output_format,
    )
    return recommender, rmse, recommendations


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Train Spark ALS book recommender.")
    parser.add_argument("--interactions", default=DEFAULT_INTERACTIONS_PATH)
    parser.add_argument("--metadata", default=DEFAULT_METADATA_PATH)
    parser.add_argument("--top-k", type=int, default=10)
    parser.add_argument("--user-id", type=int)
    parser.add_argument("--save-model")
    parser.add_argument("--output", default="data/user_recommendations")
    parser.add_argument("--format", default="parquet", choices=("parquet", "csv", "json"))
    args = parser.parse_args()

    spark_session = create_spark_session()
    als_recommender = ALSBookRecommender(spark_session)
    score = als_recommender.train_from_transform_output(args.interactions, args.metadata)
    print(f"RMSE = {score:.4f}")

    if args.save_model:
        als_recommender.save_model(args.save_model)

    if args.user_id is not None:
        als_recommender.recommend_for_user(args.user_id, args.top_k).show(
            truncate=False
        )
    else:
        recommendations = als_recommender.write_user_recommendations(
            args.output,
            num_items=args.top_k,
            output_format=args.format,
        )
        display_columns = [
            column
            for column in ("user_id", "work_id", "rank", "title", "book_title", "authors", "author", "pred_rating")
            if column in recommendations.columns
        ]
        recommendations.select(*display_columns).sort(
            "user_id",
            "rank",
            ascending=[True, True],
        ).show(
            10,
            truncate=False,
        )
        print(f"Wrote user recommendations to {args.output} ({args.format}).")
