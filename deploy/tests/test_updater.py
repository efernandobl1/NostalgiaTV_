from datetime import datetime, timezone
import importlib.util
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import updater


class UpdaterTests(unittest.TestCase):
    def test_automatic_updates_are_opt_in_and_confined_to_the_window(self):
        now = datetime(2026, 10, 17, 9, 15, tzinfo=timezone.utc)
        self.assertFalse(updater.due({}, now))
        policy = {"enabled": True, "windowStartUtc": "2026-10-17T09:00:00Z"}
        self.assertTrue(updater.due(policy, now))
        self.assertFalse(updater.due(policy, now.replace(hour=10)))
        self.assertFalse(updater.due({**policy, "enabled": False}, now))

    def test_provenance_is_bound_to_the_main_workflow_and_exact_commit(self):
        with patch.object(updater.manage, "run") as execute:
            updater.verify(Path("server.tar.gz"), Path("release.intoto.jsonl"), "a" * 40)
        arguments = execute.call_args.args
        self.assertIn("refs/heads/main", arguments)
        self.assertIn("efernandobl1/NostalgiaTV_/.github/workflows/deploy.yml", arguments)
        self.assertIn("--source-digest", arguments)
        self.assertIn("a" * 40, arguments)

    def test_download_rejects_untrusted_origins_before_network_access(self):
        with patch.object(updater, "urlopen") as network, self.assertRaises(ValueError):
            updater.download("https://attacker.invalid/server.tar.gz", Path("unused"), 1024)
        network.assert_not_called()

    def test_release_packaging_contains_the_complete_manifest_and_linux_installer(self):
        spec = importlib.util.spec_from_file_location("package_release", Path(__file__).resolve().parents[1] / "package-release.py")
        package = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(package)
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            for name in ("deploy", "WebApp/public/assets"):
                (root / name).mkdir(parents=True)
            for name in ("docker-compose.production.yml", ".env.production.example", "WebApp/public/assets/env.js"):
                (root / name).write_text("fixture")
            (root / "out").mkdir()
            for name in ("nostalgiatv-windows-x64-setup.exe", "nostalgiatv-server-windows-x64.zip", "app.apk"):
                (root / "out" / name).write_bytes(b"fixture")
            for kind in ("api", "web"):
                (root / "out" / ("image-" + kind + ".json")).write_text('{"image":"ghcr.io/efernandobl1/nostalgia-' + kind + '@sha256:' + 'b' * 64 + '"}')
            package.package(root, root / "out", "a" * 40, "v0.3.1")
            self.assertIn('"commit": "' + "a" * 40, (root / "out/release.json").read_text())
            self.assertTrue((root / "out/nostalgiatv-linux-x64.run").read_bytes().startswith(b"#!/bin/sh"))


if __name__ == "__main__":
    unittest.main()
