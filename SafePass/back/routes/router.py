"""Dynamic router registration for modular route files in `routes/`.
Each module should export a `register(app)` function.
"""
import pkgutil
import importlib
import logging
from pathlib import Path

LOGGER = logging.getLogger('back.routes.router')


STATIC_ROUTE_MODULES = [
    'settings_admin',
    'anssi_routes',
    'auth_routes',
    'crypting_routes',
    'data_routes',
    'export_routes',
    'extension_routes',
    'leaks_routes',
    'logs_routes',
    'path_routes',
    'url_routes',
]


def register_routes(app):
    # discover modules in this package (works in source mode)
    pkg_path = Path(__file__).parent
    discovered_modules = []
    try:
        for finder, name, ispkg in pkgutil.iter_modules([str(pkg_path)]):
            if name in ('__init__', 'router'):
                continue
            discovered_modules.append(name)
    except Exception:
        discovered_modules = []

    # Build final module list with deterministic order and PyInstaller-safe fallback.
    modules = []
    for name in STATIC_ROUTE_MODULES:
        if name not in modules:
            modules.append(name)
    for name in sorted(discovered_modules):
        if name not in modules:
            modules.append(name)

    for mod in modules:
        try:
            m = importlib.import_module(f"back.routes.{mod}")
            if hasattr(m, 'register'):
                m.register(app)
                LOGGER.info(f"Registered routes from back.routes.{mod}")
            else:
                LOGGER.debug(f"back.routes.{mod} has no register(app) function")
        except Exception as e:
            LOGGER.exception(f"Failed to register routes from back.routes.{mod}: {e}")
