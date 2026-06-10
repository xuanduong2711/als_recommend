# ALS Fix And Tracking Plan

## Muc tieu

Sua pipeline ALS hien tai de:

- Dung du lieu hanh vi thay vi chi dem cac dong purchase.
- Ho tro `popup_view`, `detail_view`, `add_wishlist`, `purchase`.
- Map dung ID so trong `data/tracking_log_ML.csv` sang UUID cua Backend.
- Train va danh gia implicit ALS theo cung mot pipeline.
- Tao artifact portable cho `book_rec_api`.
- Co fallback cho user moi, user khong du history va item chua co factor ALS.
- Theo doi version, input, tham so, metric va trang thai cua tung lan train model.
- Publish artifact atomic; training loi khong duoc lam hong model dang serve.

Runtime API chi load artifact va inference. Khong train model trong request hoac
khi FastAPI startup.

## Hien trang va cac loi can sua

### 1. Dang co hai implementation ALS

- `src/model/als.py` dung Spark ALS, user/item la integer.
- `book_rec_api/scheduler.py` dung implicit ALS tu viet bang NumPy/SciPy,
  user/item la UUID.
- API trong `book_rec_api/api/als_routes.py` va
  `book_rec_api/serving.py` yeu cau UUID va artifact portable.

Neu tiep tuc duy tri hai pipeline production, tham so, schema ID, metric va
artifact se de bi lech nhau.

Quyet dinh:

- Dung `book_rec_api/scheduler.py` lam entry point train artifact production.
- Tach logic data/ALS/evaluation khoi scheduler de co the test rieng.
- Giu `src/model/als.py` cho nghien cuu Spark/offline trong giai doan chuyen doi,
  nhung khong dung no de tao `book_rec_api/artifacts/model_als.pkl`.

### 2. Training hien tai chua dung tracking

`book_rec_api/scheduler.py` dang doc `database_data/userbooks.csv`, sau do group
theo `(user_id, book_id)` va dem so dong. Voi purchase unique, trong so gan nhu
luon bang `1`, nen ALS co rat it tin hieu.

Tracking phai duoc dua vao interaction matrix voi trong so theo y nghia cua tung
event, gioi han event lap va co time decay.

### 3. Delimiter va ID khong dong nhat

| File | Delimiter | ID |
| --- | --- | --- |
| `data/tracking_log_ML.csv` | `,` | integer |
| `database_data/books.csv` | `;` | UUID |
| `database_data/users.csv` | `;` | UUID |
| `database_data/userbooks.csv` | `;` | UUID |

Khong duoc dung mot `_read_csv()` hardcode `sep=";"` cho tat ca input.

Mapping cua du lieu hien tai la UUID tao tu gia tri integer:

```python
from uuid import UUID

mapped_id = str(UUID(int=int(source_id)))
```

Vi du:

- user `29` -> `00000000-0000-0000-0000-00000000001d`
- book `112` -> `00000000-0000-0000-0000-000000000070`

Mapping phai nam trong mot ham co test, khong noi chuoi UUID bang tay.

### 4. Backend dang reject `detail_view`

`Backend/Application/Commands/AddTrackingEventCommand.cs` dang kiem tra:

```text
deltail_view
```

Frontend gui:

```text
detail_view
```

Can sua typo thanh `detail_view`. Day la loi contract lam mat toan bo event xem
chi tiet tu Frontend.

### 5. Tracking endpoint khong phai nguon event duy nhat

- `popup_view` va `detail_view` den tu `POST /api/tracking`.
- `add_wishlist` duoc ghi trong `AddToWishlistCommand`.
- `purchase` duoc ghi trong `PurchaseBookCommand`.
- `UserBooks` van la source of truth cua purchase.

Training phai hop nhat cac nguon nay va tranh double count purchase da co o ca
`TrackingEvents` va `UserBooks`.

### 6. Danh gia RMSE khong du cho implicit ALS

RMSE phu hop hon voi explicit rating prediction. Muc tieu cua pipeline nay la
ranking top-K tu implicit feedback, do do metric chinh phai la:

- Recall@K
- NDCG@K
- HitRate@K
- catalog coverage
- user coverage

Can so sanh voi popularity baseline tren cung temporal split.

### 7. Cold start hien tai tra `404`

Artifact chi co recommendation cho user da train. User moi hoac user moi tao
bang UUID ngau nhien se khong nam trong historical tracking va dang bi tra `404`.

API phai fallback sang danh sach trending/popular, sau do co the rerank bang
TF-IDF neu co context sach gan nhat.

## Thong tin baseline cua tracking CSV

Schema:

```text
id,user_id,book_id,event_type,created_at
```

Thong ke cua `data/tracking_log_ML.csv` tai thoi diem lap plan:

