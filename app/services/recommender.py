# app/services/recommender.py
import glob
import json
import os
import threading
import time
from functools import lru_cache
from pathlib import Path

import pandas as pd

from src.model.als import (
    ALSBookRecommender,
    DEFAULT_INTERACTIONS_PATH,
    DEFAULT_METADATA_PATH,
    create_spark_session,
)
from src.model.tf_idf import train_from_transform_output
from src.search.fuzzy_search import fuzzy_search_books



MSSQL_FEATURE_STORE_DIR = os.path.join('data', 'mssql_feature_store')
MSSQL_SNAPSHOT_DIR = os.path.join('data', 'mssql_snapshot')

BOOK_DATA_CANDIDATES = [
    os.environ.get('BOOK_FEATURES_PATH', os.path.join(MSSQL_FEATURE_STORE_DIR, 'items_features.parquet')),
    os.path.join(MSSQL_FEATURE_STORE_DIR, 'items_features.csv'),
    os.path.join('data', 'processed', 'clean_books.csv'),
    os.path.join('data', 'book_features_dataset', '*.csv'),
    os.path.join('data', 'clean_books_temp', 'partques_output', '*.csv'),
    os.path.join('data', 'clean_books_temp', 'clean', '*.csv'),
    os.path.join('data', 'clean_books_temp', '*.csv'),
]

DEFAULT_MOCK_USER_ID = 123
DEFAULT_ALS_MODEL_CACHE_PATH = os.path.join('data', 'als_model_cache', 'model')
DEFAULT_ALS_MODEL_METADATA_PATH = os.path.join('data', 'als_model_cache', 'metadata.json')
DEFAULT_ALS_RETRAIN_INTERVAL_SECONDS = 3 * 24 * 60 * 60
DEFAULT_ID_MAPPINGS_PATH = os.path.join(MSSQL_FEATURE_STORE_DIR, 'id_mappings.json')

REQUIRED_COLUMNS = {
    'book_id': None,
    'book_title': 'Không có tên',
    'author': 'Không rõ tác giả',
    'price': None,
    'avg_star': None,
    'num_rating': 0,
    'num_sold': None,
    'genre': None,
    'image_path': None,
}


def _book_data_paths():
    paths = []
    for pattern in BOOK_DATA_CANDIDATES:
        if not pattern:
            continue
        if any(char in pattern for char in '*?[]'):
            matches = sorted(glob.glob(pattern))
            paths.extend(matches)
        elif os.path.exists(pattern):
            paths.append(pattern)
    return paths


def _normalize_book_data(data):
    column_map = {
        'work_id': 'book_id',
        'title': 'book_title',
        'authors': 'author',
        'average_rating': 'avg_star',
        'total_ratings_count': 'num_rating',
        'image_url': 'image_path',
        'tags': 'genre',
        'tag_name': 'genre',
        'category': 'genre',
    }

    data = data.rename(columns={src: dest for src, dest in column_map.items() if src in data.columns})

    for column, default in REQUIRED_COLUMNS.items():
        if column not in data.columns:
            data[column] = default

    data = data[data['book_id'].notna()]
    data['book_id'] = data['book_id'].map(
        lambda value: value.strip() if isinstance(value, str) else value
    )
    data = data[~data['book_id'].map(lambda value: isinstance(value, str) and value == '')]
    data['book_title'] = data['book_title'].fillna('Không có tên')
    data['author'] = data['author'].fillna('Không rõ tác giả')
    data['num_rating'] = pd.to_numeric(data['num_rating'], errors='coerce').fillna(0)
    data['avg_star'] = pd.to_numeric(data['avg_star'], errors='coerce')


    return data


def _records(data):
    clean_data = data.astype(object).where(pd.notnull(data), None)
    return clean_data.to_dict('records')


def _read_table(path):
    suffix = Path(path).suffix.lower()
    if suffix in {'.parquet', '.pq'}:
        return pd.read_parquet(path)
    if suffix in {'.json'}:
        return pd.read_json(path)
    return pd.read_csv(path, on_bad_lines='skip')


