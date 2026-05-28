import os
import time

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.contracts import ServiceHooks, WebContext
from app.api.http_utils import is_api_request, json_error
from app.api.routers import build_legacy_router, build_v1_router, build_web_router
from app.api.startup_checks import validate_startup_preconditions
from app.core.config import Config
from app.services.recommender import (
    find_books_by_query,
    get_book_detail_for_frontend,
    get_popular_book_entities,
    get_popular_books,
    get_recommendations_after_purchase,
    get_recommendations_for_book,
    get_recommendations_for_user,
    list_books_for_frontend,
)

API_VERSION = "v1"
templates = Jinja2Templates(directory="app/templates")


def _register_operational_hooks(app: FastAPI) -> None:
    app.state.api_metrics = {
        "requests_total": 0,
        "latency_ms_total": 0.0,
        "by_status": {},
        "by_path": {},
    }

    @app.middleware("http")
    async def add_security_headers_and_metrics(request: Request, call_next):
        started_at = time.perf_counter()
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "no-referrer")
        response.headers.setdefault(
            "Content-Security-Policy",
            "default-src 'self'; img-src 'self' https: data:; "
            "style-src 'self' 'unsafe-inline' https:; script-src 'self' 'unsafe-inline' https:; "
            "connect-src 'self';",
        )

        if is_api_request(request.url.path):
            response.headers.setdefault("Cache-Control", "no-store")
            elapsed_ms = (time.perf_counter() - started_at) * 1000
            metrics = app.state.api_metrics
            status_key = str(response.status_code)
            path_key = request.url.path
            metrics["requests_total"] += 1
            metrics["latency_ms_total"] += elapsed_ms
            metrics["by_status"][status_key] = metrics["by_status"].get(status_key, 0) + 1
            metrics["by_path"][path_key] = metrics["by_path"].get(path_key, 0) + 1

        return response


def _frontend_origins() -> list[str]:
    configured = os.environ.get("FRONTEND_ORIGINS")
    if configured:
        return [origin.strip() for origin in configured.split(",") if origin.strip()]
    return [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]


def create_app() -> FastAPI:
    app = FastAPI(title="BookStore Recommendation API", debug=Config.DEBUG)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_frontend_origins(),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.mount("/static", StaticFiles(directory="app/static"), name="static")
    _register_operational_hooks(app)

    @app.on_event("startup")
    async def validate_runtime_startup() -> None:
        validate_startup_preconditions()

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException):
        if exc.status_code == 404 and is_api_request(request.url.path):
            return json_error("Không tìm thấy endpoint.", 404, "not_found")
        if is_api_request(request.url.path):
            return json_error("Lỗi hệ thống. Vui lòng thử lại sau.", exc.status_code, "http_error")
        if exc.status_code == 404:
            return HTMLResponse("Không tìm thấy trang.", status_code=404)
        return HTMLResponse("Lỗi hệ thống. Vui lòng thử lại sau.", status_code=exc.status_code)

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, _exc: Exception):
        if is_api_request(request.url.path):
            return json_error("Lỗi hệ thống. Vui lòng thử lại sau.", 500, "internal_error")
        return HTMLResponse("Lỗi hệ thống. Vui lòng thử lại sau.", status_code=500)

    services = ServiceHooks(
        find_books_by_query=find_books_by_query,
        get_book_detail_for_frontend=get_book_detail_for_frontend,
        get_popular_book_entities=get_popular_book_entities,
        get_popular_books=get_popular_books,
        get_recommendations_after_purchase=get_recommendations_after_purchase,
        get_recommendations_for_book=get_recommendations_for_book,
        get_recommendations_for_user=get_recommendations_for_user,
        list_books_for_frontend=list_books_for_frontend,
    )

    app.include_router(build_web_router(services=services, web=WebContext(templates=templates)))
    app.include_router(build_v1_router(services=services, api_version=API_VERSION))
    app.include_router(build_legacy_router(services=services, api_version=API_VERSION))

    @app.get(f"/api/{API_VERSION}/metrics")
    async def metrics_api():
        metrics = app.state.api_metrics
        return {
            "version": API_VERSION,
            "requests_total": metrics.get("requests_total", 0),
            "latency_ms_total": round(metrics.get("latency_ms_total", 0.0), 2),
            "by_status": metrics.get("by_status", {}),
            "by_path": metrics.get("by_path", {}),
        }

    SPA_DIST = os.path.join(os.path.dirname(os.path.dirname(__file__)), "FrontEnd", "dist")

    if os.path.isdir(SPA_DIST):
        app.mount("/assets", StaticFiles(directory=os.path.join(SPA_DIST, "assets")), name="spa_assets")

        @app.get("/{full_path:path}")
        async def serve_spa(full_path: str = ""):
            if full_path.startswith("api/") or full_path.startswith("static/"):
                return HTMLResponse("Không tìm thấy endpoint.", status_code=404)
            index_path = os.path.join(SPA_DIST, "index.html")
            if os.path.isfile(index_path):
                return FileResponse(index_path)
            return HTMLResponse("Không tìm thấy trang.", status_code=404)

    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app:app", host="0.0.0.0", port=5227, reload=Config.DEBUG)
