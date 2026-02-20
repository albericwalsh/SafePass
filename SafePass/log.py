import time
import threading
import traceback
import os
import json
from enum import Enum

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------
LOG_DIR = "logs"
TIME_FORMAT = "%Y-%m-%d %H:%M:%S"
FILE_TIME_FORMAT = "%Y-%m-%d_%H-%M-%S"

_lock = threading.Lock()
_log_file = None
_log_to_file = True
_max_size_bytes = 5 * 1024 * 1024
_retention_days = 30


class LogLevel(Enum):
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"


# -----------------------------------------------------------------------------
# Initialisation
# -----------------------------------------------------------------------------
def initialize(app_name: str = "app", file_path: str | None = None, to_file: bool | None = None, max_size_mb: int | None = None, retention_days: int | None = None, settings_path: str | None = None):
    """
    Initialise le fichier de log UNE SEULE FOIS par instance.
    Les appels suivants sont ignorés.
    """
    global _log_file

    # Empêche toute ré-initialisation
    if _log_file is not None:
        return

    global _log_to_file, _max_size_bytes, _retention_days, LOG_DIR
    if to_file is not None:
        _log_to_file = bool(to_file)
    if max_size_mb is not None:
        try:
            _max_size_bytes = int(max_size_mb) * 1024 * 1024
        except Exception:
            pass
    if retention_days is not None:
        try:
            _retention_days = int(retention_days)
        except Exception:
            pass

    # Load advanced logging settings from settings.json if available
    try:
        if settings_path is None:
            # default settings path relative to project root
            settings_path = os.path.normpath(os.path.join(os.path.dirname(__file__), "data", "settings.json"))

        if os.path.exists(settings_path):
            try:
                with open(settings_path, "r", encoding="utf-8") as sf:
                    settings = json.load(sf)
            except Exception:
                settings = {}
        else:
            settings = {}

        adv_cfg = settings.get("advanced") if isinstance(settings, dict) else None
        defaults = {
            "log_dir": LOG_DIR,
            "max_size_mb": int(_max_size_bytes / (1024 * 1024)),
            "retention_days": int(_retention_days),
            "to_file": bool(_log_to_file)
        }

        # If no advanced config, inject defaults and persist
        if not isinstance(adv_cfg, dict):
            settings["advanced"] = defaults
            try:
                os.makedirs(os.path.dirname(settings_path), exist_ok=True)
                with open(settings_path, "w", encoding="utf-8") as sf:
                    json.dump(settings, sf, indent=2, ensure_ascii=False)
            except Exception:
                pass
            adv_cfg = defaults

        # Apply values from settings (advanced section)
        try:
            LOG_DIR = adv_cfg.get("log_dir", LOG_DIR)
            _log_to_file = bool(adv_cfg.get("to_file", _log_to_file))
            _max_size_bytes = int(adv_cfg.get("max_size_mb", int(_max_size_bytes / (1024 * 1024)))) * 1024 * 1024
            _retention_days = int(adv_cfg.get("retention_days", _retention_days))
        except Exception:
            pass
    except Exception:
        pass

    os.makedirs(LOG_DIR, exist_ok=True)

    # determine path
    if file_path:
        log_path = os.path.normpath(file_path)
        # if relative, make relative to cwd
        if not os.path.isabs(log_path):
            log_path = os.path.join(os.getcwd(), log_path)
        # if path points to a directory (or looks like one), create a file inside it
        try:
            if os.path.isdir(log_path) or os.path.splitext(log_path)[1] == '':
                # ensure directory exists
                os.makedirs(log_path, exist_ok=True)
                _log_file = os.path.join(log_path, f"{app_name}_{time.strftime(FILE_TIME_FORMAT)}.log")
            else:
                # ensure directory exists for file
                d = os.path.dirname(log_path)
                if d:
                    os.makedirs(d, exist_ok=True)
                _log_file = log_path
        except Exception:
            # fallback
            d = os.path.dirname(log_path)
            if d:
                try:
                    os.makedirs(d, exist_ok=True)
                except Exception:
                    pass
            _log_file = log_path
    else:
        # if there are existing log files for this app, pick the latest
        try:
            candidates = []
            for fn in os.listdir(LOG_DIR):
                if fn.startswith(f"{app_name}_") and fn.endswith(".log"):
                    fp = os.path.join(LOG_DIR, fn)
                    if os.path.isfile(fp):
                        candidates.append(fp)
            if candidates:
                # pick most recent by modification time
                latest = max(candidates, key=lambda p: os.path.getmtime(p))
                # if latest is under size limit, continue writing to it
                try:
                    if _max_size_bytes and os.path.getsize(latest) <= _max_size_bytes:
                        _log_file = latest
                    else:
                        # rotate old file by renaming and create a new file
                        try:
                            rot_name = f"{latest}.{int(time.time())}.old"
                            os.rename(latest, rot_name)
                        except Exception:
                            pass
                        _log_file = os.path.join(LOG_DIR, f"{app_name}_{time.strftime(FILE_TIME_FORMAT)}.log")
                except Exception:
                    _log_file = os.path.join(LOG_DIR, f"{app_name}_{time.strftime(FILE_TIME_FORMAT)}.log")
            else:
                _log_file = os.path.join(LOG_DIR, f"{app_name}_{time.strftime(FILE_TIME_FORMAT)}.log")
        except Exception:
            _log_file = os.path.join(LOG_DIR, f"{app_name}_{time.strftime(FILE_TIME_FORMAT)}.log")

    # create current log file if not present
    if _log_to_file and _log_file:
        try:
            # if file doesn't exist, create and write INIT line
            if not os.path.exists(_log_file):
                with open(_log_file, "w", encoding="utf-8") as f:
                    f.write(f"[{_now()}] [INIT] Log file created\n")
        except Exception:
            # fallback to console-only if cannot write
            _log_to_file = False

    # prune old logs according to retention
    try:
        if _retention_days is not None and _retention_days > 0:
            cutoff = time.time() - (_retention_days * 24 * 3600)
            for fn in os.listdir(LOG_DIR):
                fp = os.path.join(LOG_DIR, fn)
                try:
                    if os.path.isfile(fp):
                        if os.path.getmtime(fp) < cutoff:
                            try:
                                os.remove(fp)
                            except Exception:
                                pass
                except Exception:
                    pass
    except Exception:
        pass


