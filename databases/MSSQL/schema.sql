-- BookRecDb schema aligned with EF Core AppDbContext.
-- Tables expected in SQL Server Object Explorer:
-- dbo.__EFMigrationsHistory, dbo.Books, dbo.Ratings, dbo.Reviews,
-- dbo.TrackingEvents, dbo.UserBooks, dbo.Users, dbo.Wishlists.

IF DB_ID(N'BookRecDb') IS NULL
BEGIN
    CREATE DATABASE [BookRecDb];
END
GO

USE [BookRecDb];
GO

IF OBJECT_ID(N'[dbo].[Wishlists]', N'U') IS NOT NULL DROP TABLE [dbo].[Wishlists];
IF OBJECT_ID(N'[dbo].[UserBooks]', N'U') IS NOT NULL DROP TABLE [dbo].[UserBooks];
IF OBJECT_ID(N'[dbo].[TrackingEvents]', N'U') IS NOT NULL DROP TABLE [dbo].[TrackingEvents];
IF OBJECT_ID(N'[dbo].[Reviews]', N'U') IS NOT NULL DROP TABLE [dbo].[Reviews];
IF OBJECT_ID(N'[dbo].[Ratings]', N'U') IS NOT NULL DROP TABLE [dbo].[Ratings];
IF OBJECT_ID(N'[dbo].[Users]', N'U') IS NOT NULL DROP TABLE [dbo].[Users];
IF OBJECT_ID(N'[dbo].[Books]', N'U') IS NOT NULL DROP TABLE [dbo].[Books];
GO

CREATE TABLE [dbo].[Books] (
    [book_id] UNIQUEIDENTIFIER NOT NULL,
    [authors] NVARCHAR(MAX) NOT NULL,
    [original_publication_year] FLOAT NULL,
    [original_title] NVARCHAR(MAX) NOT NULL,
    [language_code] NVARCHAR(MAX) NOT NULL,
    [tags] NVARCHAR(MAX) NOT NULL,
    [ratings_1] INT NOT NULL CONSTRAINT [DF_Books_ratings_1] DEFAULT 0,
    [ratings_2] INT NOT NULL CONSTRAINT [DF_Books_ratings_2] DEFAULT 0,
    [ratings_3] INT NOT NULL CONSTRAINT [DF_Books_ratings_3] DEFAULT 0,
    [ratings_4] INT NOT NULL CONSTRAINT [DF_Books_ratings_4] DEFAULT 0,
    [ratings_5] INT NOT NULL CONSTRAINT [DF_Books_ratings_5] DEFAULT 0,
    [image_url] NVARCHAR(MAX) NOT NULL,
    [small_image_url] NVARCHAR(MAX) NOT NULL,
    [price] DECIMAL(18, 2) NOT NULL CONSTRAINT [DF_Books_price] DEFAULT 0,
    [mood] NVARCHAR(MAX) NULL,
    [badge] NVARCHAR(MAX) NULL,
    [description] NVARCHAR(MAX) NULL,
    [longDescription] NVARCHAR(MAX) NULL,
    [pages] INT NOT NULL CONSTRAINT [DF_Books_pages] DEFAULT 0,
    [readTime] INT NOT NULL CONSTRAINT [DF_Books_readTime] DEFAULT 0,
    [status] NVARCHAR(MAX) NULL,
    [chapters] INT NOT NULL CONSTRAINT [DF_Books_chapters] DEFAULT 0,
    [previewText] NVARCHAR(MAX) NULL,
    [accentColor] NVARCHAR(MAX) NULL,
    [badges] NVARCHAR(MAX) NOT NULL CONSTRAINT [DF_Books_badges] DEFAULT N'[]',
    [views_7d] INT NOT NULL CONSTRAINT [DF_Books_views_7d] DEFAULT 0,
    [favorite_7d] INT NOT NULL CONSTRAINT [DF_Books_favorite_7d] DEFAULT 0,
    [purchases_7d] INT NOT NULL CONSTRAINT [DF_Books_purchases_7d] DEFAULT 0,
    [views_30d] INT NOT NULL CONSTRAINT [DF_Books_views_30d] DEFAULT 0,
    [favorite_30d] INT NOT NULL CONSTRAINT [DF_Books_favorite_30d] DEFAULT 0,
    [purchases_30d] INT NOT NULL CONSTRAINT [DF_Books_purchases_30d] DEFAULT 0,
    [total_ratings] INT NOT NULL CONSTRAINT [DF_Books_total_ratings] DEFAULT 0,
    [average_rating] FLOAT NOT NULL CONSTRAINT [DF_Books_average_rating] DEFAULT 0,
    CONSTRAINT [PK_Books] PRIMARY KEY ([book_id])
);
GO

