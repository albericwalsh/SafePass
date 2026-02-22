def register_routes(app):
    """Dynamically import and register route modules located in `routes/`.
    Each module must expose a `register(app)` function.
    """
    import importlib
    import pkgutil
    import back.routes as routes
    for finder, name, ispkg in pkgutil.iter_modules(routes.__path__):
        module_name = f"back.routes.{name}"
        try:
            mod = importlib.import_module(module_name)
            if hasattr(mod, 'register') and callable(mod.register):
                mod.register(app)
        except Exception as e:
            # Log to console; app may not be fully configured for logging here
            print(f"router: failed to register {module_name}: {e}")
