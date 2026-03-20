-- 1. TẠO DATABASE
CREATE DATABASE book_app_db;
GO

-- 2. SỬ DỤNG DATABASE
USE book_app_db;
GO

-- 3. BẢNG USERS
-- Lưu thông tin người dùng. 'user_id' từ CSV được dùng làm PK.
-- Trong app thực tế, bạn sẽ có 'email', 'password_hash', v.v.
CREATE TABLE Users (
    user_id INT NOT NULL PRIMARY KEY,

    username NVARCHAR(255) UNIQUE,
    created_at DATETIME DEFAULT GETDATE()
);
GO

-- 4. BẢNG AUTHORS
-- Lưu thông tin tác giả.
CREATE TABLE Authors (
    author_id INT NOT NULL PRIMARY KEY IDENTITY(1,1),
    name NVARCHAR(500) NOT NULL
    -- Thêm index để tìm kiếm tên nhanh hơn
    --CREATE UNIQUE INDEX idx_author_name ON Authors(name);
);
GO

-- 5. BẢNG TAGS
-- Lưu thông tin các tag (thể loại).
CREATE TABLE Tags (
    tag_id INT NOT NULL PRIMARY KEY, -- Lấy từ 'tags.csv'
    tag_name NVARCHAR(500) NOT NULL
    --CREATE UNIQUE INDEX idx_tag_name ON Tags(tag_name);
);
GO

-- 6. BẢNG WORKS
-- Lưu thông tin "Tác phẩm" (khái niệm trừu tượng, nhóm các phiên bản)
CREATE TABLE Works (
    work_id INT NOT NULL PRIMARY KEY, -- Lấy từ 'books.csv'
    original_title NVARCHAR(MAX),
    original_publication_year INT,
    
    -- Các cột này sẽ được ETL cập nhật từ 'books.csv'
    average_rating DECIMAL(3, 2),
    work_ratings_count BIGINT,
    work_text_reviews_count BIGINT
);
GO

-- 7. BẢNG EDITIONS (SẢN PHẨM)
-- Đây là "Sản phẩm" bạn bán. 'book_id' từ 'books.csv' là PK.
CREATE TABLE Editions (
    edition_id INT NOT NULL PRIMARY KEY, -- Lấy từ 'book_id'
    work_id INT NOT NULL,
    title NVARCHAR(MAX),
    isbn VARCHAR(10),
    isbn13 VARCHAR(13),
    image_url NVARCHAR(1000),
    small_image_url NVARCHAR(1000),
    language_code VARCHAR(10),
    
    -- Các cột này dành cho app bán sách của bạn
    price DECIMAL(10, 2) DEFAULT 0.00,
    stock_quantity INT DEFAULT 0,
    
    CONSTRAINT FK_Edition_Work FOREIGN KEY (work_id) REFERENCES Works(work_id)
);
GO
-- Index để tìm tất cả phiên bản của 1 tác phẩm
CREATE INDEX idx_edition_work_id ON Editions(work_id);
GO

-- 8. BẢNG CẦU NỐI (BRIDGE TABLES) CHO QUAN HỆ M-M

-- Nối Works và Authors (Nhiều Tác giả viết Nhiều Tác phẩm)
CREATE TABLE Work_Authors_Bridge (
    work_id INT NOT NULL,
    author_id INT NOT NULL,
    PRIMARY KEY (work_id, author_id),
    CONSTRAINT FK_WA_Work FOREIGN KEY (work_id) REFERENCES Works(work_id),
    CONSTRAINT FK_WA_Author FOREIGN KEY (author_id) REFERENCES Authors(author_id)
);
GO

-- Nối Editions và Tags (Nhiều Phiên bản có Nhiều Tag)
CREATE TABLE Edition_Tags_Bridge (
    edition_id INT NOT NULL,
    tag_id INT NOT NULL,
    [count] INT, -- Lấy từ 'book_tags.csv'
    PRIMARY KEY (edition_id, tag_id),
    CONSTRAINT FK_ET_Edition FOREIGN KEY (edition_id) REFERENCES Editions(edition_id),
    CONSTRAINT FK_ET_Tag FOREIGN KEY (tag_id) REFERENCES Tags(tag_id)
);
GO

-- 9. BẢNG TƯƠNG TÁC (INTERACTIONS)

-- Bảng USER_RATINGS (Từ 'ratings.csv')
-- Đây là tín hiệu "Explicit" (rõ ràng)
CREATE TABLE User_Ratings (
    user_id INT NOT NULL,
    edition_id INT NOT NULL, -- Tham chiếu đến 'book_id'
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    created_at DATETIME DEFAULT GETDATE(),
    PRIMARY KEY (user_id, edition_id),
    CONSTRAINT FK_Rating_User FOREIGN KEY (user_id) REFERENCES Users(user_id),
    CONSTRAINT FK_Rating_Edition FOREIGN KEY (edition_id) REFERENCES Editions(edition_id)
);
GO

-- Bảng USER_WISHLIST (Từ 'to_read.csv')
-- Đây là tín hiệu "Implicit" (ngầm)
CREATE TABLE User_Wishlist (
    user_id INT NOT NULL,
    edition_id INT NOT NULL, -- Tham chiếu đến 'book_id'
    added_at DATETIME DEFAULT GETDATE(),
    PRIMARY KEY (user_id, edition_id),
    CONSTRAINT FK_Wishlist_User FOREIGN KEY (user_id) REFERENCES Users(user_id),
    CONSTRAINT FK_Wishlist_Edition FOREIGN KEY (edition_id) REFERENCES Editions(edition_id)
);
GO

