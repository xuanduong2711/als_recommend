# app/main.py
import time
from urllib.parse import parse_qs

from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.config import Config
from app.services.recommender import (
    find_books_by_query,
    get_popular_books,
    get_recommendations_after_purchase,
    get_recommendations_for_book,
    get_recommendations_for_user,
)

API_VERSION = "v1"
templates = Jinja2Templates(directory="app/templates")


def _is_api_request(path: str) -> bool:
    return path.startswith("/api/")


def _json_error(message: str, status_code: int, code: str = "bad_request") -> JSONResponse:
    return JSONResponse(
        {"error": {"code": code, "message": message}},
        status_code=status_code,
    )


def _int_query_arg(
    request: Request,
    name: str,
    default: int | None = None,
    minimum: int | None = None,
    maximum: int | None = None,
    required: bool = False,
) -> tuple[int | None, JSONResponse | None]:
    raw_value = request.query_params.get(name)

    if raw_value is None or raw_value == "":
        if required:
            return None, _json_error(f"Thiếu tham số {name}.", 400, "missing_parameter")
        return default, None

    try:
        value = int(raw_value)
    except ValueError:
        return None, _json_error(f"Tham số {name} phải là số nguyên.", 400, "invalid_parameter")

    if minimum is not None and value < minimum:
        return None, _json_error(
            f"Tham số {name} phải lớn hơn hoặc bằng {minimum}.",
            400,
            "invalid_parameter",
        )

    if maximum is not None and value > maximum:
        return None, _json_error(
            f"Tham số {name} phải nhỏ hơn hoặc bằng {maximum}.",
            400,
            "invalid_parameter",
        )

    return value, None


def _required_text_query_arg(
    request: Request,
    name: str,
    max_length: int = 100,
) -> tuple[str | None, JSONResponse | None]:
    value = request.query_params.get(name, "").strip()

    if not value:
        return None, _json_error(f"Thiếu tham số {name}.", 400, "missing_parameter")

    if len(value) > max_length:
        return None, _json_error(
            f"Tham số {name} không được vượt quá {max_length} ký tự.",
            400,
            "invalid_parameter",
        )

    return value, None


async def _form_int_arg(request: Request, name: str) -> int | None:
    body = (await request.body()).decode("utf-8")
    values = parse_qs(body)
    raw_value = values.get(name, [None])[0]
    try:
        return int(raw_value) if raw_value not in (None, "") else None
    except ValueError:
        return None


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

        if _is_api_request(request.url.path):
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


