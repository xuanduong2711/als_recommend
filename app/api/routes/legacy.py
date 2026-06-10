from __future__ import annotations

from fastapi import APIRouter, Request

from app.api.contracts import ServiceHooks
from app.api.http_utils import (
    book_id_path_arg,
    int_query_arg,
    json_error,
    purchase_recommendations_error,
    user_id_payload_value,
)


def build_legacy_router(*, services: ServiceHooks, api_version: str) -> APIRouter:
    router = APIRouter()

    @router.get("/api/books")
    async def books_api(request: Request):
        page_number, error_response = int_query_arg(
            request,
            "PageNumber",
            default=1,
            minimum=1,
            maximum=1000000,
        )
        if error_response:
            return error_response

        page_size, error_response = int_query_arg(
            request,
            "PageSize",
            default=40,
            minimum=1,
            maximum=200,
        )
        if error_response:
            return error_response

        return services.list_books_for_frontend(
            page_number=page_number,
            page_size=page_size,
            search_term=request.query_params.get("SearchTerm"),
            genre=request.query_params.get("Genre"),
            sort_by=request.query_params.get("SortBy"),
            sort_order=request.query_params.get("SortOrder"),
        )

    @router.get("/api/books/recommendations")
    async def books_recommendations_api(request: Request):
        count, error_response = int_query_arg(request, "count", default=8, minimum=1, maximum=50)
        if error_response:
            return error_response
        return services.get_popular_book_entities(count)

    @router.get("/api/books/{book_id}")
    async def book_detail_api(book_id: str):
        normalized_book_id, error_response = book_id_path_arg(book_id)
        if error_response:
            return error_response

        book, error, status_code = services.get_book_detail_for_frontend(normalized_book_id)
        if error:
            return json_error(error, status_code, "not_found")
        return book

    @router.post("/api/ML/{book_id}")
    async def ml_purchase_recommendations_api(book_id: str, request: Request):
        normalized_book_id, error_response = book_id_path_arg(book_id)
        if error_response:
            return error_response

        try:
            payload = await request.json()
        except Exception:
            payload = {}

        user_id = payload.get("user_id")
        num = payload.get("num", 10)

        books, error, status_code = services.get_recommendations_after_purchase(
            user_id=user_id,
            book_id=normalized_book_id,
            num=num,
        )
        if error:
            return purchase_recommendations_error(error, status_code)

        return {
            "version": api_version,
            "user_id": user_id_payload_value(user_id),
            "book_id": str(normalized_book_id).strip(),
            "results_count": len(books),
            "books": books,
        }

    return router
