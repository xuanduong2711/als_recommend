"""Train ALS and TF-IDF models, then save serving artifacts."""
from __future__ import annotations

import pickle
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.model.als import ALSBookRecommender, create_spark_session, train_als_from_transform_output
from src.model.tf_idf import train_from_transform_output

ARTIFACTS_DIR = Path(__file__).resolve().parent / "artifacts"
ALS_MODEL_PATH = ARTIFACTS_DIR / "model_als.pkl"
TFIDF_MODEL_PATH = ARTIFACTS_DIR / "model_tfidf.pkl"

INTERACTIONS_PATH = str(ROOT / "data" / "interactions_dataset")
METADATA_PATH = str(ROOT / "data" / "book_features_dataset")


def train_and_save_als() -> None:
    """Train ALS, export a pickle-safe serving artifact.

    The Spark ALS model itself is not pickle-safe, so we export precomputed
    user recommendations as a pandas DataFrame.
    """
    print("Training ALS model...")
    spark = create_spark_session()
    recommender = ALSBookRecommender(spark)
    rmse = recommender.train_from_transform_output(INTERACTIONS_PATH, METADATA_PATH)
    print(f"ALS RMSE = {rmse:.4f}")

    import pandas as pd

    recs_df = recommender.recommend_for_all_users(num_items=20)
    rows = [row.asDict() for row in recs_df.collect()]
    serving_df = pd.DataFrame(rows)

    tmp_path = ALS_MODEL_PATH.with_suffix(".pkl.tmp")
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    with tmp_path.open("wb") as f:
        pickle.dump(serving_df, f)
    if tmp_path.stat().st_size == 0:
        raise RuntimeError("ALS artifact is empty after save")
    tmp_path.rename(ALS_MODEL_PATH)
    print(f"ALS serving artifact saved to {ALS_MODEL_PATH} ({len(serving_df)} rows)")
    spark.stop()


def train_and_save_tfidf() -> None:
    """Train TF-IDF recommender and save via ContentBasedRecommender.save()."""
    print("Training TF-IDF model...")
    recommender = train_from_transform_output(
        METADATA_PATH,
        max_features=5000,
    )
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    tmp_path = TFIDF_MODEL_PATH.with_suffix(".pkl.tmp")
    recommender.save(tmp_path)
    if tmp_path.stat().st_size == 0:
        raise RuntimeError("TF-IDF artifact is empty after save")
    tmp_path.rename(TFIDF_MODEL_PATH)
    print(
        f"TF-IDF artifact saved to {TFIDF_MODEL_PATH} "
        f"({len(recommender.items_df)} items)"
    )


def main() -> None:
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    train_and_save_als()
    train_and_save_tfidf()
    print("All models trained and saved.")


if __name__ == "__main__":
    main()
