# app/services/recommender.py
import pandas as pd
import os

# --- Tải Dữ Liệu (Load Data) 1 LẦN DUY NHẤT ---
BOOK_DATA_PATH = os.path.join('data', 'processed', 'clean_books.csv')
book_data = pd.DataFrame() # Khởi tạo một DataFrame rỗng

try:
    # Đọc file CSV ngay khi server khởi động
    book_data = pd.read_csv(BOOK_DATA_PATH)
    
    # (Tùy chọn) Xử lý dữ liệu để tối ưu
    book_data['book_title'] = book_data['book_title'].fillna('Không có tên')
    book_data['author'] = book_data['author'].fillna('Không rõ tác giả')
    
    print(f"--- Đã tải thành công {len(book_data)} cuốn sách từ {BOOK_DATA_PATH} ---")

except FileNotFoundError:
    print(f"!!! CẢNH BÁO: Không tìm thấy file {BOOK_DATA_PATH}. !!!")
    print("!!! SỬ DỤNG DỮ LIỆU GIẢ (MOCK DATA) !!!")
except Exception as e:
    print(f"Lỗi khi đọc file CSV: {e}. SỬ DỤNG DỮ LIỆU GIẢ.")

# --- KẾT THÚC TẢI DỮ LIỆU ---


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
        popular = book_data.sort_values(by='num_rating', ascending=False).head(num)
        
        # Chuyển đổi DataFrame của Pandas sang dạng list of dicts mà Frontend cần
        return popular.to_dict('records')
        # --- KẾT THÚC LOGIC THẬT ---

    except Exception as e:
        print(f"Lỗi khi lấy sách phổ biến: {e}")
        return []


def get_recommendations_for_user(user_id):
    """
    Lấy đề xuất Hybrid/Content-based cho một user_id.
    TODO: Tích hợp mô hình Hybrid (hoặc content-based) của bạn tại đây.
    """
    # (Hàm này vẫn dùng logic giả, vì nó cần mô hình ML)
    print(f"Service: Tạo đề xuất cho user_id: {user_id}...")
    
    try:
        # 1. Kiểm tra user_id
        if user_id == 0:
            return None, None, "User ID không hợp lệ. Vui lòng thử lại."
        
        # 2. Giả sử user_id > 1000 là không có trong hệ thống
        if user_id > 1000:
            return None, None, "Không tìm thấy thông tin cho User ID này. Xin vui lòng xem các sách bán chạy."
            
        # 3. Giả lập trả về thành công
        mock_based_on_book = {'book_title': 'Cuốn Sách User Đã Đọc Gần Đây', 'book_id': 999}
        # Lấy 3 cuốn sách ngẫu nhiên từ data thật để làm ví dụ
        if not book_data.empty:
             mock_recommendations = book_data.sample(3).to_dict('records')
        else:
            mock_recommendations = [
                {'book_title': f'Đề Xuất 1 cho User {user_id}', 'author': 'Tác giả X', 'price': 150000, 'avg_star': 4.7, 'num_rating': 200, 'genre': 'Khoa học', 'image_path': 'placeholder.jpg'},
            ]
        
        return mock_recommendations, mock_based_on_book, None # (books, based_on, error)
        
    except Exception as e:
        print(f"Lỗi khi tạo đề xuất: {e}")
        return None, None, f"Lỗi hệ thống: {e}"


def find_books_by_query(query):
    """
    Tìm kiếm sách dựa trên query TỪ DỮ LIỆU THẬT.
    """
    print(f"Service: Tìm kiếm với query: '{query}'...")
    
    if book_data.empty:
        print("Lỗi: Dữ liệu sách rỗng. Không thể tìm kiếm.")
        return [], "Hệ thống đang bảo trì. Vui lòng thử lại sau."

    try:
        # --- LOGIC THẬT ---
        # Tìm kiếm đơn giản: tìm query trong cột 'book_title' (không phân biệt hoa thường)
        results = book_data[
            book_data['book_title'].str.contains(query, case=False, na=False)
        ]
        
        # (Bạn có thể tìm cả trong 'author')
        # results_author = book_data[
        #     book_data['author'].str.contains(query, case=False, na=False)
        # ]
        # results = pd.concat([results_title, results_author]).drop_duplicates()
        
        print(f"Tìm thấy {len(results)} kết quả cho '{query}'")
        return results.to_dict('records'), None # (results, error)
        # --- KẾT THÚC LOGIC THẬT ---

    except Exception as e:
        print(f"Lỗi khi tìm kiếm: {e}")
        return [], f"Lỗi hệ thống khi tìm kiếm: {e}"