CREATE TABLE [dbo].[Users] (
    [user_id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_Users_user_id] DEFAULT NEWID(),
    [user_name] NVARCHAR(MAX) NOT NULL,
    [email] NVARCHAR(MAX) NOT NULL,
    [hashed_password] NVARCHAR(MAX) NOT NULL,
    [full_name] NVARCHAR(MAX) NOT NULL CONSTRAINT [DF_Users_full_name] DEFAULT N'',
    [role] NVARCHAR(MAX) NOT NULL,
    [sex] NVARCHAR(MAX) NULL,
    [current_balance] DECIMAL(18, 2) NOT NULL CONSTRAINT [DF_Users_current_balance] DEFAULT 0,
    CONSTRAINT [PK_Users] PRIMARY KEY ([user_id])
);
GO

CREATE TABLE [dbo].[Ratings] (
    [user_id] UNIQUEIDENTIFIER NOT NULL,
    [book_id] UNIQUEIDENTIFIER NOT NULL,
    [rating] INT NOT NULL,
    [time] DATETIME2 NOT NULL CONSTRAINT [DF_Ratings_time] DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_Ratings] PRIMARY KEY ([user_id], [book_id]),
    CONSTRAINT [CK_Ratings_rating_Range] CHECK ([rating] >= 1 AND [rating] <= 5),
    CONSTRAINT [FK_Ratings_Books_book_id] FOREIGN KEY ([book_id]) REFERENCES [dbo].[Books] ([book_id]) ON DELETE CASCADE,
    CONSTRAINT [FK_Ratings_Users_user_id] FOREIGN KEY ([user_id]) REFERENCES [dbo].[Users] ([user_id]) ON DELETE CASCADE
);
GO
CREATE INDEX [IX_Ratings_book_id] ON [dbo].[Ratings] ([book_id]);
CREATE INDEX [IX_Ratings_time] ON [dbo].[Ratings] ([time]);
GO

CREATE TABLE [dbo].[Reviews] (
    [id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_Reviews_id] DEFAULT NEWID(),
    [user_id] UNIQUEIDENTIFIER NOT NULL,
    [book_id] UNIQUEIDENTIFIER NOT NULL,
    [review] NVARCHAR(MAX) NOT NULL,
    [time] DATETIME2 NOT NULL CONSTRAINT [DF_Reviews_time] DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_Reviews] PRIMARY KEY ([id]),
    CONSTRAINT [FK_Reviews_Books_book_id] FOREIGN KEY ([book_id]) REFERENCES [dbo].[Books] ([book_id]) ON DELETE CASCADE,
    CONSTRAINT [FK_Reviews_Users_user_id] FOREIGN KEY ([user_id]) REFERENCES [dbo].[Users] ([user_id]) ON DELETE CASCADE
);
GO
CREATE INDEX [IX_Reviews_book_id] ON [dbo].[Reviews] ([book_id]);
CREATE INDEX [IX_Reviews_user_id] ON [dbo].[Reviews] ([user_id]);
CREATE INDEX [IX_Reviews_time] ON [dbo].[Reviews] ([time]);
GO

