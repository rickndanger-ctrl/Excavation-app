import os
from pathlib import Path
import subprocess
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[1]
LAUNCHER = ROOT / "scripts/launch-model-studio.sh"
INSTALLER = ROOT / "scripts/install-model-studio-app.sh"


class ModelStudioLauncherTests(unittest.TestCase):
    def _write_command(self, directory: Path, name: str, body: str) -> None:
        path = directory / name
        path.write_text("#!/bin/bash\nset -eu\n" + body)
        path.chmod(0o755)

    def _environment(self, home: Path, commands: Path, trace: Path) -> dict[str, str]:
        return {
            **os.environ,
            "HOME": str(home),
            "PATH": f"{commands}:/usr/bin:/bin",
            "MODEL_STUDIO_REPOSITORY": str(ROOT),
            "MODEL_STUDIO_HEALTH_ATTEMPTS": "2",
            "MODEL_STUDIO_HEALTH_DELAY_SECONDS": "0",
            "TRACE_FILE": str(trace),
        }

    def test_healthy_console_opens_without_touching_pm2(self):
        self.assertTrue(LAUNCHER.is_file(), "The one-click launcher source must exist")
        with tempfile.TemporaryDirectory() as directory:
            temp = Path(directory)
            commands = temp / "bin"
            commands.mkdir()
            trace = temp / "trace"
            self._write_command(commands, "curl", 'echo \'{"service": "model-studio", "status": "ok"}\'\n')
            self._write_command(commands, "pm2", 'echo "pm2 $*" >> "$TRACE_FILE"\n')
            self._write_command(commands, "open", 'echo "open $*" >> "$TRACE_FILE"\n')
            self._write_command(commands, "osascript", 'echo "osascript $*" >> "$TRACE_FILE"\n')

            result = subprocess.run(
                ["/bin/bash", str(LAUNCHER)],
                env=self._environment(temp, commands, trace),
                text=True,
                capture_output=True,
            )

            self.assertEqual(0, result.returncode, result.stderr)
            self.assertEqual("open http://127.0.0.1:8765/", trace.read_text().strip())

    def test_unhealthy_console_starts_one_named_pm2_app_then_waits_for_health(self):
        self.assertTrue(LAUNCHER.is_file(), "The one-click launcher source must exist")
        with tempfile.TemporaryDirectory() as directory:
            temp = Path(directory)
            commands = temp / "bin"
            commands.mkdir()
            trace = temp / "trace"
            ready = temp / "ready"
            self._write_command(
                commands,
                "curl",
                'if [[ -f "$READY_FILE" ]]; then echo \'{"service": "model-studio", "status": "ok"}\'; else exit 22; fi\n',
            )
            self._write_command(
                commands,
                "pm2",
                'echo "pm2 $*" >> "$TRACE_FILE"\nif [[ "$1" == "start" ]]; then touch "$READY_FILE"; fi\n',
            )
            self._write_command(commands, "open", 'echo "open $*" >> "$TRACE_FILE"\n')
            self._write_command(commands, "osascript", 'echo "osascript $*" >> "$TRACE_FILE"\n')
            environment = self._environment(temp, commands, trace)
            environment["READY_FILE"] = str(ready)

            result = subprocess.run(
                ["/bin/bash", str(LAUNCHER)], env=environment, text=True, capture_output=True
            )

            self.assertEqual(0, result.returncode, result.stderr)
            events = trace.read_text().splitlines()
            self.assertEqual(2, len(events))
            self.assertTrue(events[0].startswith("pm2 start "))
            self.assertTrue(events[0].endswith(" --only civil-model-studio --update-env"))
            self.assertEqual("open http://127.0.0.1:8765/", events[1])

    def test_startup_failure_shows_a_macos_error_and_never_opens_browser(self):
        self.assertTrue(LAUNCHER.is_file(), "The one-click launcher source must exist")
        with tempfile.TemporaryDirectory() as directory:
            temp = Path(directory)
            commands = temp / "bin"
            commands.mkdir()
            trace = temp / "trace"
            self._write_command(commands, "curl", "exit 22\n")
            self._write_command(commands, "pm2", 'echo "pm2 $*" >> "$TRACE_FILE"\nexit 1\n')
            self._write_command(commands, "open", 'echo "open $*" >> "$TRACE_FILE"\n')
            self._write_command(commands, "osascript", 'echo "osascript $*" >> "$TRACE_FILE"\n')

            result = subprocess.run(
                ["/bin/bash", str(LAUNCHER)],
                env=self._environment(temp, commands, trace),
                text=True,
                capture_output=True,
            )

            self.assertNotEqual(0, result.returncode)
            events = trace.read_text().splitlines()
            self.assertTrue(any(event.startswith("osascript ") for event in events))
            self.assertFalse(any(event.startswith("open ") for event in events))

    def test_restricted_app_shell_finds_pm2_in_the_user_local_bin(self):
        with tempfile.TemporaryDirectory() as directory:
            temp = Path(directory)
            commands = temp / "bin"
            commands.mkdir()
            user_bin = temp / ".local/bin"
            user_bin.mkdir(parents=True)
            trace = temp / "trace"
            ready = temp / "ready"
            self._write_command(
                commands,
                "curl",
                'if [[ -f "$READY_FILE" ]]; then echo \'{"service": "model-studio", "status": "ok"}\'; else exit 22; fi\n',
            )
            self._write_command(commands, "open", 'echo "open $*" >> "$TRACE_FILE"\n')
            self._write_command(commands, "osascript", 'echo "osascript $*" >> "$TRACE_FILE"\n')
            self._write_command(
                user_bin,
                "pm2",
                'echo "pm2 $*" >> "$TRACE_FILE"\ntouch "$READY_FILE"\n',
            )
            environment = self._environment(temp, commands, trace)
            environment["READY_FILE"] = str(ready)

            result = subprocess.run(
                ["/bin/bash", str(LAUNCHER)], env=environment, text=True, capture_output=True
            )

            self.assertEqual(0, result.returncode, result.stderr)
            self.assertTrue(trace.read_text().splitlines()[0].startswith("pm2 start "))

    def test_installer_builds_a_user_app_and_desktop_link_reproducibly(self):
        self.assertTrue(INSTALLER.is_file(), "The reproducible macOS app installer must exist")
        with tempfile.TemporaryDirectory() as directory:
            home = Path(directory)
            applications = home / "Applications"
            desktop = home / "Desktop"
            environment = {
                **os.environ,
                "HOME": str(home),
                "MODEL_STUDIO_APPLICATIONS_DIR": str(applications),
                "MODEL_STUDIO_DESKTOP_DIR": str(desktop),
            }

            first = subprocess.run(
                ["/bin/bash", str(INSTALLER)], env=environment, text=True, capture_output=True
            )
            second = subprocess.run(
                ["/bin/bash", str(INSTALLER)], env=environment, text=True, capture_output=True
            )

            app = applications / "Model Studio.app"
            shortcut = desktop / "Model Studio.app"
            repository_link = home / "Library/Application Support/Model Studio/repository"
            self.assertEqual(0, first.returncode, first.stderr)
            self.assertEqual(0, second.returncode, second.stderr)
            self.assertTrue((app / "Contents/MacOS/applet").is_file())
            self.assertTrue(shortcut.is_symlink())
            self.assertEqual(app.resolve(), shortcut.resolve())
            self.assertTrue(repository_link.is_symlink())
            self.assertEqual(ROOT, repository_link.resolve())


if __name__ == "__main__":
    unittest.main()