def _build_mssql_feature_store_if_needed() -> None:
    snapshot_dir = os.environ.get('MSSQL_SNAPSHOT_DIR', MSSQL_SNAPSHOT_DIR)
    output_dir = os.environ.get('MSSQL_FEATURE_STORE_DIR', MSSQL_FEATURE_STORE_DIR)
    output_file = Path(output_dir) / 'items_features.parquet'
    if output_file.exists():
        return
    if not Path(snapshot_dir).exists():
        return

    try:
        from src.data.mssql_feature_store import materialize_feature_store

        materialize_feature_store(snapshot_dir=snapshot_dir, output_dir=output_dir)
    except Exception as exc:
        print(f"Không thể build MSSQL feature store tự động: {exc}")


def _load_book_data():
    _build_mssql_feature_store_if_needed()
    data_paths = _book_data_paths()
    if not data_paths:
        print("!!! CẢNH BÁO: Không tìm thấy dữ liệu sách. SỬ DỤNG DỮ LIỆU GIẢ. !!!")
        return pd.DataFrame()

    for data_path in data_paths:
        try:
            data = _read_table(data_path)
            data = _normalize_book_data(data)
            print(f"--- Đã tải thành công {len(data)} cuốn sách từ {data_path} ---")
            return data
        except Exception as exc:
            print(f"Lỗi khi đọc dữ liệu {data_path}: {exc}. Thử nguồn khác.")

    print("!!! Không đọc được file dữ liệu sách nào. SỬ DỤNG DỮ LIỆU GIẢ. !!!")
    return pd.DataFrame()


book_data = _load_book_data()


@lru_cache(maxsize=1)
def _get_content_recommender():
    source_path = os.environ.get('CONTENT_BOOK_DATA_PATH')
    if source_path:
        return train_from_transform_output(path=source_path)
    return train_from_transform_output()


@lru_cache(maxsize=1)
def _load_id_mappings(path=None):
    mapping_path = Path(path or os.environ.get('ALS_ID_MAPPINGS_PATH', DEFAULT_ID_MAPPINGS_PATH))
    if not mapping_path.exists():
        return {'user_id_to_index': {}, 'book_id_to_index': {}}

    try:
        with mapping_path.open('r', encoding='utf-8') as file_obj:
            data = json.load(file_obj)
    except (OSError, json.JSONDecodeError):
        return {'user_id_to_index': {}, 'book_id_to_index': {}}

    if not isinstance(data, dict):
        return {'user_id_to_index': {}, 'book_id_to_index': {}}

    user_map = data.get('user_id_to_index', {})
    book_map = data.get('book_id_to_index', {})
    return {
        'user_id_to_index': user_map if isinstance(user_map, dict) else {},
        'book_id_to_index': book_map if isinstance(book_map, dict) else {},
    }


def _resolve_als_user_id(user_id):
    if user_id is None:
        return None

    text = str(user_id).strip()
    if not text:
        return None

    try:
        number = int(text)
        if number > 0:
            return number
    except ValueError:
        pass

    mapping = _load_id_mappings()
    mapped = mapping['user_id_to_index'].get(text)
    if mapped is None:
        return None
    try:
        value = int(mapped)
    except (TypeError, ValueError):
        return None
    return value if value > 0 else None



def _serialize_user_id(user_id):
    text = str(user_id).strip() if user_id is not None else ''
    if text.isdigit():
        return int(text)
    return text


def _resolve_content_item_id(item_id, recommender):
    normalized = str(item_id).strip() if item_id is not None else ''
    if not normalized:
        return item_id

    model_id_col = getattr(recommender, 'id_col', None)
    if model_id_col == 'book_id':
        return normalized

    mapping = _load_id_mappings()
    mapped = mapping['book_id_to_index'].get(normalized)
    if mapped is not None:
        return str(mapped)

    return normalized
_als_cache_lock = threading.RLock()
_als_cache = {
    "recommender": None,
    "trained_at": None,
    "model_path": None,
    "metadata_path": None,
    "ttl_seconds": None,
}
_als_warmup_thread = None


def _als_model_cache_path() -> str:
    return os.environ.get(
        "ALS_MODEL_PATH",
        os.environ.get("ALS_MODEL_CACHE_PATH", DEFAULT_ALS_MODEL_CACHE_PATH),
    )


def _als_model_metadata_path() -> str:
    return os.environ.get("ALS_MODEL_METADATA_PATH", DEFAULT_ALS_MODEL_METADATA_PATH)


def _als_retrain_interval_seconds() -> int:
    raw_value = os.environ.get("ALS_RETRAIN_INTERVAL_SECONDS")
    if raw_value is None:
        return DEFAULT_ALS_RETRAIN_INTERVAL_SECONDS

    try:
        value = int(raw_value)
    except ValueError:
        return DEFAULT_ALS_RETRAIN_INTERVAL_SECONDS

    return max(1, value)


