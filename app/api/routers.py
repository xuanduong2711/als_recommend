"""Compatibility facade for API router builders.

Route implementations are split by concern under :mod:`app.api.routes`.
"""

from app.api.routes import build_legacy_router, build_v1_router, build_web_router

__all__ = ["build_web_router", "build_v1_router", "build_legacy_router"]
