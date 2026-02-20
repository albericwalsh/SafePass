import time
import threading
import traceback
from enum import Enum

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------
LOG_DIR = "logs"
TIME_FORMAT = "%Y-%m-%d %H:%M:%S"
FILE_TIME_FORMAT = "%Y-%m-%d_%H-%M-%S"

_lock = threading.Lock()
_log_file = None


class LogLevel(Enum):
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"


# -----------------------------------------------------------------------------
# Initialisation
# -----------------------------------------------------------------------------
def initialize(app_name: str = "app"):
    """
    Initialise le fichier de log UNE SEULE FOIS par instance.
    Les appels suivants sont ignorés.
    """
    global _log_file

    # Empêche toute ré-initialisation
    if _log_file is not None:
        return

    import os
    os.makedirs(LOG_DIR, exist_ok=True)

    filename = f"{LOG_DIR}/{app_name}_{time.strftime(FILE_TIME_FORMAT)}.log"
    _log_file = filename

    with open(_log_file, "w", encoding="utf-8") as f:
        f.write(f"[{_now()}] [INIT] Log file created\n")


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
        with open(_log_file, "a", encoding="utf-8", buffering=1) as f:
            f.write(log_line + "\n")
            f.flush()          # 🔥 écrit immédiatement
            # os.fsync(f.fileno())  # optionnel (ultra strict)

    print(log_line, flush=True)  # 🔥 affichage immédiat console



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