| Chi so | Gia tri |
| --- | ---: |
| Tong event | 567,161 |
| User duy nhat | 32,806 |
| Book duy nhat | 811 |
| `popup_view` | 283,661 |
| `detail_view` | 174,346 |
| `add_wishlist` | 87,493 |
| `purchase` | 21,661 |
| Event rong | 0 |
| Event trung ca user/book/type/time | 0 |
| Thoi gian dau | 2023-01-01 14:03:10 |
| Thoi gian cuoi | 2025-01-01 18:29:32 |

Sau khi map integer sang UUID va filter theo snapshot
`database_data/users.csv` + `database_data/books.csv` hien tai:

| Chi so | Gia tri |
| --- | ---: |
| Event giu lai | 50,454 |
| Active user | 2,115 |
| Book | 811 |
| User-book pair | 7,371 |
| Median event/user | 21 |
| P90 event/user | 42 |
| Max event/user | 90 |

Toan bo 811 book tracking khop catalog, nhung chi 2,115/32,806 user khop snapshot
user hien tai. Khong train/publish recommendation cho user khong ton tai trong
Backend hien tai.

So lieu tren la baseline test cho snapshot hien tai, khong duoc hardcode vao
production logic.

## Contract interaction sau khi chuan hoa

Moi dong interaction sau ETL:

| Column | Type | Mo ta |
| --- | --- | --- |
| `user_id` | UUID string | ID dung boi Backend/API |
| `book_id` | UUID string | ID trong catalog hien tai |
| `event_type` | string | Event da normalize |
| `event_time` | UTC datetime | Thoi gian event |
| `event_weight` | float | Trong so business cua event |
| `decay` | float | He so giam theo thoi gian |
| `signal` | float | `event_weight * capped_count * decay` |

Output aggregate cho ALS:

| Column | Type | Mo ta |
| --- | --- | --- |
| `user_id` | UUID string | Business user ID |
| `book_id` | UUID string | Business book ID |
| `preference` | float | `1.0` khi co positive signal |
| `confidence` | float | Do tin cay cua positive signal |
| `last_event_at` | datetime | Dung cho split va debug |
| `event_types` | list/string | Dung cho audit |

## Chuan hoa event

Trong so ban dau:

| Event | Weight | Cap |
| --- | ---: | ---: |
| `popup_view` | 1.0 | toi da 3 lan/user/book/ngay |
| `detail_view` | 2.5 | toi da 2 lan/user/book/ngay |
| `add_wishlist` | 5.0 | toi da 1 lan/user/book |
| `purchase` | 8.0 | toi da 1 lan/user/book |

Cap event de popup/view spam khong lan at wishlist va purchase.

Cong thuc de xuat:

```text
age_days = reference_time - event_time
decay = 0.5 ** (age_days / half_life_days)
raw_signal = sum(event_weight * capped_count * decay)
preference = 1.0
confidence = 1.0 + alpha * log1p(raw_signal)
```

Default:

```text
half_life_days = 90
alpha = 20
```

Trong so, cap, half-life va alpha phai la CLI/config parameter va duoc ghi vao
model metadata. Khong coi day la gia tri toi uu truoc khi co offline evaluation.

### Quy tac reference time

Du lieu mau ket thuc ngay `2025-01-01`, trong khi co the train o thoi diem muon
hon rat nhieu. Neu luon decay theo current wall-clock, toan bo historical sample
se bi giam gan ve 0.

- Offline/reproducible training tu CSV: mac dinh
  `reference_time = max(created_at)` cua dataset.
- Production training tu DB live: `reference_time = training_started_at`.
- Gia tri thuc te phai duoc ghi vao metadata.

## Hop nhat cac nguon du lieu

Thu tu de xuat:

1. Load catalog tu `database_data/books.csv` hoac MSSQL `Books`.
2. Load valid users tu `database_data/users.csv` hoac MSSQL `Users`.
3. Load historical event tu `data/tracking_log_ML.csv`.
4. Map integer ID sang UUID.
5. Load live `TrackingEvents`.
6. Load `UserBooks` de bo sung purchase bi thieu.
7. Filter user/book khong con ton tai.
8. Normalize event name.
9. Deduplicate/cap event.
10. Aggregate thanh implicit confidence matrix.

Quy tac purchase:

- Neu `(user_id, book_id)` da co `purchase` trong tracking thi khong cong them
  mot purchase nua tu `UserBooks`.
- Neu `UserBooks` co purchase nhung tracking thieu, tao mot event synthetic voi
  `purchase_date`.
- Sach da mua phai nam trong seen/excluded items khi tao recommendation.

Unknown event:

- Khong silently map sang view.
- Bo qua co warning va count trong training metadata.
- Co allow-list tap trung, dung chung giua ETL va test.

## Pipeline ALS canonical

### Buoc 1: Data preparation

Tao module de xuat:

