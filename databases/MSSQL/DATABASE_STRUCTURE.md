# DATABASE STRUCTURE (MSSQL)

Schema này mô tả `BookRecDb` theo cấu trúc đang dùng bởi EF Core backend và khớp nhóm bảng trong SQL Server Object Explorer:

- `dbo.__EFMigrationsHistory`
- `dbo.Books`
- `dbo.Ratings`
- `dbo.Reviews`
- `dbo.TrackingEvents`
- `dbo.UserBooks`
- `dbo.Users`
- `dbo.Wishlists`

Nguồn thực thi chính là EF Core migrations trong `Backend/Infrastructure/Migrations`. File `databases/MSSQL/schema.sql` là script tạo mới database/schema tương đương cho môi trường cần reset database.

## `dbo.Books`

Lưu metadata sách và các thống kê phục vụ hiển thị, tìm kiếm, đề xuất, rating và tracking.

Primary key:
- `PK_Books (book_id)`

Cột chính:
- `book_id UNIQUEIDENTIFIER`
- `authors NVARCHAR(MAX)`
- `original_publication_year FLOAT NULL`
- `original_title NVARCHAR(MAX)`
- `language_code NVARCHAR(MAX)`
- `tags NVARCHAR(MAX)`
- `ratings_1` ... `ratings_5 INT`
- `image_url NVARCHAR(MAX)`
- `small_image_url NVARCHAR(MAX)`
- `price DECIMAL(18,2)`
- `mood`, `badge`, `description`, `longDescription`, `status`, `previewText`, `accentColor`
- `badges NVARCHAR(MAX)` stored as serialized JSON list by EF Core
- `views_7d`, `favorite_7d`, `purchases_7d`, `views_30d`, `favorite_30d`, `purchases_30d`
- `total_ratings INT`
- `average_rating FLOAT`

## `dbo.Users`

Lưu tài khoản người dùng.

Primary key:
- `PK_Users (user_id)`

Cột chính:
- `user_id UNIQUEIDENTIFIER`
- `user_name NVARCHAR(MAX)`
- `email NVARCHAR(MAX)`
- `hashed_password NVARCHAR(MAX)`
- `full_name NVARCHAR(MAX)`
- `role NVARCHAR(MAX)`
- `sex NVARCHAR(MAX) NULL`
- `current_balance DECIMAL(18,2)`

## `dbo.Ratings`

Lưu explicit feedback của user cho book.

Primary key:
- `PK_Ratings (user_id, book_id)`

Foreign keys:
- `FK_Ratings_Users_user_id -> Users(user_id)`
- `FK_Ratings_Books_book_id -> Books(book_id)`

Constraints/indexes:
- `CK_Ratings_rating_Range`: `rating` trong khoảng 1..5
- `IX_Ratings_book_id`
- `IX_Ratings_time`

## `dbo.Reviews`

Lưu text review của user cho book.

Primary key:
- `PK_Reviews (id)`

Foreign keys:
- `FK_Reviews_Users_user_id -> Users(user_id)`
- `FK_Reviews_Books_book_id -> Books(book_id)`

Indexes:
- `IX_Reviews_user_id`
- `IX_Reviews_book_id`
- `IX_Reviews_time`

## `dbo.TrackingEvents`

Lưu sự kiện hành vi như view, favorite, purchase hoặc các event nghiệp vụ khác.

Primary key:
- `PK_TrackingEvents (id)`

Foreign keys:
- `FK_TrackingEvents_Users_user_id -> Users(user_id)`
- `FK_TrackingEvents_Books_book_id -> Books(book_id)`

Indexes:
- `IX_TrackingEvents_user_id`
- `IX_TrackingEvents_book_id`
- `IX_TrackingEvents_created_at`

## `dbo.UserBooks`

Lưu sách người dùng đã mua/đang đọc.

Primary key:
- `PK_UserBooks (id)`

Foreign keys:
- `FK_UserBooks_Users_user_id -> Users(user_id)`
- `FK_UserBooks_Books_book_id -> Books(book_id)`

Indexes:
- `IX_UserBooks_user_id`
- `IX_UserBooks_book_id`
- `IX_UserBooks_user_id_book_id` unique để tránh duplicate purchase record cho cùng user/book.

## `dbo.Wishlists`

Lưu sách người dùng thêm vào wishlist.

Primary key:
- `PK_Wishlists (id)`

Foreign keys:
- `FK_Wishlists_Users_user_id -> Users(user_id)`
- `FK_Wishlists_Books_book_id -> Books(book_id)`

Indexes:
- `IX_Wishlists_user_id`
- `IX_Wishlists_book_id`
- `IX_Wishlists_user_id_book_id` unique để tránh duplicate wishlist record cho cùng user/book.

## Agent Usage Rules

1. Ưu tiên EF Core model/migrations khi thay đổi database schema thật.
2. Khi cập nhật entity relationship hoặc index, cập nhật đồng thời `schema.sql` và tài liệu này.
3. Không thêm lại schema cũ `Authors`, `Works`, `Editions`, bridge tables nếu chưa có yêu cầu nghiệp vụ mới.
4. Không đổi tên bảng/cột public nếu chưa có migration và kiểm tra tác động API/frontend.
