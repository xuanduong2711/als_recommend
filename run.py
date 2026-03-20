# run.py (Nằm ở thư mục gốc, bên ngoài app/)
from app.main import create_app
from app.core.config import Config

app = create_app()

if __name__ == "__main__":
    app.run(debug=Config.DEBUG, host='0.0.0.0', port=5000)