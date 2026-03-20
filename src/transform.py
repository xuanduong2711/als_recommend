# from pyspark.sql import SparkSession, Window
# from pyspark.sql.functions import *
# from pyspark.sql.types import *

# import os, shutil

# # --- 1. Khởi tạo Spark Session và Schemas ---
# print("Đang khởi tạo Spark Session...")
# spark = (
#     SparkSession.builder
#     .appName("BookRecommenderTransform") \
#     .master("local[*]") \
#     .config("spark.executor.memory", "8g") \
#     # THAY ĐỔI: Cấu hình driver JDBC cho MSSQL
#     # Bạn cần tải file JAR (ví dụ: mssql-jdbc-12.4.2.jre8.jar) 
#     # và cung cấp đường dẫn tuyệt đối tại đây.
#     .config("spark.jars", "/path/to/your/mssql-jdbc-12.4.2.jre8.jar") \
#     .getOrCreate()
# )

# book_tags_schema= StructType([
#     StructField('goodreads_book_id', StringType(), True),
#     StructField('tag_id', StringType(), True),
#     StructField('count', IntegerType(), True),   
# ])

# books_schema = StructType([
#     StructField("index", StringType(), True),
#     StructField("book_id", StringType(), True),
#     StructField("best_book_id", StringType(), True),
#     StructField("work_id", StringType(), True),
#     StructField("books_count", IntegerType(), True),
#     StructField("isbn", StringType(), True),
#     StructField("isbn13", StringType(), True),
#     StructField("authors", StringType(), True),
#     StructField("original_publication_year", DoubleType(), True),
#     StructField("original_title", StringType(), True),
#     StructField("title", StringType(), True),
#     StructField("language_code", StringType(), True),
#     StructField("average_rating", DoubleType(), True),
#     StructField("ratings_count", IntegerType(), True),
#     StructField("work_ratings_count", IntegerType(), True),
#     StructField("work_text_reviews_count", IntegerType(), True),
#     StructField("ratings_1", IntegerType(), True),
#     StructField("ratings_2", IntegerType(), True),
#     StructField("ratings_3", IntegerType(), True),
#     StructField("ratings_4", IntegerType(), True),
#     StructField("ratings_5", IntegerType(), True),
#     StructField("image_url", StringType(), True),
#     StructField("small_image_url", StringType(), True)
# ])

# ratings_schema= StructType([
#     StructField('book_id', StringType(), True),
#     StructField('user_id', StringType(), True),
#     StructField('rating', IntegerType(), True),   
# ])

# tags_schema= StructType([
#     StructField('tag_id', IntegerType(), True),
#     StructField('tag_name', StringType(), True), 
# ])

# # --- 2. Đọc dữ liệu (Giữ nguyên) ---
# print("Đang đọc dữ liệu từ CSV...")
# df_book_tags = spark.read.csv("archive/book_tags.csv", header=True, schema= book_tags_schema)
# df_books     = spark.read.csv("archive/books.csv", header=True, schema= books_schema)
# df_ratings   = spark.read.csv("archive/ratings.csv", header=True, schema= ratings_schema)
# df_tags      = spark.read.csv("archive/tags.csv", header=True, schema= tags_schema)
# # df_to_read   = spark.read.csv("archive/to_read.csv", header=True, schema= to_read_schema) # Dữ liệu này có thể dùng sau

# print("Đã đọc dữ liệu xong.")

# # --- 3. Xử lý Bảng 1: interactions_df (User-Item-Rating) ---
# # Mục tiêu: Tạo bảng (user_id, work_id, rating)
# # Dùng work_id (tác phẩm) thay vì book_id (phiên bản)
# print("Bắt đầu xử lý Bảng 1: Interactions (Collaborative Filtering)...")

# # Lọc các cột cần thiết từ df_books
# df_book_work_map = df_books.select("book_id", "work_id").distinct()

# # Join ratings với map để lấy work_id
# # Xử lý trường hợp người dùng rate nhiều phiên bản (book_id) của cùng 1 tác phẩm (work_id)
# # -> Lấy rating TRUNG BÌNH của họ cho tác phẩm đó
# interactions_df = (
#     df_ratings
#     .na.drop() # Bỏ các rating null
#     .join(df_book_work_map, "book_id", "inner")
#     .groupBy("user_id", "work_id")
#     .agg(avg("rating").alias("rating"))
#     .select(
#         col("user_id").cast(IntegerType()),
#         col("work_id").cast(IntegerType()),
#         col("rating")
#     )
# )
# interactions_df = interactions_df.na.drop() # Đảm bảo user_id, work_id là số

# print("Hoàn thành Bảng 1 (Interactions):")
# interactions_df.show(5)
# interactions_df.printSchema()
# print(f"Tổng số lượt tương tác (ratings): {interactions_df.count()}")


# # --- 4. Xử lý Bảng 2: book_features_df (Item Features) ---
# # Mục tiêu: Tạo bảng (work_id, authors, year, tags_list)
# print("\nBắt đầu xử lý Bảng 2: Book Features (Content-Based)...")

