from __future__ import annotations

import pickle
from pathlib import Path
from typing import Any, Optional
from uuid import UUID

import numpy as np
import pandas as pd
from scipy import sparse
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import linear_kernel


def normalize_uuid(value: Any) -> str:
    """Return the canonical lowercase representation of a UUID value."""
    return str(UUID(str(value)))


def _normalize_serving_id(value: Any) -> str:
    try:
        return normalize_uuid(value)
    except (TypeError, ValueError, AttributeError):
        return str(value)


class _LegacyTfidfArtifact:
    """Unpickle old artifacts without importing the training module."""


class _ServingUnpickler(pickle.Unpickler):
    def find_class(self, module: str, name: str) -> Any:
        if module == "book_rec_api.serving" and name in {
            "ALSServingModel",
            "TfidfServingModel",
        }:
            return globals()[name]
        if module.endswith(".tf_idf") and name == "ContentBasedRecommender":
            return _LegacyTfidfArtifact
        return super().find_class(module, name)


def _load_pickle(path: str | Path) -> Any:
    with Path(path).open("rb") as artifact_file:
        return _ServingUnpickler(artifact_file).load()


class ALSServingModel:
    """ALS serving model backed by precomputed recommendations."""

    ARTIFACT_VERSION = 3

    def __init__(
        self,
        recommendations: pd.DataFrame,
        fallback_items: pd.DataFrame | None = None,
        metadata: dict[str, Any] | None = None,
        artifact_version: int = ARTIFACT_VERSION,
    ) -> None:
        self.recommendations = recommendations.copy()
        self.fallback_items = (
            fallback_items.copy() if fallback_items is not None else None
        )
        self.metadata = dict(metadata or {})
        self.artifact_version = int(artifact_version)
        for column, default in (("book_title", ""), ("author", "")):
            if column not in self.recommendations.columns:
                self.recommendations[column] = default
            if self.fallback_items is not None and column not in self.fallback_items.columns:
                self.fallback_items[column] = default
        if "source" not in self.recommendations.columns:
            self.recommendations["source"] = "als"
        if self.fallback_items is not None and "source" not in self.fallback_items.columns:
            self.fallback_items["source"] = "popular_fallback"

        for column in ("user_id", "book_id", "work_id"):
            if column in self.recommendations.columns:
                self.recommendations[column] = self.recommendations[column].map(
                    _normalize_serving_id
                )
        for column in ("book_id", "work_id"):
            if self.fallback_items is not None and column in self.fallback_items.columns:
                self.fallback_items[column] = self.fallback_items[column].map(
                    _normalize_serving_id
                )

        self._user_ids: set[str] = set()
        if "user_id" in self.recommendations.columns:
            self._user_ids = set(self.recommendations["user_id"].unique().tolist())
        self.validate()

    def recommend_for_user(
        self,
        user_id: str | UUID,
        num_items: int = 10,
        exclude_seen: bool = True,
    ) -> pd.DataFrame:
        if num_items <= 0:
            return self.recommendations.iloc[0:0].copy()

        user_id_key = _normalize_serving_id(user_id)
        if user_id_key not in self._user_ids and (
            self.fallback_items is None or self.fallback_items.empty
        ):
            raise KeyError(f"Unknown user id: {user_id}")

        user_recs = self.recommendations.iloc[0:0].copy()
        if user_id_key in self._user_ids:
            user_recs = self.recommendations[
                self.recommendations["user_id"] == user_id_key
            ].copy()
            sort_columns: list[str] = []
            ascending: list[bool] = []
            if "rank" in user_recs.columns:
                sort_columns.append("rank")
                ascending.append(True)
            score_col = (
                "pred_rating"
                if "pred_rating" in user_recs.columns
                else "score"
            )
            if score_col in user_recs.columns:
                sort_columns.append(score_col)
                ascending.append(False)
            sort_columns.append("book_id")
            ascending.append(True)
            user_recs = user_recs.sort_values(
                sort_columns,
                ascending=ascending,
                kind="stable",
            )

        selected = user_recs.head(num_items)
        if (
            len(selected) < num_items
            and self.fallback_items is not None
            and not self.fallback_items.empty
        ):
            selected_ids = set(selected.get("book_id", pd.Series(dtype=str)))
            fallback = self.fallback_items[
                ~self.fallback_items["book_id"].isin(selected_ids)
            ].head(num_items - len(selected))
            selected = pd.concat([selected, fallback], ignore_index=True)
        return selected.head(num_items).reset_index(drop=True)

    def get_user_ids(self) -> list[str]:
        return sorted(self._user_ids)

    def has_user(self, user_id: str | UUID) -> bool:
        return _normalize_serving_id(user_id) in self._user_ids

    def source_for_user(self, user_id: str | UUID) -> str:
        return "als" if self.has_user(user_id) else "popular_fallback"

    def model_info(self) -> dict[str, Any]:
        book_ids = pd.concat(
            [
                self.recommendations.get("book_id", pd.Series(dtype=str)),
                (
                    self.fallback_items.get("book_id", pd.Series(dtype=str))
                    if self.fallback_items is not None
                    else pd.Series(dtype=str)
                ),
            ],
            ignore_index=True,
        )
        return {
            "artifact_version": self.artifact_version,
            "model_version": self.metadata.get("model_version"),
            "trained_at": self.metadata.get("trained_at"),
            "reference_time": self.metadata.get("reference_time"),
            "users": int(
                self.metadata.get("data_stats", {}).get(
                    "active_users", len(self._user_ids)
                )
            ),
            "items": int(
                self.metadata.get("data_stats", {}).get(
                    "active_items", book_ids.nunique()
                )
            ),
        }

    def validate(self, require_uuid: bool = False) -> None:
        required = {"book_id", "work_id", "book_title", "author", "source"}
        if not self.recommendations.empty:
            missing = sorted(
                (required | {"user_id", "pred_rating", "rank"}).difference(
                    self.recommendations.columns
                )
            )
            if missing:
                raise ValueError(
                    "ALS recommendations are missing columns: "
                    + ", ".join(missing)
                )
            if self.recommendations.duplicated(["user_id", "book_id"]).any():
                raise ValueError("ALS recommendations contain duplicate books per user.")
            scores = pd.to_numeric(
                self.recommendations["pred_rating"], errors="coerce"
            )
            if scores.isna().any() or not np.isfinite(scores).all():
                raise ValueError("ALS recommendation scores must be finite.")
        if self.fallback_items is not None and not self.fallback_items.empty:
            missing = sorted(required.difference(self.fallback_items.columns))
            if missing:
                raise ValueError(
                    "ALS fallback items are missing columns: " + ", ".join(missing)
                )
            if self.fallback_items["book_id"].duplicated().any():
                raise ValueError("ALS fallback contains duplicate books.")
        if require_uuid:
            for frame, columns in (
                (self.recommendations, ("user_id", "book_id", "work_id")),
                (self.fallback_items, ("book_id", "work_id")),
            ):
                if frame is None:
                    continue
                for column in columns:
                    if column in frame.columns:
                        frame[column].map(normalize_uuid)

    def save(self, path: str | Path) -> None:
        artifact = {
            "artifact_type": "als_serving",
            "artifact_version": self.artifact_version,
            **self.metadata,
            "recommendations": self.recommendations,
            "fallback_items": self.fallback_items,
            "metadata": self.metadata,
        }
        with Path(path).open("wb") as artifact_file:
            pickle.dump(artifact, artifact_file, protocol=pickle.HIGHEST_PROTOCOL)

    @classmethod
    def load(cls, path: str | Path) -> "ALSServingModel":
        obj = _load_pickle(path)
        if isinstance(obj, cls):
            return obj
        if isinstance(obj, pd.DataFrame):
            return cls(obj)
        if isinstance(obj, dict) and obj.get("artifact_type") == "als_serving":
            metadata = obj.get("metadata")
            if metadata is None:
                metadata = {
                    key: obj.get(key)
                    for key in (
                        "model_version",
                        "trained_at",
                        "reference_time",
                        "source_watermark",
                        "hyperparameters",
                        "data_stats",
                        "metrics",
                    )
                    if obj.get(key) is not None
                }
            return cls(
                obj["recommendations"],
                fallback_items=obj.get("fallback_items"),
                metadata=metadata,
                artifact_version=int(obj.get("artifact_version", 2)),
            )
        raise TypeError(f"Expected ALS serving artifact, got {type(obj).__name__}")