def _read_als_model_metadata(metadata_path: str | Path | None = None) -> dict:
    resolved_path = Path(metadata_path or _als_model_metadata_path())
    if not resolved_path.exists():
        return {}

    try:
        with resolved_path.open("r", encoding="utf-8") as file_obj:
            data = json.load(file_obj)
    except (OSError, json.JSONDecodeError):
        return {}

    return data if isinstance(data, dict) else {}


def _write_als_model_metadata(
    *,
    trained_at: float,
    model_path: str,
    metadata_path: str | Path | None = None,
) -> None:
    resolved_path = Path(metadata_path or _als_model_metadata_path())
    resolved_path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "trained_at": trained_at,
        "model_path": model_path,
        "interactions_path": os.environ.get("ALS_INTERACTIONS_PATH", _default_als_interactions_path()),
        "metadata_path": os.environ.get("ALS_METADATA_PATH", _default_als_metadata_path()),
    }
    with resolved_path.open("w", encoding="utf-8") as file_obj:
        json.dump(payload, file_obj, ensure_ascii=True, indent=2, sort_keys=True)


def _metadata_trained_at(metadata: dict) -> float | None:
    try:
        return float(metadata.get("trained_at"))
    except (TypeError, ValueError):
        return None


def _is_als_cache_fresh(trained_at: float | None, ttl_seconds: int | None = None) -> bool:
    if trained_at is None:
        return False
    ttl = ttl_seconds if ttl_seconds is not None else _als_retrain_interval_seconds()
    return time.time() - trained_at < ttl


def _clear_als_recommender_cache() -> None:
    global _als_warmup_thread
    with _als_cache_lock:
        _als_cache.update(
            {
                "recommender": None,
                "trained_at": None,
                "model_path": None,
                "metadata_path": None,
                "ttl_seconds": None,
            }
        )
        _als_warmup_thread = None
    _load_id_mappings.cache_clear()




def _default_als_interactions_path() -> str:
    mssql_path = os.path.join(MSSQL_FEATURE_STORE_DIR, 'interactions_dataset.parquet')
    return mssql_path if Path(mssql_path).exists() else DEFAULT_INTERACTIONS_PATH


def _default_als_metadata_path() -> str:
    mssql_path = os.path.join(MSSQL_FEATURE_STORE_DIR, 'items_features.parquet')
    return mssql_path if Path(mssql_path).exists() else DEFAULT_METADATA_PATH


def _build_als_recommender() -> ALSBookRecommender:
    spark = create_spark_session()
    recommender = ALSBookRecommender(spark)
    interactions_path = os.environ.get("ALS_INTERACTIONS_PATH", _default_als_interactions_path())
    metadata_path = os.environ.get("ALS_METADATA_PATH", _default_als_metadata_path())
    recommender.load_data(interactions_path, metadata_path)
    return recommender


def _load_or_train_als_recommender() -> tuple[ALSBookRecommender, float]:
    model_path = _als_model_cache_path()
    metadata_path = _als_model_metadata_path()
    ttl_seconds = _als_retrain_interval_seconds()
    metadata = _read_als_model_metadata(metadata_path)
    trained_at = _metadata_trained_at(metadata)

    recommender = _build_als_recommender()
    if Path(model_path).exists() and _is_als_cache_fresh(trained_at, ttl_seconds):
        recommender.load_model(model_path)
        return recommender, float(trained_at)

    recommender.fit()
    Path(model_path).parent.mkdir(parents=True, exist_ok=True)
    recommender.save_model(model_path, overwrite=True)
    trained_at = time.time()
    _write_als_model_metadata(
        trained_at=trained_at,
        model_path=model_path,
        metadata_path=metadata_path,
    )
    return recommender, trained_at


def _get_als_recommender():
    model_path = _als_model_cache_path()
    metadata_path = _als_model_metadata_path()
    ttl_seconds = _als_retrain_interval_seconds()

    with _als_cache_lock:
        cached_recommender = _als_cache.get("recommender")
        cached_trained_at = _als_cache.get("trained_at")
        if (
            cached_recommender is not None
            and _als_cache.get("model_path") == model_path
            and _als_cache.get("metadata_path") == metadata_path
            and _als_cache.get("ttl_seconds") == ttl_seconds
            and _is_als_cache_fresh(cached_trained_at, ttl_seconds)
        ):
            return cached_recommender

        recommender, trained_at = _load_or_train_als_recommender()
        _als_cache.update(
            {
                "recommender": recommender,
                "trained_at": trained_at,
                "model_path": model_path,
                "metadata_path": metadata_path,
                "ttl_seconds": ttl_seconds,
            }
        )
        return recommender


