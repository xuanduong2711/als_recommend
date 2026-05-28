from __future__ import annotations

from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse, RedirectResponse

from app.api.contracts import ServiceHooks, WebContext
from app.api.http_utils import form_int_arg, int_query_arg


def build_web_router(*, services: ServiceHooks, web: WebContext) -> APIRouter:
    router = APIRouter()

    @router.get("/", response_class=HTMLResponse)
    async def index(request: Request):
        return web.templates.TemplateResponse(request, "index.html", {})

    @router.api_route("/recommend/hybrid_books", methods=["GET", "POST"], response_class=HTMLResponse)
    async def hybrid_books(request: Request):
        if request.method == "POST":
            user_id = await form_int_arg(request, "user_id")
        else:
            user_id, _ = int_query_arg(request, "user_id", minimum=1, required=False)

        if user_id is None:
            return RedirectResponse(url="/", status_code=303)

        books, error, status_code = services.get_recommendations_for_user(user_id)

        if error and status_code == 404:
            return web.templates.TemplateResponse(
                request,
                "content_based.html",
                {
                    "user_id": user_id,
                    "message": error,
                    "show_popular": True,
                },
            )

        if error:
            return web.templates.TemplateResponse(
                request,
                "content_based.html",
                {"user_id": user_id, "error": error},
                status_code=status_code,
            )

        return web.templates.TemplateResponse(
            request,
            "content_based.html",
            {"user_id": user_id, "books": books},
        )

    @router.get("/recommend/popular_books")
    async def popular_books_legacy(request: Request):
        num, _ = int_query_arg(request, "num", default=9, minimum=1, maximum=50)
        return {"books": services.get_popular_books(num)}

    @router.get("/search", response_class=HTMLResponse)
    async def search(request: Request):
        query = request.query_params.get("query", "").strip()
        if not query:
            return web.templates.TemplateResponse(request, "search.html", {})

        books, error = services.find_books_by_query(query)
        if error:
            return web.templates.TemplateResponse(
                request,
                "search.html",
                {"query": query, "error": error},
            )

        return web.templates.TemplateResponse(
            request,
            "search.html",
            {
                "query": query,
                "books": books,
                "results_count": len(books),
            },
        )

    return router
