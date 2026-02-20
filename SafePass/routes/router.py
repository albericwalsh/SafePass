"""Dynamic router registration for modular route files in `routes/`.
Each module should export a `register(app)` function.
"""
import pkgutil
import importlib
import logging
from pathlib import Path

LOGGER = logging.getLogger('routes.router')


def register_routes(app):
    # discover modules in this package
    package_name = __name__
    pkg_path = Path(__file__).parent
    modules = []
    for finder, name, ispkg in pkgutil.iter_modules([str(pkg_path)]):
        if name == '__init__':
            continue
        modules.append(name)

    # deterministic order (settings_admin first if present)
    modules.sort()
    if 'settings_admin' in modules:
        modules.remove('settings_admin')
        modules.insert(0, 'settings_admin')

    for mod in modules:
        try:
            m = importlib.import_module(f"routes.{mod}")
            if hasattr(m, 'register'):
                m.register(app)
                LOGGER.info(f"Registered routes from routes.{mod}")
            else:
                LOGGER.debug(f"routes.{mod} has no register(app) function")
        except Exception as e:
            LOGGER.exception(f"Failed to register routes from routes.{mod}: {e}")
