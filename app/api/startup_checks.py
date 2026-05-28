from __future__ import annotations

import importlib.util
import os
import sys
from pathlib import Path

REQUIRED_RUNTIME_MODULES = ("fastapi", "pandas")
DEFAULT_REQUIRED_PATHS = {
    "MODEL_PKL_PATH": Path("data/models/model.pkl"),
    "BOOKS_CSV_PATH": Path("data/books.csv"),
    "REQUIREMENTS_PATH": Path("requirements.txt"),
}


def _is_truthy(value: str | None) -> bool:
    return (value or "").strip().lower() in {"1", "true", "yes", "on"}


def _required_runtime_paths() -> list[Path]:
    paths: list[Path] = []
    for env_name, default_path in DEFAULT_REQUIRED_PATHS.items():
        configured = os.environ.get(env_name)
        normalized = configured.strip() if configured is not None else ""
        paths.append(Path(normalized) if normalized else default_path)
    return paths


def _python_environment_is_available() -> bool:
    executable = Path(sys.executable) if sys.executable else None
    return executable is not None and executable.exists()


def _validate_python_dependencies() -> list[str]:
    missing_modules: list[str] = []
    for module_name in REQUIRED_RUNTIME_MODULES:
        if importlib.util.find_spec(module_name) is None:
            missing_modules.append(module_name)

    if not missing_modules:
        return []

    return [
        "Missing required runtime dependencies: " + ", ".join(sorted(missing_modules)) + "."
    ]


def validate_startup_preconditions() -> None:
    if _is_truthy(os.environ.get("SKIP_RUNTIME_PRECONDITION_CHECKS")):
        return

    errors: list[str] = []
    if not _python_environment_is_available():
        errors.append("Python environment is not active or executable is unavailable.")

    errors.extend(_validate_python_dependencies())

    for path in _required_runtime_paths():
        if not path.exists():
            errors.append(f"Required artifact not found: {path}")
            continue
        if not path.is_file():
            errors.append(f"Required artifact is not a file: {path}")
            continue
        if not os.access(path, os.R_OK):
            errors.append(f"Required artifact is not readable: {path}")

    if errors:
        details = "\n".join(f"- {item}" for item in errors)
        raise RuntimeError(f"Startup precondition failed:\n{details}")
