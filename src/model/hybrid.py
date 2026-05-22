"""Hybrid book recommender combining TF-IDF cold-start and ALS warm-user ranking."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional

import pandas as pd

from src.model.als import (
    DEFAULT_INTERACTIONS_PATH,
    DEFAULT_METADATA_PATH,
    ALSBookRecommender,
    create_spark_session,
)
from src.model.tf_idf import (
    DEFAULT_DATA_PATH,
    ContentBasedRecommender,
    train_from_transform_output,
)


DEFAULT_SEED = 42
DEFAULT_TEST_SIZE = 0.7


@dataclass
class HybridBookRecommender:
    """Route cold-start users to TF-IDF and known users to ALS."""

    content_recommender: ContentBasedRecommender
    als_recommender: Optional[ALSBookRecommender] = None

    def recommend(
        self,
        user_id: Optional[int | str] = None,
        item_id: Optional[int | str] = None,
        query: Optional[str] = None,
        top_k: int = 10,
    ) -> Any:
        """Return recommendations for a user or cold-start context.

        Known users with ratings use ALS first. Cold-start users, missing ALS
        models, and empty/failed ALS results fall back to TF-IDF when an
        ``item_id`` or ``query`` is available.
        """
        if top_k <= 0:
            raise ValueError("top_k must be greater than 0.")

        has_fallback_input = item_id is not None or bool(query and query.strip())
        if self._can_use_als() and self.has_user_behavior(user_id):
            try:
                als_results = self.als_recommender.recommend_for_user(
                    self._coerce_user_id(user_id),
                    num_items=top_k,
                )
                if self._has_results(als_results) or not has_fallback_input:
                    return als_results
            except Exception:
                if not has_fallback_input:
                    raise

        return self._recommend_with_content(item_id=item_id, query=query, top_k=top_k)

    def has_user_behavior(self, user_id: Optional[int | str]) -> bool:
        """Return True when ALS ratings contain behavior for ``user_id``."""
        if user_id is None or self.als_recommender is None:
            return False

        ratings_df = getattr(self.als_recommender, "ratings_df", None)
        if ratings_df is None:
            return False

        user_col = getattr(self.als_recommender, "user_col", "user_id")
        if isinstance(ratings_df, pd.DataFrame):
            if user_col not in ratings_df.columns:
                return False
            return bool(ratings_df[user_col].astype(str).eq(str(user_id)).any())

        columns = getattr(ratings_df, "columns", ())
        if user_col not in columns:
            return False

        try:
            user_value = self._coerce_user_id(user_id)
            return bool(ratings_df.filter(ratings_df[user_col] == user_value).limit(1).count())
        except Exception:
            return False

    def _can_use_als(self) -> bool:
        if self.als_recommender is None:
            return False
        return (
            getattr(self.als_recommender, "model", None) is not None
            and hasattr(self.als_recommender, "recommend_for_user")
        )

    def _recommend_with_content(
        self,
        item_id: Optional[int | str],
        query: Optional[str],
        top_k: int,
    ) -> pd.DataFrame:
        if item_id is not None:
            return self.content_recommender.recommend(item_id, top_k=top_k)
        if query and query.strip():
            return self.content_recommender.recommend_by_text(query, top_k=top_k)
        raise ValueError("Cold-start recommendations require item_id or query.")

    @staticmethod
    def _has_results(results: Any) -> bool:
        if results is None:
            return False
        if isinstance(results, pd.DataFrame):
            return not results.empty
        if isinstance(results, (list, tuple, set, dict)):
            return bool(results)
        try:
            return bool(results.limit(1).count())
        except Exception:
            return True

    @staticmethod
    def _coerce_user_id(user_id: int | str | None) -> int | str:
        if user_id is None:
            raise ValueError("user_id is required for ALS recommendations.")
        try:
            return int(user_id)
        except (TypeError, ValueError):
            return user_id


def train_hybrid_from_paths(
    content_path: str | Path = DEFAULT_DATA_PATH,
    interactions_path: str | Path = DEFAULT_INTERACTIONS_PATH,
    metadata_path: str | Path = DEFAULT_METADATA_PATH,
    *,
    spark: Any = None,
    seed: int = DEFAULT_SEED,
    test_size: float = DEFAULT_TEST_SIZE,
    train_als: bool = True,
    content_max_features: int = 5000,
) -> HybridBookRecommender:
    """Train TF-IDF and optionally ALS from transformed project datasets."""
    if not 0 < test_size < 1:
        raise ValueError("test_size must be between 0 and 1.")

    content_recommender = train_from_transform_output(
        content_path,
        max_features=content_max_features,
    )

    als_recommender = None
    if train_als:
        active_spark = spark or create_spark_session()
        als_recommender = ALSBookRecommender(active_spark)
        als_recommender.load_data(interactions_path, metadata_path)
        als_recommender.train_test_split(
            train_ratio=1 - test_size,
            test_ratio=test_size,
            seed=seed,
        )
        als_recommender.fit()

    return HybridBookRecommender(
        content_recommender=content_recommender,
        als_recommender=als_recommender,
    )