def _warm_als_recommender() -> None:
    try:
        _get_als_recommender()
    except Exception as exc:
        print(f"Lỗi khi warm up Spark ALS: {exc}")


def warm_als_recommender_async() -> None:
    global _als_warmup_thread
    model_path = _als_model_cache_path()
    metadata_path = _als_model_metadata_path()
    ttl_seconds = _als_retrain_interval_seconds()

    with _als_cache_lock:
        cached_recommender = _als_cache.get("recommender")
        if (
            cached_recommender is not None
            and _als_cache.get("model_path") == model_path
            and _als_cache.get("metadata_path") == metadata_path
            and _als_cache.get("ttl_seconds") == ttl_seconds
            and _is_als_cache_fresh(_als_cache.get("trained_at"), ttl_seconds)
        ):
            return
        if _als_warmup_thread is not None and _als_warmup_thread.is_alive():
            return

        _als_warmup_thread = threading.Thread(
            target=_warm_als_recommender,
            name="als-recommender-warmup",
            daemon=True,
        )
        _als_warmup_thread.start()


_get_als_recommender.cache_clear = _clear_als_recommender_cache


def _clamp_limit(value, default=10, minimum=1, maximum=50):
    try:
        number = int(value)
    except (TypeError, ValueError):
        number = default
    return max(minimum, min(number, maximum))


def get_popular_books(num=9):
    """
    Lấy sách bán chạy/phổ biến nhất TỪ DỮ LIỆU THẬT.
    """
    print(f"Service: Lấy {num} sách phổ biến...")
    
    # Kiểm tra xem book_data đã được tải chưa
    if book_data.empty:
        print("Lỗi: Dữ liệu sách rỗng. Trả về mock data.")
        # Fallback (dự phòng) về mock data nếu không tải được file
        mock_books = [
            {'book_title': 'Sách Bán Chạy (Lỗi Tải File)', 'author': 'Tác giả A', 'price': 120000, 'avg_star': 4.5, 'num_rating': 150, 'genre': 'Khoa học', 'image_path': 'https://static.nutscdn.com/vimg/300-0/abf2eac51be10cc36ad30ef45b325dac.jpg'},
            {'book_title': 'Nghệ thuật kể chuyện', 'author': 'Tác giả B', 'price': 99000, 'avg_star': 4.8, 'num_rating': 210, 'genre': 'Văn học', 'image_path': 'placeholder.jpg'},
        ]
        return mock_books

    try:
        # --- LOGIC THẬT ---
        # Sắp xếp sách theo số lượng rating giảm dần (phổ biến nhất)
        num = max(1, min(int(num), 50))
        popular = book_data.sort_values(by='num_rating', ascending=False).head(num)
        
        # Chuyển đổi DataFrame của Pandas sang dạng list of dicts mà Frontend cần
        return _records(popular)
        # --- KẾT THÚC LOGIC THẬT ---

    except Exception as e:
        print(f"Lỗi khi lấy sách phổ biến: {e}")
        return []



def get_recommendations_for_book(book_id, num=10):
    """
    Lấy danh sách sách gợi ý dựa trên một book_id/work_id.
    """
    normalized_book_id = str(book_id).strip() if book_id is not None else ""
    if not normalized_book_id:
        return [], "Thiếu tham số book_id.", 400

    try:
        limit = _clamp_limit(num)
        recommender = _get_content_recommender()
        resolved_book_id = _resolve_content_item_id(normalized_book_id, recommender)
        recommendations = recommender.recommend(resolved_book_id, top_k=limit)
        return _records(recommendations), None, 200
    except KeyError:
        return [], f"Không tìm thấy sách với book_id: {normalized_book_id}.", 404
    except Exception as e:
        print(f"Lỗi khi gợi ý sách cho book_id {normalized_book_id}: {e}")
        return [], f"Lỗi hệ thống khi gợi ý sách: {e}", 500
def _recommendations_data_path(path=None):
    return path or os.environ.get('USER_RECOMMENDATIONS_PATH', os.path.join('data', 'user_recommendations'))


