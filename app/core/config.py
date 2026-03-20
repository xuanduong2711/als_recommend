# app/core/config.py
import os

class Config:
    """
    Lớp cấu hình cơ sở cho ứng dụng.
    """
    # Khóa bí mật RẤT quan trọng để bảo mật session, nên đặt là một chuỗi ngẫu nhiên
    # Đặt trong biến môi trường là tốt nhất, nhưng để 'dev' ở đây cho đơn giản
    SECRET_KEY = os.environ.get('SECRET_KEY', 'my_dev_secret_key_12345')
    
    # Bật/tắt chế độ debug
    DEBUG = os.environ.get('FLASK_DEBUG', True)
    
    # Tắt theo dõi (tracking) thay đổi của SQLAlchemy, giảm tải
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # (Tùy chọn) Cấu hình đường dẫn CSDL của bạn (nếu dùng)
    # Ví dụ: 'mssql+pyodbc://username:password@your_server/your_database?driver=ODBC+Driver+17+for+SQL+Server'
    # SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL')