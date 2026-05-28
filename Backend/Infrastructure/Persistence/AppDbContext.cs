using Microsoft.EntityFrameworkCore;
using Core.Entities;
using System.Text.Json;
using System.Collections.Generic;
using System.Linq;
using Microsoft.EntityFrameworkCore.ChangeTracking;

namespace Infrastructure.Persistence
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.Entity<BookEntity>(entity =>
            {
                entity.HasKey(b => b.book_id);
                entity.Property(b => b.book_id).ValueGeneratedNever();
                entity.Property(b => b.price).HasPrecision(18, 2);

                // 1. CHỈ GIỮ LẠI BỘ SO SÁNH CHO BADGES
                var stringListComparer = new ValueComparer<List<string>>(
                    (c1, c2) => c1!.SequenceEqual(c2!),
                    c => c.Aggregate(0, (a, v) => System.HashCode.Combine(a, v.GetHashCode())),
                    c => c.ToList());

                // 2. CHỈ CẤU HÌNH CONVERSION CHO MÌNH BADGES
                entity.Property(b => b.badges)
                    .HasConversion(
                        v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
                        v => string.IsNullOrWhiteSpace(v) 
                            ? new List<string>() 
                            : (JsonSerializer.Deserialize<List<string>>(v, (JsonSerializerOptions?)null) ?? new List<string>())
                    )
                    .Metadata.SetValueComparer(stringListComparer);

                // ĐÃ XÓA TOÀN BỘ CẤU HÌNH CỦA TAGS Ở ĐÂY.
                // Trả tags về đúng nguyên bản ban đầu của EF Core.
            });

            modelBuilder.Entity<UserEntity>(entity =>
            {
                entity.HasKey(u => u.user_id);
                entity.Property(u => u.current_balance).HasPrecision(18, 2);
            });

            // ... (Phần còn lại của các bảng UserWishlistEntity, UserBookEntity... giữ nguyên 100%)
            modelBuilder.Entity<UserWishlistEntity>(entity =>
            {
                entity.HasKey(w => w.id);
                entity.Property(w => w.price_at_addition).HasPrecision(18, 2);

                entity.HasOne(w => w.User)
                    .WithMany(u => u.Wishlists)
                    .HasForeignKey(w => w.user_id)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.HasOne(w => w.Book)
                    .WithMany()
                    .HasForeignKey(w => w.book_id)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            modelBuilder.Entity<UserBookEntity>(entity =>
            {
                entity.HasKey(ub => ub.id);
                entity.Property(ub => ub.purchase_price).HasPrecision(18, 2);

                entity.HasOne(ub => ub.User)
                    .WithMany(u => u.UserBooks)
                    .HasForeignKey(ub => ub.user_id)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.HasOne(ub => ub.Book)
                    .WithMany()
                    .HasForeignKey(ub => ub.book_id)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            modelBuilder.Entity<RatingEntity>(entity =>
            {
                entity.HasKey(r => new { r.user_id, r.book_id });
            });

            modelBuilder.Entity<TrackingEventEntity>(entity =>
            {
                entity.HasKey(t => t.id);
            });
        }

        public DbSet<BookEntity> Books { get; set; } = null!;
        public DbSet<UserEntity> Users { get; set; } = null!;
        public DbSet<ReviewEntity> Reviews { get; set; } = null!;
        public DbSet<RatingEntity> Ratings { get; set; } = null!;
        public DbSet<TrackingEventEntity> TrackingEvents { get; set; } = null!;
        public DbSet<UserWishlistEntity> Wishlists { get; set; } = null!;
        public DbSet<UserBookEntity> UserBooks { get; set; } = null!;
    }
}