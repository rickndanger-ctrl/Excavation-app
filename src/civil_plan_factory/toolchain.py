import os
from pathlib import Path
import subprocess

from .validation import DISCLAIMER


def smoke_check(qgis_app: Path) -> dict[str, str]:
    contents = Path(qgis_app) / "Contents"
    bin_dir = contents / "MacOS"
    proj_data = contents / "Resources" / "qgis" / "proj"
    required = {
        "qgis_process": bin_dir / "qgis_process",
        "gdalinfo": bin_dir / "gdalinfo",
        "proj.db": proj_data / "proj.db",
    }
    missing = [name for name, path in required.items() if not path.exists()]
    if missing:
        raise FileNotFoundError(f"QGIS application is missing: {', '.join(missing)}")
    env = os.environ.copy()
    env["PROJ_DATA"] = str(proj_data)
    env["PROJ_LIB"] = str(proj_data)

    versions: dict[str, str] = {}
    for key, executable in (("qgis_version", required["qgis_process"]), ("gdal_version", required["gdalinfo"])):
        result = subprocess.run(
            [str(executable), "--version"], env=env, text=True, capture_output=True, timeout=30
        )
        if result.returncode != 0:
            raise RuntimeError(f"{executable.name} failed: {result.stderr.strip()}")
        first_line = result.stdout.splitlines()[0].split("|", 1)[0].strip()
        versions[key] = first_line
    return {
        "status": "ok",
        "disclaimer": DISCLAIMER,
        **versions,
        "proj_data": str(proj_data),
    }
