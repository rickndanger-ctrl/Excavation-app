import tempfile
import unittest
from pathlib import Path

from civil_plan_factory.toolchain import smoke_check


class ToolchainTests(unittest.TestCase):
    def test_smoke_check_runs_qgis_and_gdal_with_bundled_proj_database(self):
        with tempfile.TemporaryDirectory() as directory:
            app = Path(directory) / "QGIS.app" / "Contents"
            macos = app / "MacOS"
            proj = app / "Resources" / "qgis" / "proj"
            macos.mkdir(parents=True)
            proj.mkdir(parents=True)
            (proj / "proj.db").write_bytes(b"test")
            for name, version in (("qgis_process", "QGIS TEST"), ("gdalinfo", "GDAL TEST")):
                executable = macos / name
                executable.write_text(f"#!/bin/sh\nprintf '%s|%s\\n' '{version}' \"$PROJ_DATA\"\n")
                executable.chmod(0o755)

            report = smoke_check(app.parent)

            self.assertEqual("ok", report["status"])
            self.assertEqual("QGIS TEST", report["qgis_version"])
            self.assertEqual("GDAL TEST", report["gdal_version"])
            self.assertEqual(str(proj), report["proj_data"])
            self.assertEqual("FICTIONAL — TEST DATA — NOT FOR CONSTRUCTION", report["disclaimer"])


if __name__ == "__main__":
    unittest.main()
