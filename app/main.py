# app/main.py
from flask import Flask, render_template
from app.core.config import Config
from app.api.recommend import recommend_bp
from app.api.search import search_bp

def create_app():
    """
    Hàm "Factory" để tạo ứng dụng Flask.
    Điều này giúp việc testing và mở rộng dễ dàng hơn.
    """
    # Khởi tạo Flask, trỏ 'static' và 'templates' đúng vào thư mục
    # của 'app'
    app = Flask(__name__, 
                static_folder='static', 
                template_folder='templates')
    
    # Tải cấu hình từ file config.py
    app.config.from_object(Config)
    
    # --- Đăng ký các Blueprints (Routes) ---
    app.register_blueprint(recommend_bp)
    app.register_blueprint(search_bp)
    
    # --- Định nghĩa các route cơ bản ---
    
    # Route cho Trang chủ
    @app.route('/')
    def index():
        """Render trang chủ (index.html)"""
        return render_template('index.html')

    # Xử lý lỗi 404
    @app.errorhandler(404)
    def page_not_found(e):
        """Render trang 404 tùy chỉnh (hoặc trả về JSON)"""
        # (Bạn có thể tạo file 404.html nếu muốn)
        return render_template('404.html'), 404

    return app

# --- Block này để chạy app ở chế độ development ---
# (Chỉ chạy khi bạn gõ: python app/main.py)
if __name__ == "__main__":
    app = create_app()
    app.run(debug=Config.DEBUG, host='0.0.0.0', port=5000)