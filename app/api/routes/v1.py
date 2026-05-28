from __future__ import annotations

from fastapi import APIRouter, Request

from app.api.contracts import ServiceHooks
from app.api.http_utils import (
    book_id_path_arg,
    int_query_arg,
    json_error,
    purchase_recommendations_error,
    required_text_query_arg,
    user_id_payload_value,
    user_id_query_arg,
)


def build_v1_router(*, services: ServiceHooks, api_version: str) -> APIRouter:
    router = APIRouter()

    @router.get(f"/api/{api_version}/health")
    async def health_check_api():
        return {"status": "ok", "version": api_version}

    @router.get(f"/api/{api_version}/books/popular")
    async def popular_books_api(request: Request):
        num, error_response = int_query_arg(request, "num", default=9, minimum=1, maximum=50)
        if error_response:
            return error_response
        books = services.get_popular_books(num)
        return {"version": api_version, "results_count": len(books), "books": books}

    async def search_books_payload(request: Request):
        query, error_response = required_text_query_arg(request, "query")
        if error_response:
            return error_response

        books, error = services.find_books_by_query(query)
        if error:
            return json_error(
                "Hệ thống tìm kiếm đang tạm thời không khả dụng.",
                503,
                "service_unavailable",
            )

        return {
            "version": api_version,
            "query": query,
            "results_count": len(books),
            "books": books,
        }

    @router.get(f"/api/{api_version}/books/search")
    async def search_books_api(request: Request):
        return await search_books_payload(request)

    @router.get(f"/api/{api_version}/search")
    async def search_api(request: Request):
        return await search_books_payload(request)

    def book_recommendations_payload(book_id: str, request: Request):
        normalized_book_id, error_response = book_id_path_arg(book_id)
        if error_response:
            return error_response

        num, error_response = int_query_arg(request, "num", default=10, minimum=1, maximum=50)
        if error_response:
            return error_response

        books, error, status_code = services.get_recommendations_for_book(normalized_book_id, num)
        if error:
            code = "not_found" if status_code == 404 else "recommendation_error"
            message = error if status_code == 404 else "Hệ thống gợi ý đang tạm thời không khả dụng."
            return json_error(message, status_code, code)

        return {
            "version": api_version,
            "book_id": str(normalized_book_id),
            "results_count": len(books),
            "books": books,
        }

    @router.get(f"/api/{api_version}/books/{{book_id}}/recommendations")
    async def book_recommendations_api(book_id: str, request: Request):
        return book_recommendations_payload(book_id, request)

    @router.post(f"/api/{api_version}/purchases/recommendations")
    async def purchase_recommendations_api(request: Request):
        try:
            payload = await request.json()
        except Exception:
            payload = {}

        book_id = payload.get("book_id")
        user_id = payload.get("user_id")
        num = payload.get("num", 10)

        books, error, status_code = services.get_recommendations_after_purchase(
            user_id=user_id,
            book_id=book_id,
            num=num,
        )
        if error:
            return purchase_recommendations_error(error, status_code)

        return {
            "version": api_version,
            "user_id": user_id_payload_value(user_id),
            "book_id": str(book_id).strip(),
            "results_count": len(books),
            "books": books,
        }

    @router.get(f"/api/{api_version}/recommendations")
    async def recommendations_api(request: Request):
        user_id, error_response = user_id_query_arg(request, "user_id", required=True)
        if error_response:
            return error_response

        num, error_response = int_query_arg(request, "num", default=10, minimum=1, maximum=50)
        if error_response:
            return error_response

        books, error, status_code = services.get_recommendations_for_user(user_id, num=num)
        if error:
            code = "not_found" if status_code == 404 else "service_unavailable"
            return json_error(error, status_code, code)

        return {
            "version": api_version,
            "user_id": user_id,
            "results_count": len(books),
            "books": books,
        }

    return router
