import importlib.util
import json
from pathlib import Path
import subprocess
import tarfile
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("manage", Path(__file__).resolve().parents[1] / "manage.py")
manage = importlib.util.module_from_spec(spec)
spec.loader.exec_module(manage)


class MaintenanceTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name).resolve()
        self.addCleanup(self.temporary.cleanup)
        self.target = self.root / "installation"
        self.target.mkdir()
        manage.write_private(self.target / ".env", "API_IMAGE=old-api\nWEB_IMAGE=old-web\nSECRET=not-for-logs\n")
        (self.target / "docker-compose.yml").write_text("services: {}")

    def archive(self, name="uploads/video.mp4", kind=tarfile.REGTYPE):
        output = self.root / "backup.tar"
        with tarfile.open(output, "w") as archive:
            member = tarfile.TarInfo(name)
            member.type = kind
            if kind == tarfile.SYMTYPE:
                member.linkname = "/etc/passwd"
            archive.addfile(member)
        Path(str(output) + ".sha256").write_text(manage.digest(output))
        return output

    def test_accepts_https_origins_without_credentials(self):
        self.assertEqual(("https://192.168.1.10:8443", "192.168.1.10", 8443), manage.origin("https://192.168.1.10:8443/"))
        self.assertEqual("tv.home.arpa", manage.origin("https://tv.home.arpa")[1])

    def test_rejects_insecure_and_injected_origins(self):
        for value in ("http://192.168.1.10", "https://user:secret@example.com", "https://example.com/path", "https://example.com?x=1", "https://x\nCONFIG=true", "https://$HOST"):
            with self.subTest(value=value), self.assertRaises(ValueError):
                manage.origin(value)

    def test_requires_immutable_image_version(self):
        self.assertEqual("a" * 40, manage.release("a" * 40))
        for version in ("latest", "a" * 7, "A" * 40, "a" * 40 + "\n"):
            with self.assertRaises(ValueError):
                manage.release(version)

    def test_does_not_overwrite_existing_installation(self):
        with self.assertRaises(ValueError):
            manage.restore(str(self.target), self.root / "missing.tar")
        self.assertIn("SECRET", (self.target / ".env").read_text())

    def test_validates_backup_checksum(self):
        output = self.archive()
        with manage.verified_archive(output) as archive:
            self.assertEqual("uploads/video.mp4", archive.getmembers()[0].name)
        output.write_bytes(b"changed")
        with self.assertRaises(ValueError):
            manage.verified_archive(output)

    def test_rejects_archive_traversal_and_unexpected_paths(self):
        for name in ("../.env", "uploads/../../etc/passwd", "/etc/passwd", "other/file"):
            with self.subTest(name=name), self.assertRaises(ValueError):
                manage.verified_archive(self.archive(name))

    def test_rejects_links_and_devices_in_backups(self):
        for kind in (tarfile.SYMTYPE, tarfile.LNKTYPE, tarfile.CHRTYPE):
            with self.assertRaises(ValueError):
                manage.verified_archive(self.archive(kind=kind))

    def test_restores_only_originally_running_writers_after_error(self):
        installation = manage.Installation(str(self.target))
        commands = []
        def docker(*args, capture=False):
            commands.append(args)
            if args[0] == "ps":
                return json.dumps([{"Service": "webapi", "State": "running"}, {"Service": "webapp", "State": "exited"}, {"Service": "media-worker", "State": "running"}])
        with patch.object(installation, "docker", side_effect=docker):
            with self.assertRaises(RuntimeError), installation.writers_stopped():
                raise RuntimeError("backup failed")
        self.assertEqual(("stop", "--timeout", "60", "webapi", "media-worker"), commands[1])
        self.assertEqual(("start", "webapi", "media-worker"), commands[2])

    def test_handles_compose_json_lines(self):
        installation = manage.Installation(str(self.target))
        commands = []
        def docker(*args, capture=False):
            commands.append(args)
            return '{"Service":"webapi","State":"running"}\n' if args[0] == "ps" else None
        with patch.object(installation, "docker", side_effect=docker), installation.writers_stopped():
            pass
        self.assertEqual(("start", "webapi"), commands[-1])

    def test_pull_failure_preserves_configuration(self):
        installation = manage.Installation(str(self.target))
        original = installation.env.read_text()
        def run(*args, **kwargs):
            if "pull" in args:
                raise subprocess.CalledProcessError(1, ["docker", "compose", "pull"])
        with patch.object(installation, "backup"), patch.object(manage, "run", side_effect=run):
            with self.assertRaises(subprocess.CalledProcessError):
                installation.update("a" * 40)
        self.assertEqual(original, installation.env.read_text())
        self.assertEqual([], list(self.target.glob(".env.update-*")))

    def test_update_stops_writers_before_migrations_and_checks_health(self):
        installation = manage.Installation(str(self.target))
        commands = []
        with patch.object(installation, "backup", side_effect=lambda: commands.append(("backup",))), \
                patch.object(installation, "docker", side_effect=lambda *args, **kwargs: commands.append(args)), \
                patch.object(installation, "health", side_effect=lambda: commands.append(("health",))), patch.object(manage, "run"):
            installation.update("a" * 40)
        self.assertEqual(("backup",), commands[0])
        self.assertLess(commands.index(("stop", "--timeout", "60", "webapp", "media-worker", "webapi")), commands.index(("run", "--rm", "--no-deps", "migrate")))
        self.assertEqual(("health",), commands[-1])
        self.assertIn("nostalgia-api:" + "a" * 40, installation.env.read_text())
        self.assertIn("SECRET=not-for-logs", installation.env.read_text())

    def test_refuses_new_instance_when_docker_project_exists(self):
        with patch.object(manage, "run", return_value="existing-container\n"), self.assertRaises(ValueError):
            manage.require_empty_project()

    def test_sql_passwords_escape_single_quotes(self):
        self.assertEqual("N'a''b'", manage.sql_literal("a'b"))

    def test_sql_uses_compatible_unbounded_output_options(self):
        with patch.object(manage, "run", return_value="7\n") as command:
            result = manage.Installation(str(self.target)).sql("SELECT 7;", capture=True)
        self.assertEqual("7\n", result)
        options = command.call_args.args[-1]
        self.assertIn("-y 0", options)
        self.assertNotIn("-h ", options)
        self.assertIn("-Nm -C -b", options)

    def test_restored_public_certificate_is_readable_by_nonroot_services(self):
        directory = self.target / "certificates/sqlserver"
        with patch.object(manage.os, "chmod") as permissions:
            manage.expose_sql_certificate(directory)
        self.assertEqual((directory, 0o755), permissions.call_args_list[0].args)
        self.assertEqual((directory / "server.cer", 0o644), permissions.call_args_list[1].args)

    def test_exports_only_the_public_local_certificate(self):
        authority = self.target / "data/caddy/caddy/pki/authorities/local"
        authority.mkdir(parents=True)
        (authority / "root.crt").write_text("public certificate")
        (authority / "root.key").write_text("must not be exported")
        with patch.object(manage, "run"):
            certificate = manage.Installation(str(self.target)).export_ca()
        self.assertEqual("public certificate", certificate.read_text())
        self.assertFalse((certificate.parent / "root.key").exists())


if __name__ == "__main__":
    unittest.main()