USER_RECOMMENDATIONS_REQUIRED_COLUMNS = {'user_id', 'work_id', 'pred_rating'}
USER_RECOMMENDATIONS_NOT_READY = (
    'Dữ liệu đề xuất Spark ALS chưa sẵn sàng. Vui lòng chạy batch job trước.'
)
USER_RECOMMENDATIONS_NOT_FOUND = (
    'Không tìm thấy thông tin cho User ID này. Xin vui lòng xem các sách bán chạy.'
)


@lru_cache(maxsize=4)
def _load_user_recommendations(path=None):
    resolved_path = _recommendations_data_path(path)
    if not os.path.exists(resolved_path):
        raise FileNotFoundError(resolved_path)

    try:
        data = pd.read_parquet(resolved_path)
    except Exception as exc:
        raise RuntimeError(f'Không thể đọc dữ liệu đề xuất Spark ALS: {exc}') from exc

    missing = USER_RECOMMENDATIONS_REQUIRED_COLUMNS.difference(data.columns)
    if missing:
        raise ValueError(
            'Dữ liệu đề xuất Spark ALS thiếu cột: ' + ', '.join(sorted(missing))
        )

    return _normalize_recommendation_data(data)


def _to_pandas(data):
    if hasattr(data, "toPandas"):
        return data.toPandas()
    return data


def _normalize_item_recommendation_data(data):
    data = _to_pandas(data).copy()
    work_id_values = data["work_id"].copy() if "work_id" in data.columns else None
    normalization_input = data.copy()
    if work_id_values is not None and "book_id" in normalization_input.columns:
        normalization_input = normalization_input.drop(columns=["work_id"])
    data = _normalize_book_data(normalization_input)

    if work_id_values is not None:
        data["work_id"] = pd.to_numeric(work_id_values, errors="coerce")
        data = data.dropna(subset=["work_id"])
        data["work_id"] = data["work_id"].astype(int)

    if "similarity_score" in data.columns:
        data["similarity_score"] = pd.to_numeric(data["similarity_score"], errors="coerce")
        data = data.dropna(subset=["similarity_score"])

    if "rank" not in data.columns:
        sort_col = "similarity_score" if "similarity_score" in data.columns else "book_id"
        ascending = sort_col != "similarity_score"
        data = data.sort_values(sort_col, ascending=ascending).reset_index(drop=True)
        data["rank"] = data.index + 1
    else:
        data["rank"] = pd.to_numeric(data["rank"], errors="coerce")
        data = data.dropna(subset=["rank"])
        data["rank"] = data["rank"].astype(int)

    return data

def _normalize_recommendation_data(data):
    data = data.copy()
    work_id_values = data['work_id'].copy() if 'work_id' in data.columns else None
    source_user_values = data['source_user_id'].copy() if 'source_user_id' in data.columns else None
    data = _normalize_book_data(data)

    if work_id_values is not None:
        data['work_id'] = pd.to_numeric(work_id_values, errors='coerce')

    if source_user_values is not None:
        data['source_user_id'] = source_user_values.astype(str).str.strip()
        data.loc[data['source_user_id'] == '', 'source_user_id'] = pd.NA

    if 'user_id' in data.columns:
        data['user_id'] = pd.to_numeric(data['user_id'], errors='coerce')
    else:
        data['user_id'] = pd.NA

    for column in ('work_id', 'pred_rating'):
        data[column] = pd.to_numeric(data[column], errors='coerce')

    data = data.dropna(subset=['work_id', 'pred_rating'])

    if 'source_user_id' in data.columns:
        data = data[data['user_id'].notna() | data['source_user_id'].notna()]
    else:
        data = data.dropna(subset=['user_id'])

    data['work_id'] = data['work_id'].astype(int)
    data['pred_rating'] = data['pred_rating'].astype(float)

    if data['user_id'].notna().any():
        data.loc[data['user_id'].notna(), 'user_id'] = data.loc[data['user_id'].notna(), 'user_id'].astype(int)

    if 'rank' not in data.columns:
        if 'source_user_id' in data.columns:
            user_group_key = data['source_user_id'].where(data['source_user_id'].notna(), data['user_id'].astype(str))
        else:
            user_group_key = data['user_id'].astype(str)
        data = data.assign(_user_group_key=user_group_key)
        data['rank'] = (
            data.sort_values(['_user_group_key', 'pred_rating'], ascending=[True, False])
            .groupby('_user_group_key')
            .cumcount()
            + 1
        )
        data = data.drop(columns=['_user_group_key'])
    else:
        data['rank'] = pd.to_numeric(data['rank'], errors='coerce')

    data['rank'] = data['rank'].fillna(10**9).astype(int)
    return data