CREATE TABLE [dbo].[TrackingEvents] (
    [id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_TrackingEvents_id] DEFAULT NEWID(),
    [user_id] UNIQUEIDENTIFIER NOT NULL,
    [event_type] NVARCHAR(MAX) NOT NULL,
    [book_id] UNIQUEIDENTIFIER NOT NULL,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [DF_TrackingEvents_created_at] DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_TrackingEvents] PRIMARY KEY ([id]),
    CONSTRAINT [FK_TrackingEvents_Books_book_id] FOREIGN KEY ([book_id]) REFERENCES [dbo].[Books] ([book_id]) ON DELETE CASCADE,
    CONSTRAINT [FK_TrackingEvents_Users_user_id] FOREIGN KEY ([user_id]) REFERENCES [dbo].[Users] ([user_id]) ON DELETE CASCADE
);
GO
CREATE INDEX [IX_TrackingEvents_book_id] ON [dbo].[TrackingEvents] ([book_id]);
CREATE INDEX [IX_TrackingEvents_user_id] ON [dbo].[TrackingEvents] ([user_id]);
CREATE INDEX [IX_TrackingEvents_created_at] ON [dbo].[TrackingEvents] ([created_at]);
GO

CREATE TABLE [dbo].[UserBooks] (
    [id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_UserBooks_id] DEFAULT NEWID(),
    [book_id] UNIQUEIDENTIFIER NOT NULL,
    [user_id] UNIQUEIDENTIFIER NOT NULL,
    [purchase_price] DECIMAL(18, 2) NOT NULL CONSTRAINT [DF_UserBooks_purchase_price] DEFAULT 0,
    [purchase_date] DATETIME2 NOT NULL CONSTRAINT [DF_UserBooks_purchase_date] DEFAULT SYSUTCDATETIME(),
    [current_chapter] INT NOT NULL CONSTRAINT [DF_UserBooks_current_chapter] DEFAULT 0,
    [last_read_at] DATETIME2 NULL,
    CONSTRAINT [PK_UserBooks] PRIMARY KEY ([id]),
    CONSTRAINT [FK_UserBooks_Books_book_id] FOREIGN KEY ([book_id]) REFERENCES [dbo].[Books] ([book_id]) ON DELETE CASCADE,
    CONSTRAINT [FK_UserBooks_Users_user_id] FOREIGN KEY ([user_id]) REFERENCES [dbo].[Users] ([user_id]) ON DELETE CASCADE
);
GO
CREATE INDEX [IX_UserBooks_book_id] ON [dbo].[UserBooks] ([book_id]);
CREATE INDEX [IX_UserBooks_user_id] ON [dbo].[UserBooks] ([user_id]);
CREATE UNIQUE INDEX [IX_UserBooks_user_id_book_id] ON [dbo].[UserBooks] ([user_id], [book_id]);
GO

CREATE TABLE [dbo].[Wishlists] (
    [id] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_Wishlists_id] DEFAULT NEWID(),
    [book_id] UNIQUEIDENTIFIER NOT NULL,
    [user_id] UNIQUEIDENTIFIER NOT NULL,
    [added_at] DATETIME2 NOT NULL CONSTRAINT [DF_Wishlists_added_at] DEFAULT SYSUTCDATETIME(),
    [price_at_addition] DECIMAL(18, 2) NOT NULL CONSTRAINT [DF_Wishlists_price_at_addition] DEFAULT 0,
    [collection_name] NVARCHAR(MAX) NULL,
    CONSTRAINT [PK_Wishlists] PRIMARY KEY ([id]),
    CONSTRAINT [FK_Wishlists_Books_book_id] FOREIGN KEY ([book_id]) REFERENCES [dbo].[Books] ([book_id]) ON DELETE CASCADE,
    CONSTRAINT [FK_Wishlists_Users_user_id] FOREIGN KEY ([user_id]) REFERENCES [dbo].[Users] ([user_id]) ON DELETE CASCADE
);
GO
CREATE INDEX [IX_Wishlists_book_id] ON [dbo].[Wishlists] ([book_id]);
CREATE INDEX [IX_Wishlists_user_id] ON [dbo].[Wishlists] ([user_id]);
CREATE UNIQUE INDEX [IX_Wishlists_user_id_book_id] ON [dbo].[Wishlists] ([user_id], [book_id]);
GO

IF OBJECT_ID(N'[dbo].[__EFMigrationsHistory]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[__EFMigrationsHistory] (
        [MigrationId] NVARCHAR(150) NOT NULL,
        [ProductVersion] NVARCHAR(32) NOT NULL,
        CONSTRAINT [PK___EFMigrationsHistory] PRIMARY KEY ([MigrationId])
    );
END
GO