# -----------------------------------------------------------------------------
# Niveau de log configurable
# -----------------------------------------------------------------------------
LEVEL_PRIORITY = {
    'DEBUG': 10,
    'INFO': 20,
    'WARNING': 30,
    'ERROR': 40,
    'CRITICAL': 50
}

_CURRENT_LEVEL = LEVEL_PRIORITY['INFO']

def set_level(level_str: str):
    global _CURRENT_LEVEL
    if not level_str:
        return
    lvl = LEVEL_PRIORITY.get(level_str.upper())
    if lvl is not None:
        _CURRENT_LEVEL = lvl


# -----------------------------------------------------------------------------
# Fonctions internes
# -----------------------------------------------------------------------------
def _now():
    return time.strftime(TIME_FORMAT)


def _write(level: LogLevel, message: str):
    global _log_file

    if _log_file is None:
        raise RuntimeError("Logger not initialized. Call initialize() first.")

    # filter by current level
    priority = LEVEL_PRIORITY.get(level.value, 0)
    if priority < _CURRENT_LEVEL:
        return

    log_line = f"[{_now()}] [{level.value}] {message}"

    with _lock:
        # rotate if needed
        try:
            if _log_to_file and _log_file and os.path.exists(_log_file) and _max_size_bytes and os.path.getsize(_log_file) > _max_size_bytes:
                # rotate current file by renaming with timestamp
                try:
                    rot_name = f"{_log_file}.{int(time.time())}.old"
                    os.rename(_log_file, rot_name)
                except Exception:
                    pass
        except Exception:
            pass

        if _log_to_file and _log_file:
            try:
                with open(_log_file, "a", encoding="utf-8", buffering=1) as f:
                    f.write(log_line + "\n")
                    f.flush()
            except Exception:
                # if write fails, fallback to console-only
                pass

    print(log_line, flush=True)



# -----------------------------------------------------------------------------
# API publique
# -----------------------------------------------------------------------------
def debug(message: str):
    _write(LogLevel.DEBUG, message)


def info(message: str):
    _write(LogLevel.INFO, message)


def warning(message: str):
    _write(LogLevel.WARNING, message)


def error(message: str, exc: Exception | None = None):
    _write(LogLevel.ERROR, message)
    if exc:
        _write(LogLevel.ERROR, str(exc))
        _write(LogLevel.ERROR, traceback.format_exc())


def critical(message: str, exc: Exception | None = None):
    _write(LogLevel.CRITICAL, message)
    if exc:
        _write(LogLevel.CRITICAL, str(exc))
        _write(LogLevel.CRITICAL, traceback.format_exc())