class TfidfServingModel:
    """TF-IDF model containing inference-only state."""

    def __init__(
        self,
        matrix: sparse.csr_matrix,
        vectorizer: TfidfVectorizer,
        items_df: pd.DataFrame,
        id_col: str,
    ) -> None:
        self.matrix = matrix
        self.vectorizer = vectorizer
        self.items_df = items_df.copy()
        self.id_col = id_col
        for column in {id_col, "book_id", "work_id"}:
            if column in self.items_df.columns:
                self.items_df[column] = self.items_df[column].map(normalize_uuid)
        self._id_lookup = {
            item_id: idx for idx, item_id in enumerate(self.items_df[id_col])
        }

    def recommend(
        self,
        item_id: str | UUID,
        top_k: int = 10,
        metric: str = "cosine",
        exclude_self: bool = True,
        min_score: Optional[float] = None,
    ) -> pd.DataFrame:
        lookup_key = normalize_uuid(item_id)
        if lookup_key not in self._id_lookup:
            raise KeyError(f"Unknown item id: {item_id}")

        item_index = self._id_lookup[lookup_key]
        scores = pd.Series(linear_kernel(self.matrix[item_index], self.matrix).ravel())

        if exclude_self:
            scores = scores.drop(index=item_index, errors="ignore")
        if min_score is not None:
            scores = scores[scores >= min_score]

        if scores.empty:
            return self.items_df.iloc[0:0].copy().assign(
                score=pd.Series(dtype=float)
            )

        limit = min(top_k, len(scores))
        top_indices = scores.nlargest(limit).index
        results = self.items_df.iloc[top_indices].copy()
        results["score"] = scores.loc[top_indices].to_numpy()
        return results.sort_values("score", ascending=False).reset_index(drop=True)

    @classmethod
    def from_fitted_recommender(cls, recommender: Any) -> "TfidfServingModel":
        return cls(
            matrix=recommender.matrix,
            vectorizer=recommender.vectorizer,
            items_df=recommender.items_df,
            id_col=recommender.id_col,
        )

    def save(self, path: str | Path) -> None:
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        artifact = {
            "artifact_type": "tfidf_serving",
            "artifact_version": 2,
            "matrix": self.matrix,
            "vectorizer": self.vectorizer,
            "items_df": self.items_df,
            "id_col": self.id_col,
        }
        with path.open("wb") as artifact_file:
            pickle.dump(artifact, artifact_file)

    @classmethod
    def load(cls, path: str | Path) -> "TfidfServingModel":
        obj = _load_pickle(path)
        if isinstance(obj, cls):
            return obj
        if isinstance(obj, dict) and obj.get("artifact_type") == "tfidf_serving":
            return cls(
                matrix=obj["matrix"],
                vectorizer=obj["vectorizer"],
                items_df=obj["items_df"],
                id_col=obj["id_col"],
            )

        required_attributes = ("matrix", "vectorizer", "items_df", "id_col")
        if all(hasattr(obj, attribute) for attribute in required_attributes):
            return cls(
                matrix=obj.matrix,
                vectorizer=obj.vectorizer,
                items_df=obj.items_df,
                id_col=obj.id_col,
            )
        raise TypeError(f"Expected TF-IDF serving artifact, got {type(obj).__name__}")