def create_app() -> FastAPI:
    app = FastAPI(title="BookStore Recommendation API", debug=Config.DEBUG)
    app.mount("/static", StaticFiles(directory="app/static"), name="static")
    _register_operational_hooks(app)

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException):
        if exc.status_code == 404 and _is_api_request(request.url.path):
            return _json_error("Không tìm thấy endpoint.", 404, "not_found")
        if _is_api_request(request.url.path):
            return _json_error("Lỗi hệ thống. Vui lòng thử lại sau.", exc.status_code, "http_error")
        if exc.status_code == 404:
            return HTMLResponse("Không tìm thấy trang.", status_code=404)
        return HTMLResponse("Lỗi hệ thống. Vui lòng thử lại sau.", status_code=exc.status_code)

    @app.get("/", response_class=HTMLResponse)
    async def index(request: Request):
        return templates.TemplateResponse(request, "index.html", {})

    @app.api_route("/recommend/hybrid_books", methods=["GET", "POST"], response_class=HTMLResponse)
    async def hybrid_books(request: Request):
        if request.method == "POST":
            user_id = await _form_int_arg(request, "user_id")
        else:
            user_id, _ = _int_query_arg(request, "user_id", minimum=1, required=False)

        if user_id is None:
            return RedirectResponse(url="/", status_code=303)

        books, error, status_code = get_recommendations_for_user(user_id)

        if error and status_code == 404:
            return templates.TemplateResponse(
                request,
                "content_based.html",
                {
                    "user_id": user_id,
                    "message": error,
                    "show_popular": True,
                },
            )

        if error:
            return templates.TemplateResponse(
                request,
                "content_based.html",
                {"user_id": user_id, "error": error},
                status_code=status_code,
            )

        return templates.TemplateResponse(
            request,
            "content_based.html",
            {"user_id": user_id, "books": books},
        )

    @app.get("/recommend/popular_books")
    async def popular_books_legacy(request: Request):
        num, _ = _int_query_arg(request, "num", default=9, minimum=1, maximum=50)
        return {"books": get_popular_books(num)}

    @app.get("/search", response_class=HTMLResponse)
    async def search(request: Request):
        query = request.query_params.get("query", "").strip()
        if not query:
            return templates.TemplateResponse(request, "search.html", {})

        books, error = find_books_by_query(query)
        if error:
            return templates.TemplateResponse(
                request,
                "search.html",
                {"query": query, "error": error},
            )

        return templates.TemplateResponse(
            request,
            "search.html",
            {
                "query": query,
                "books": books,
                "results_count": len(books),
            },
        )

    @app.get(f"/api/{API_VERSION}/health")
    async def health_check_api():
        return {"status": "ok", "version": API_VERSION}

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

    @app.get(f"/api/{API_VERSION}/books/popular")
    async def popular_books_api(request: Request):
        num, error_response = _int_query_arg(request, "num", default=9, minimum=1, maximum=50)
        if error_response:
            return error_response
        books = get_popular_books(num)
        return {"version": API_VERSION, "results_count": len(books), "books": books}

    async def _search_books_payload(request: Request):
        query, error_response = _required_text_query_arg(request, "query")
        if error_response:
            return error_response

        books, error = find_books_by_query(query)
        if error:
            return _json_error(
                "Hệ thống tìm kiếm đang tạm thời không khả dụng.",
                503,
                "service_unavailable",
            )

        return {
            "version": API_VERSION,
            "query": query,
            "results_count": len(books),
            "books": books,
        }

    @app.get(f"/api/{API_VERSION}/books/search")
    async def search_books_api(request: Request):
        return await _search_books_payload(request)

    @app.get(f"/api/{API_VERSION}/search")
    async def search_api(request: Request):
        return await _search_books_payload(request)

    def _book_id_path_arg(book_id: str) -> tuple[str | None, JSONResponse | None]:
        book_id = str(book_id).strip()
        if not book_id:
            return None, _json_error("Thiếu tham số book_id.", 400, "missing_parameter")
        if len(book_id) > 64:
            return None, _json_error(
                "Tham số book_id không được vượt quá 64 ký tự.",
                400,
                "invalid_parameter",
            )

        return book_id, None

    def _book_recommendations_payload(book_id: str, request: Request):
        book_id, error_response = _book_id_path_arg(book_id)
        if error_response:
            return error_response

        num, error_response = _int_query_arg(request, "num", default=10, minimum=1, maximum=50)
        if error_response:
            return error_response

        books, error, status_code = get_recommendations_for_book(book_id, num)
        if error:
            code = "not_found" if status_code == 404 else "recommendation_error"
            message = error if status_code == 404 else "Hệ thống gợi ý đang tạm thời không khả dụng."
            return _json_error(message, status_code, code)

        return {
            "version": API_VERSION,
            "book_id": str(book_id),
            "results_count": len(books),
            "books": books,
        }

    def _purchase_recommendations_error(error: str, status_code: int) -> JSONResponse:
        if status_code == 404:
            code = "not_found"
        elif status_code == 503:
            code = "service_unavailable"
        elif "Thiếu" in error:
            code = "missing_parameter"
        else:
            code = "invalid_parameter"
        return _json_error(error, status_code, code)

    @app.get(f"/api/{API_VERSION}/books/{{book_id}}/recommendations")
    async def book_recommendations_api(book_id: str, request: Request):
        return _book_recommendations_payload(book_id, request)

    @app.get("/api/ML/{book_id}")
    async def ml_book_recommendations_api(book_id: str, request: Request):
        return _book_recommendations_payload(book_id, request)

    @app.post("/api/ML/{book_id}")
    async def ml_purchase_recommendations_api(book_id: str, request: Request):
        book_id, error_response = _book_id_path_arg(book_id)
        if error_response:
            return error_response

        try:
            payload = await request.json()
        except Exception:
            payload = {}

        user_id = payload.get("user_id")
        num = payload.get("num", 10)

        books, error, status_code = get_recommendations_after_purchase(
            user_id=user_id,
            book_id=book_id,
            num=num,
        )
        if error:
            return _purchase_recommendations_error(error, status_code)

        return {
            "version": API_VERSION,
            "user_id": int(user_id),
            "book_id": str(book_id).strip(),
            "results_count": len(books),
            "books": books,
        }

    @app.post(f"/api/{API_VERSION}/purchases/recommendations")
    async def purchase_recommendations_api(request: Request):
        try:
            payload = await request.json()
        except Exception:
            payload = {}

        book_id = payload.get("book_id")
        user_id = payload.get("user_id")
        num = payload.get("num", 10)

        books, error, status_code = get_recommendations_after_purchase(
            user_id=user_id,
            book_id=book_id,
            num=num,
        )
        if error:
            return _purchase_recommendations_error(error, status_code)

        return {
            "version": API_VERSION,
            "user_id": int(user_id),
            "book_id": str(book_id).strip(),
            "results_count": len(books),
            "books": books,
        }

    @app.get(f"/api/{API_VERSION}/recommendations")
    async def recommendations_api(request: Request):
        user_id, error_response = _int_query_arg(request, "user_id", minimum=1, required=True)
        if error_response:
            return error_response

        num, error_response = _int_query_arg(request, "num", default=10, minimum=1, maximum=50)
        if error_response:
            return error_response

        books, error, status_code = get_recommendations_for_user(user_id, num=num)
        if error:
            code = "not_found" if status_code == 404 else "service_unavailable"
            return _json_error(error, status_code, code)

        return {
            "version": API_VERSION,
            "user_id": user_id,
            "results_count": len(books),
            "books": books,
        }

    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=5000, reload=Config.DEBUG)
