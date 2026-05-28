from app.core.config import Config
from app import app

if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app:app", host="0.0.0.0", port=5227, reload=Config.DEBUG)