```text
book_rec_api/training/interactions.py
```

Tra ve:

- interaction DataFrame da aggregate.
- user/item lookup.
- seen items theo user.
- thong ke dropped/unknown/duplicate event.
- reference time va source watermark.

### Buoc 2: Train implicit ALS

Tach `_fit_implicit_als()` khoi scheduler:

```text
book_rec_api/training/implicit_als.py
```

Yeu cau:

- Input la sparse CSR matrix cua confidence/signal.
- Fixed random seed de reproducible.
- Validate it nhat 2 users, 2 items va co non-zero interaction.
- Khong tao factor cho book khong co interaction; cac book nay do fallback xu ly.
- Khong tra NaN/Inf.
- Co unit test tren matrix nho de xac nhan observed item co score cao hon random
  item va seen item bi exclude.

Tham so can expose:

```text
factors
iterations
regularization
alpha
seed
recommendations_per_user
```

### Buoc 3: Temporal evaluation

Tao:

```text
book_rec_api/training/evaluation.py
```

Split:

- Moi user co it nhat 2 user-book pairs: giu interaction moi nhat lam test.
- Train bang cac interaction xay ra truoc test item.
- User chi co 1 pair chi dung train, khong tinh ranking metric.

Bao cao:

```text
Recall@10
NDCG@10
HitRate@10
user_coverage
catalog_coverage
popularity_baseline
```

Khong publish neu:

- khong co recommendation row;
- metric la NaN/Inf;
- user coverage bang 0;
- artifact validate fail;
- model moi regression vuot threshold da config so voi model dang chay.

Giai doan dau co the chi warning regression, sau khi co baseline on dinh thi bat
publish gate.

### Buoc 4: Build recommendation

Voi moi user:

1. Score item co ALS factor.
2. Loai sach da xem/tuong tac manh/da mua theo policy.
3. Lay top-K theo score.
4. Neu thieu K item, fill bang fallback list.
5. Join metadata tu catalog.
6. Giu `rank`, `score`, `source`.

Khong su dung `np.argpartition` khi `limit <= 0`.
Tie-break phai deterministic bang `book_id`.

## Cold-start va fallback

Tao fallback list trong cung lan train:

```text
fallback_score =
    weighted_events_30d
    + bayesian_rating_score
    + small_catalog_freshness_boost
```

Toi thieu can co popularity theo tracking:

- purchase weight cao nhat;
- sau do wishlist, detail view, popup view;
- decay theo thoi gian;
- loai book khong con trong catalog.

API behavior:

| Truong hop | Ket qua |
| --- | --- |
| User co ALS history | `source = "als"` |
| User khong co history | `source = "popular_fallback"` |
| ALS co it hon `limit` item | mix ALS + fallback, khong duplicate |
| Artifact thieu/hong | `503`, khong fake recommendation |

Unknown user khong nen la `404` neu he thong van co fallback hop le.

## Artifact contract moi

`model_als.pkl` tiep tuc dung `ALSServingModel`, nhung artifact version tang len
`3` va chua:

```text
artifact_type
artifact_version
model_version
trained_at
reference_time
source_watermark
hyperparameters
data_stats
metrics
recommendations
fallback_items
```

Moi recommendation row co toi thieu:

```text
user_id
book_id
work_id
book_title
author
pred_rating
rank
source
```

Save flow:

1. Save vao `.tmp`.
2. Load lai bang `ALSServingModel.load()`.
3. Validate schema, row count, UUID, NaN/Inf va fallback.
4. Ghi metadata JSON.
5. `os.replace()` artifact chinh.
6. Chi sau khi thanh cong moi cap nhat training-run log.

## Model tracking

Khong can them MLflow ngay. Phase dau dung artifact metadata va JSONL de giam
dependency van theo doi duoc moi lan train.

Tao:

```text
book_rec_api/artifacts/model_als.metadata.json
logs/als_training_runs.jsonl
```

Moi run ghi:

```text
run_id
status
started_at
finished_at
model_version
git_commit
input_paths
input_checksums
source_watermark
event_counts_before_filter
event_counts_after_filter
dropped_unknown_users
dropped_unknown_books
dropped_unknown_events
hyperparameters
metrics
artifact_path
artifact_checksum
error
```

Khong ghi token, password, connection string hoac PII vao run log.

`GET /health` nen tra them:

```json
{
  "als": {
    "exists": true,
    "loaded": true,
    "model_version": "...",
    "trained_at": "...",
    "reference_time": "...",
    "users": 2115,
    "items": 811
  }
}
```

API loader co mtime-aware reload: `lru_cache(maxsize=2)` voi cache key
`(path, mtime_ns, size)` de phat hien artifact moi sau khi publish.

## Backend va Frontend tracking

### Backend

Sua:

