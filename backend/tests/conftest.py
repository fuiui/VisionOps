from pathlib import Path
import os
import sys


BACKEND_ROOT = Path(__file__).parents[1]
sys.path.insert(0, str(BACKEND_ROOT))
os.environ.setdefault(
    "VISIONOPS_DB_PATH",
    str(Path(os.environ.get("TEMP", ".")) / f"visionops-pytest-{os.getpid()}.db"),
)
