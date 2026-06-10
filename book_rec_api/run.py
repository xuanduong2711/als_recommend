from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

import uvicorn


PACKAGE_DIR = Path(__file__).resolve().parent
PACKAGE_ROOT = PACKAGE_DIR.parent
DEFAULT_PORT = 8000
DEFAULT_ENV_PATH = PACKAGE_ROOT / ".env"

_VENV_PYTHON = PACKAGE_DIR / ".venv" / "bin" / "python3"


def _ensure_venv() -> None:
    if _VENV_PYTHON.exists() and sys.executable != str(_VENV_PYTHON):
        os.execv(str(_VENV_PYTHON), [str(_VENV_PYTHON), *sys.argv])


def _load_local_env(path: Path = DEFAULT_ENV_PATH) -> None:
    if not path.exists():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip("\"'"))


def _ensure_package_import_path() -> None:
    package_root = str(PACKAGE_ROOT)
    if package_root not in sys.path:
        sys.path.insert(0, package_root)


def _default_host_for_os_name(os_name: str) -> str:
    """Use localhost on Windows so prod tests can bind safely."""
    return "127.0.0.1" if os_name == "nt" else "0.0.0.0"


def _default_host() -> str:
    return _default_host_for_os_name(os.name)


def load_app():
    _ensure_package_import_path()
    from book_rec_api.app import app

    return app


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run the Book Recommendation API server.")
    parser.add_argument("--host", default=os.getenv("HOST", _default_host()))
    parser.add_argument("--port", type=int, default=int(os.getenv("PORT", str(DEFAULT_PORT))))
    return parser


def main() -> None:
    _ensure_venv()
    _load_local_env()
    parser = _build_parser()
    args = parser.parse_args()
    uvicorn.run(load_app(), host=args.host, port=args.port)


if __name__ == "__main__":
    main()