def get_recommendations_after_purchase(user_id=None, book_id=None, num=10):
    """Return ALS user recommendations after a purchase/rating event."""
    normalized_user_id = _resolve_als_user_id(user_id)
    if normalized_user_id is None:
        return [], "User ID không hợp lệ. Vui lòng thử lại.", 400

    normalized_book_id = str(book_id).strip() if book_id is not None else ""
    if not normalized_book_id:
        return [], "Thiếu tham số book_id.", 400

    limit = _clamp_limit(num)

    try:
        recommender = _get_als_recommender()
        recommendations = recommender.recommend_for_user(
            normalized_user_id,
            num_items=limit,
            exclude_seen=True,
        )
        normalized = _normalize_item_recommendation_data(recommendations)
    except KeyError:
        return [], f"Không tìm thấy thông tin cho User ID: {_serialize_user_id(user_id)}.", 404
    except FileNotFoundError:
        return [], USER_RECOMMENDATIONS_NOT_READY, 503
    except (ImportError, RuntimeError, ValueError) as exc:
        print(f"Lỗi khi lấy đề xuất ALS cho user {normalized_user_id}: {exc}")
        return [], USER_RECOMMENDATIONS_NOT_READY, 503
    except Exception as exc:
        print(f"Lỗi khi lấy đề xuất ALS cho user {normalized_user_id}: {exc}")
        return [], USER_RECOMMENDATIONS_NOT_READY, 503

    if normalized.empty:
        return [], f"Không tìm thấy thông tin cho User ID: {_serialize_user_id(user_id)}.", 404

    return _records(normalized.head(limit)), None, 200


def get_recommendations_for_user(user_id, num=10, recommendations_path=None):
    """Return precomputed Spark ALS recommendations for ``user_id``."""
    requested_user_id = str(user_id).strip() if user_id is not None else ''
    normalized_user_id = _resolve_als_user_id(user_id)
    if normalized_user_id is None:
        return [], 'User ID không hợp lệ. Vui lòng thử lại.', 400

    limit = _clamp_limit(num)

    try:
        recommendations = _load_user_recommendations(recommendations_path)
    except FileNotFoundError:
        return [], USER_RECOMMENDATIONS_NOT_READY, 503
    except Exception as exc:
        print(f'Lỗi khi tải dữ liệu đề xuất Spark ALS: {exc}')
        return [], USER_RECOMMENDATIONS_NOT_READY, 503

    if 'source_user_id' in recommendations.columns and requested_user_id and not requested_user_id.isdigit():
        user_recs = recommendations[recommendations['source_user_id'].astype(str) == requested_user_id]
        if user_recs.empty:
            user_recs = recommendations[recommendations['user_id'] == normalized_user_id]
    else:
        user_recs = recommendations[recommendations['user_id'] == normalized_user_id]

    if user_recs.empty:
        return [], USER_RECOMMENDATIONS_NOT_FOUND, 404

    user_recs = user_recs.sort_values(['rank', 'pred_rating'], ascending=[True, False]).head(limit)
    return _records(user_recs), None, 200


def find_books_by_query(query):
    """
    Tìm kiếm sách dựa trên query TỪ DỮ LIỆU THẬT.
    """
    print(f"Service: Tìm kiếm với query: '{query}'...")
    
    if book_data.empty:
        print("Lỗi: Dữ liệu sách rỗng. Không thể tìm kiếm.")
        return [], "Hệ thống đang bảo trì. Vui lòng thử lại sau."

    try:
        results = fuzzy_search_books(
            book_data,
            query=query,
            limit=50,
            score_cutoff=50,
            search_columns=('book_title', 'title', 'author', 'authors', 'genre', 'tags', 'tag_name', 'description'),
            normalize_output=True,
        )

        print(f"Tìm thấy {len(results)} kết quả cho '{query}'")
        warm_als_recommender_async()
        return results, None # (results, error)

    except Exception as e:
        print(f"Lỗi khi tìm kiếm: {e}")
        return [], f"Lỗi hệ thống khi tìm kiếm: {e}"