# # 4a. Lấy các feature cơ bản từ df_books
# # Nhóm theo work_id và lấy thông tin đại diện (ví dụ: lấy của bản đầu tiên)
# # Chúng ta cũng lấy 'work_ratings_count' làm 'total_ratings_count' để xử lý Cold Start
# book_base_features = (
#     df_books
#     .groupBy("work_id")
#     .agg(
#         first("original_title").alias("title"),
#         first("authors").alias("authors"),
#         first("original_publication_year").alias("year"),
#         first("average_rating").alias("average_rating"),
#         first("work_ratings_count").alias("total_ratings_count"),
#         first("image_url").alias("image_url")
#     )
# )

# # 4b. Xử lý Tags: Ghép tags thành một danh sách (list) cho mỗi work_id
# # Join book_tags với tags để lấy tag_name
# df_named_tags = df_book_tags.join(df_tags, "tag_id", "inner")

# # Join với map (df_book_work_map) để lấy work_id
# # Tổng hợp 'count' cho các tag_name bị trùng lặp trong cùng 1 work_id (do nhiều book_id)
# work_tags_agg = (
#     df_named_tags
#     .join(df_book_work_map, df_named_tags.goodreads_book_id == df_book_work_map.book_id, "inner")
#     .groupBy("work_id", "tag_name")
#     .agg(sum("count").alias("tag_count"))
# )

# # Lấy Top 20 tags phổ biến nhất cho mỗi work_id (để loại bỏ nhiễu)
# window_spec = Window.partitionBy("work_id").orderBy(col("tag_count").desc())
# top_work_tags = (
#     work_tags_agg
#     .withColumn("rank", rank().over(window_spec))
#     .filter(col("rank") <= 20) # Lấy top 20 tags
# )

# # Gom các tag_name thành 1 danh sách (array)
# book_tags_list = (
#     top_work_tags
#     .groupBy("work_id")
#     .agg(collect_list("tag_name").alias("tags_array")) # Đổi tên tạm để tránh nhầm lẫn
# )

# # 4c. Join base features và tag list
# book_features_df = (
#     book_base_features
#     .join(book_tags_list, "work_id", "left")
#     .select(
#         col("work_id").cast(IntegerType()),
#         col("title"),
#         col("authors"),
#         col("year"),
#         col("average_rating"),
#         col("total_ratings_count"), # Rất quan trọng cho việc xử lý Cold Start
#         col("image_url"),
#         # SỬA LỖI: Chuyển Array<String> thành String, dùng dấu | ngăn cách
#         concat_ws("|", col("tags_array")).alias("tags") 
#     )
# )
# book_features_df = book_features_df.na.drop(subset=["work_id"]) # Đảm bảo work_id không null

# print("Hoàn thành Bảng 2 (Book Features):")
# book_features_df.show(5, truncate=False)
# book_features_df.printSchema() # Bây giờ 'tags' sẽ là kiểu String
# print(f"Tổng số sách (works): {book_features_df.count()}")


# # --- 5. Lưu kết quả vào Database ---
# print("\nBắt đầu lưu 2 bộ dữ liệu vào Database...")

# # Cấu hình kết nối Database (THAY ĐỔI: MSSQL)
# # *** THAY ĐỔI CÁC GIÁ TRỊ NÀY THEO CẤU HÌNH CỦA BẠN ***
# db_url = "jdbc:sqlserver://localhost:1433;databaseName=book_recommender_db"
# db_properties = {
#     "user": "mssql_user",
#     "password": "mssql_password",
#     "driver": "com.microsoft.sqlserver.jdbc.SQLServerDriver"
# }

# # Lưu Bảng 1: Interactions Dataset
# interactions_table = "interactions_dataset" # Tên bảng trong DB
# print(f"Đang lưu Bảng 1 vào table: {interactions_table}")
# (
#     interactions_df
#     .write
#     .jdbc(url=db_url, table=interactions_table, mode="overwrite", properties=db_properties)
# )
# print(f"Đã lưu Interactions Dataset vào table: {interactions_table}")

# # Lưu Bảng 2: Book Features Dataset
# features_table = "book_features_dataset" # Tên bảng trong DB
# print(f"Đang lưu Bảng 2 vào table: {features_table}")
# (
#     book_features_df
#     .write
#     .jdbc(url=db_url, table=features_table, mode="overwrite", properties=db_properties)
# )
# print(f"Đã lưu Book Features Dataset vào table: {features_table}")


# print("\n--- Hoàn tất ETL và lưu vào Database ---")
# spark.stop()

from pyspark.sql import SparkSession
from pyspark.sql.functions import *
from pyspark.sql.types import *

import os, shutil
spark = (
    SparkSession.builder
    .appName("BookRecommenderTransform") \
    .master("local[10]") \
    .config("spark.executor.memory", "8g") \
    .getOrCreate()
)
sc = spark.sparkContext

# Tạo một RDD từ một list bằng parallelize()
rdd_data = sc.parallelize([1, 2, 3, 4, 5]) 
rdd_data.collect()
rdd_data.getNumPartitions()