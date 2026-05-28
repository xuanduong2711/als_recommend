from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from recommender import (
    RecommenderUnavailable,
    get_popular_books,
    get_recommendations_for_book,
    validate_runtime_artifacts,
    warm_runtime,
)

API_VERSION = "v1"
REQUIRED_MODULES = ("fastapi", "uvicorn", "pandas", "pymssql", "sklearn", "scipy")

app = FastAPI(title="Book Recommendation API")


def json_error(message: str, status_code: int, code: str = "bad_request") -> JSONResponse:
    return JSONResponse(
        {"error": {"code": code, "message": message}},
        status_code=status_code,
    )


def _validate_python_environment() -> None:
    executable = Path(sys.executable) if sys.executable else None
    if executable is None or not executable.exists():
        raise RuntimeError("Python environment is not active or executable is unavailable.")

    missing = [module for module in REQUIRED_MODULES if importlib.util.find_spec(module) is None]
    if missing:
        raise RuntimeError("Missing runtime dependencies: " + ", ".join(sorted(missing)) + ".")


def _int_query_arg(
    request: Request,
    name: str,
    default: int,
    minimum: int = 1,
    maximum: int = 50,
) -> tuple[int | None, JSONResponse | None]:
    raw_value = request.query_params.get(name)
    if raw_value is None or raw_value == "":
        return default, None

    try:
        value = int(raw_value)
    except ValueError:
        return None, json_error(f"Parameter {name} must be an integer.", 400, "invalid_parameter")

    if value < minimum:
        return None, json_error(
            f"Parameter {name} must be greater than or equal to {minimum}.",
            400,
            "invalid_parameter",
        )

    if value > maximum:
        return None, json_error(
            f"Parameter {name} must be less than or equal to {maximum}.",
            400,
            "invalid_parameter",
        )

    return value, None


@app.on_event("startup")
async def validate_startup_preconditions() -> None:
    _validate_python_environment()
    validate_runtime_artifacts()
    warm_runtime()


@app.exception_handler(Exception)
async def unhandled_exception_handler(_request: Request, _exc: Exception):
    return json_error("Internal server error.", 500, "internal_error")


@app.get(f"/api/{API_VERSION}/health")
async def health_check():
    return {"status": "ok", "version": API_VERSION}


@app.get(f"/api/{API_VERSION}/books/popular")
async def popular_books(request: Request):
    num, error_response = _int_query_arg(request, "num", default=9)
    if error_response:
        return error_response

    try:
        books = get_popular_books(num)
    except RecommenderUnavailable as exc:
        return json_error(str(exc), 503, "service_unavailable")
    except Exception:
        return json_error("Recommendation service is unavailable.", 503, "service_unavailable")

    return {"version": API_VERSION, "results_count": len(books), "books": books}


@app.get(f"/api/{API_VERSION}/books/{{book_id}}/recommendations")
async def book_recommendations(book_id: str, request: Request):
    normalized_book_id = str(book_id).strip()
    if not normalized_book_id:
        return json_error("Missing book_id.", 400, "missing_parameter")

    num, error_response = _int_query_arg(request, "num", default=10)
    if error_response:
        return error_response

    books, error, status_code = get_recommendations_for_book(normalized_book_id, num)
    if error:
        if status_code == 404:
            return json_error(error, status_code, "not_found")
        if status_code == 400:
            return json_error(error, status_code, "invalid_parameter")
        return json_error("Recommendation service is unavailable.", status_code, "service_unavailable")

    return {
        "version": API_VERSION,
        "book_id": normalized_book_id,
        "results_count": len(books),
        "books": books,
    }


if __name__ == "__main__":
    import os

    import uvicorn

    uvicorn.run(
        app,
        host=os.environ.get("HOST", "0.0.0.0"),
        port=int(os.environ.get("PORT", "8001")),
    )
