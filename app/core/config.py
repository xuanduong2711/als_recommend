# app/core/config.py
import os


def _is_truthy(value) -> bool:
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


class Config:
    """
    Lớp cấu hình cơ sở cho ứng dụng.
    """
    # Khóa bí mật nên đặt qua biến môi trường trong production.
    SECRET_KEY = os.environ.get('SECRET_KEY') or os.urandom(32)
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'
    SESSION_COOKIE_SECURE = os.environ.get('SESSION_COOKIE_SECURE', 'false').lower() == 'true'

    # Bật/tắt chế độ debug (ưu tiên DEBUG, fallback FLASK_DEBUG).
    DEBUG = _is_truthy(os.environ.get('DEBUG', os.environ.get('FLASK_DEBUG', 'false')))

    # Tắt theo dõi (tracking) thay đổi của SQLAlchemy, giảm tải
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # (Tùy chọn) Cấu hình đường dẫn CSDL của bạn (nếu dùng)
    # Ví dụ: 'mssql+pyodbc://username:password@your_server/your_database?driver=ODBC+Driver+17+for+SQL+Server'
    # SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL')
