from app.api.routes.legacy import build_legacy_router
from app.api.routes.v1 import build_v1_router
from app.api.routes.web import build_web_router

__all__ = ["build_web_router", "build_v1_router", "build_legacy_router"]