```text
Backend/Application/Commands/AddTrackingEventCommand.cs
```

- `deltail_view` -> `detail_view`.
- Dung allow-list/constant thay vi string rai rac.
- Validate `book_id` ton tai truoc khi ghi event.
- `created_at` luon UTC.

Them index bang EF migration:

```text
(user_id, created_at)
(book_id, created_at)
event_type
```

Index can cho incremental extraction va thong ke event. Migration hien tai chi
tao primary key cho `TrackingEvents`.

Wishlist va purchase tiep tuc ghi event trong business command; khong cho
Frontend tu gui hai event nay de tranh fake conversion.

### Frontend

Sua:

```text
FrontEnd/src/services/trackingService.ts
```

- Dung `ENDPOINTS.TRACKING.LOG_EVENT`.
- Giu allow-list `popup_view | detail_view`.
- Debounce/deduplicate `popup_view` theo book trong mot khoang ngan.
- Tracking fail khong duoc block UI.

Khong gui `user_id` tu client; Backend lay user tu JWT nhu hien tai.

## CLI de xuat

```bash
python -m book_rec_api.scheduler \
  --books database_data/books.csv \
  --users database_data/users.csv \
  --purchases database_data/userbooks.csv \
  --tracking data/tracking_log_ML.csv \
  --recommendations-per-user 50 \
  --reference-time max-event
```

Production co the them adapter MSSQL sau khi CSV pipeline va tests on dinh. CSV
va MSSQL phai cung output mot interaction contract, khong tach hai cach weighting.

## Thu tu implement

### Phase 1: Sua tracking contract

- [ ] Sua typo `detail_view` o Backend.
- [ ] Them Backend tests cho `popup_view`, `detail_view`, invalid event.
- [ ] Dung endpoint constant o Frontend.
- [ ] Them debounce popup tracking.

### Phase 2: Chuan hoa interaction data

- [ ] Them loader delimiter rieng cho tung source.
- [ ] Them integer-to-UUID mapping.
- [ ] Filter theo current users/catalog.
- [ ] Them event normalization, cap va recency decay.
- [ ] Merge purchase tu tracking va `UserBooks` khong double count.
- [ ] Ghi data quality stats.

### Phase 3: Sua ALS va evaluation

- [ ] Tach implicit ALS khoi scheduler.
- [ ] Them validation va deterministic tie-break.
- [ ] Them temporal holdout.
- [ ] Them Recall/NDCG/HitRate/coverage va popularity baseline.
- [ ] Exclude seen/purchased items.

### Phase 4: Serving va cold start

- [ ] Artifact version 3.
- [ ] Them fallback items.
- [ ] Unknown user tra fallback thay vi `404`.
- [ ] Them model metadata vao `/health`.
- [ ] Them mtime-aware reload.

### Phase 5: Model tracking va scheduling

- [ ] Ghi metadata JSON va training JSONL.
- [ ] Ghi checksum/source watermark.
- [ ] Atomic publish va rollback behavior.
- [ ] Schedule daily/incremental train.
- [ ] Them retention cho log va artifact backup.

## Tests bat buoc

### Unit tests

- CSV comma va semicolon deu doc dung.
- `29` va `112` map dung UUID.
- Invalid integer ID bi reject co message ro rang.
- Unknown event bi count va skip.
- Event cap hoat dong.
- Purchase khong double count.
- Decay dung `reference_time`.
- ALS output khong NaN/Inf.
- Seen item khong xuat hien trong recommendation.
- Same seed cho cung output/ranking.
- Unknown user lay fallback.

### Integration tests

- `detail_view` tu Frontend contract duoc Backend chap nhan.
- Train bang sample tracking tao artifact load duoc.
- Artifact chi chua UUID hop le va book ton tai trong catalog.
- API ALS tra dung `limit`, khong duplicate book.
- API tra metadata model trong health.
- Artifact cu van serve neu training moi fail.
- Loader nhan artifact moi sau atomic replace ma khong can restart neu dung
  mtime-aware reload.

### Data assertions cho snapshot hien tai

- Loader doc duoc 567,161 historical event.
- Sau filter snapshot hien tai co 50,454 event va 2,115 active user.
- Ca bon event type deu con du lieu sau filter.
- Khong co recommendation den book ngoai catalog.

## Tieu chi hoan thanh

- Chi co mot pipeline production tao `model_als.pkl`.
- Tracking `detail_view` khong con bi Backend reject.
- ALS dung weighted, capped va time-decayed implicit feedback.
- Historical integer IDs map dung sang Backend UUID.
- Purchase khong bi double count.
- Model co ranking metrics va popularity baseline.
- User moi nhan fallback thay vi `404`.
- Artifact co version/metadata/checksum va publish atomic.
- Moi training run co status, data stats, params va metrics.
- Tests Backend, training va API deu pass.

