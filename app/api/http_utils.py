from __future__ import annotations

import re
from urllib.parse import parse_qs

from fastapi import Request
from fastapi.responses import JSONResponse

USER_ID_UUID_RE = re.compile(
    r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
)


def is_api_request(path: str) -> bool:
    return path.startswith("/api/")


def json_error(message: str, status_code: int, code: str = "bad_request") -> JSONResponse:
    return JSONResponse(
        {"error": {"code": code, "message": message}},
        status_code=status_code,
    )


def int_query_arg(
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
            return None, json_error(f"Thiếu tham số {name}.", 400, "missing_parameter")
        return default, None

    try:
        value = int(raw_value)
    except ValueError:
        return None, json_error(f"Tham số {name} phải là số nguyên.", 400, "invalid_parameter")

    if minimum is not None and value < minimum:
        return None, json_error(
            f"Tham số {name} phải lớn hơn hoặc bằng {minimum}.",
            400,
            "invalid_parameter",
        )

    if maximum is not None and value > maximum:
        return None, json_error(
            f"Tham số {name} phải nhỏ hơn hoặc bằng {maximum}.",
            400,
            "invalid_parameter",
        )

    return value, None


def required_text_query_arg(
    request: Request,
    name: str,
    max_length: int = 100,
) -> tuple[str | None, JSONResponse | None]:
    value = request.query_params.get(name, "").strip()

    if not value:
        return None, json_error(f"Thiếu tham số {name}.", 400, "missing_parameter")

    if len(value) > max_length:
        return None, json_error(
            f"Tham số {name} không được vượt quá {max_length} ký tự.",
            400,
            "invalid_parameter",
        )

    return value, None


def user_id_query_arg(
    request: Request,
    name: str = "user_id",
    required: bool = False,
) -> tuple[int | str | None, JSONResponse | None]:
    raw_value = request.query_params.get(name)

    if raw_value is None or raw_value.strip() == "":
        if required:
            return None, json_error(f"Thiếu tham số {name}.", 400, "missing_parameter")
        return None, None

    value = raw_value.strip()
    if value.isdigit():
        number = int(value)
        if number <= 0:
            return None, json_error(f"Tham số {name} phải là số nguyên.", 400, "invalid_parameter")
        return number, None

    if USER_ID_UUID_RE.fullmatch(value):
        return value.lower(), None

    return None, json_error(f"Tham số {name} phải là số nguyên.", 400, "invalid_parameter")


def user_id_payload_value(user_id: object) -> int | str:
    text = str(user_id).strip() if user_id is not None else ""
    if text.isdigit():
        return int(text)
    return text


def book_id_path_arg(book_id: str) -> tuple[str | None, JSONResponse | None]:
    book_id = str(book_id).strip()
    if not book_id:
        return None, json_error("Thiếu tham số book_id.", 400, "missing_parameter")
    if len(book_id) > 64:
        return None, json_error(
            "Tham số book_id không được vượt quá 64 ký tự.",
            400,
            "invalid_parameter",
        )

    return book_id, None


def purchase_recommendations_error(error: str, status_code: int) -> JSONResponse:
    if status_code == 404:
        code = "not_found"
    elif status_code == 503:
        code = "service_unavailable"
    elif "Thiếu" in error:
        code = "missing_parameter"
    else:
        code = "invalid_parameter"
    return json_error(error, status_code, code)


async def form_int_arg(request: Request, name: str) -> int | None:
    body = (await request.body()).decode("utf-8")
    values = parse_qs(body)
    raw_value = values.get(name, [None])[0]
    try:
        return int(raw_value) if raw_value not in (None, "") else None
    except ValueError:
        return None
