#!/usr/bin/env python3
"""Host-only updater. Requests can select when, never what executable to run."""

from datetime import datetime, timezone, timedelta
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import threading
from urllib.request import Request, urlopen

import manage

REPOSITORY = "efernandobl1/NostalgiaTV_"
DOWNLOADS = "https://github.com/" + REPOSITORY + "/releases/download/"


def download(url, target, maximum):
    if not url.startswith(DOWNLOADS):
        raise ValueError("Unexpected release asset origin.")
    with urlopen(Request(url, headers={"User-Agent": "NostalgiaTV-Updater"}), timeout=60) as response, target.open("xb") as output:
        if not response.url.startswith("https://"):
            raise ValueError("Release downloads must remain encrypted.")
        size = 0
        while chunk := response.read(1024 * 1024):
            size += len(chunk)
            if size > maximum:
                raise ValueError("Release asset exceeds its allowed size.")
            output.write(chunk)


def verify(path, bundle, commit):
    manage.run("gh", "attestation", "verify", str(path), "--bundle", str(bundle), "--repo", REPOSITORY,
               "--signer-workflow", REPOSITORY + "/.github/workflows/deploy.yml",
               "--source-ref", "refs/heads/main", "--source-digest", commit, capture=True)


def latest():
    with urlopen(Request("https://api.github.com/repos/" + REPOSITORY + "/releases/latest",
                         headers={"User-Agent": "NostalgiaTV-Updater"}), timeout=20) as response:
        release = json.loads(response.read(2 * 1024 * 1024))
    if release.get("draft") or release.get("prerelease") or not re.fullmatch(r"v\d+\.\d+\.\d+", release.get("tag_name", "")):
        raise ValueError("No complete stable release is available.")
    manage.release(release["target_commitish"])
    assets = {asset["name"]: asset["browser_download_url"] for asset in release["assets"]}
    for name in ("release.json", "release.intoto.jsonl", "nostalgiatv-server-linux-x64.tar.gz"):
        if not assets.get(name, "").startswith(DOWNLOADS + release["tag_name"] + "/"):
            raise ValueError("The release is incomplete.")
    return release["target_commitish"], assets


def read_policy(path):
    if not path.exists() or path.is_symlink() or datetime.now(timezone.utc).timestamp() - path.stat().st_mtime > 600:
        return {}
    descriptor = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    with os.fdopen(descriptor) as file:
        return json.loads(file.read(4096))


def due(policy, now):
    if policy.get("enabled") is not True:
        return False
    start = datetime.fromisoformat(policy["windowStartUtc"].replace("Z", "+00:00"))
    return start <= now < start + timedelta(hours=1)


def tick(directory):
    with manage.maintenance_lock(Path(directory)):
        _tick(directory)


def _tick(directory):
    installation = manage.Installation(directory)
    root = installation.path / "data/updates"
    requests = root / "requests"
    status = root / "status/status.json"
    state = {}
    if status.exists():
        state = json.loads(status.read_text())
    output_lock = threading.Lock()

    def report(value, message=None):
        with output_lock:
            state.update(state=value, heartbeat=datetime.now(timezone.utc).isoformat(), message=message)
            temporary = status.with_suffix(".tmp")
            temporary.write_text(json.dumps(state))
            temporary.chmod(0o644)
            temporary.replace(status)

    manual = requests / "update.json"
    requested = manual.exists() or manual.is_symlink()
    manual.unlink(missing_ok=True)
    try:
        policy = read_policy(requests / "policy.json")
        now = datetime.now(timezone.utc)
        if not requested and (not due(policy, now) or state.get("lastWindow") == policy.get("windowStartUtc")):
            previous = state.get("state", "idle")
            report(previous if previous in ("failed", "completed") else "idle", state.get("message") if previous in ("failed", "completed") else None)
            return
        if not shutil.which("gh"):
            raise ValueError("Install GitHub CLI to verify release attestations.")
        commit, assets = latest()
        settings = manage.settings(installation.env)
        installed = settings.get("SERVER_COMMIT") or settings.get("API_IMAGE", "").rsplit(":", 1)[-1]
        if installed == commit:
            installation.health()
            report("idle")
            return
        with tempfile.TemporaryDirectory(prefix="nostalgia-release-") as temporary:
            temporary = Path(temporary)
            bundle = temporary / "release.intoto.jsonl"
            manifest_file = temporary / "release.json"
            download(assets["release.intoto.jsonl"], bundle, 8 * 1024 * 1024)
            download(assets["release.json"], manifest_file, 1024 * 1024)
            verify(manifest_file, bundle, commit)
            manifest = json.loads(manifest_file.read_text())
            if manifest.get("schemaVersion") != 1 or manifest.get("commit") != commit:
                raise ValueError("Release identity does not match its provenance.")
            artifact = temporary / "nostalgiatv-server-linux-x64.tar.gz"
            download(assets[artifact.name], artifact, 128 * 1024 * 1024)
            expected = next(asset["sha256"] for asset in manifest["assets"] if asset["name"] == artifact.name)
            if manage.digest(artifact) != expected:
                raise ValueError("Release checksum mismatch.")
            verify(artifact, bundle, commit)
            # Do not execute downloaded host scripts or overwrite custom Compose configuration.
            report("updating", "Respaldo y migraciones en curso. No apagues el servidor.")
            stop_heartbeat = threading.Event()
            def heartbeat():
                while not stop_heartbeat.wait(30):
                    report("updating", "Respaldo y migraciones en curso. No apagues el servidor.")
            worker = threading.Thread(target=heartbeat, daemon=True)
            worker.start()
            try:
                installation.update(commit, images=manifest["images"])
            finally:
                stop_heartbeat.set()
                worker.join()
            state["lastWindow"] = policy.get("windowStartUtc")
            state["installedCommit"] = commit
            report("completed", "Servidor actualizado y comprobado.")
    except Exception:
        report("failed", "No se completó la actualización. Revisa el registro del actualizador; el respaldo no se elimina.")
        raise


def install(directory):
    installation = manage.Installation(directory)
    installation.check()
    root = installation.path / "data/updates"
    tools = installation.path / "deploy"
    if tools.is_symlink():
        raise ValueError("The updater tools directory cannot be a symbolic link.")
    tools.mkdir(exist_ok=True)
    os.chown(tools, 0, 0)
    tools.chmod(0o755)
    for name in ("manage.py", "updater.py"):
        source = Path(__file__).resolve().parent / name
        destination = tools / name
        if source.resolve() != destination.resolve():
            if destination.is_symlink():
                raise ValueError("Updater tools cannot be symbolic links.")
            shutil.copyfile(source, destination)
        os.chown(destination, 0, 0)
        destination.chmod(0o600)
    manage.prepare_update_bridge(installation.path)
    if not shutil.which("gh"):
        raise ValueError("Install GitHub CLI before enabling the verified updater.")
    unit = """[Unit]
Description=NostalgiaTV verified server updater
After=docker.service
Requires=docker.service
[Service]
Type=oneshot
UMask=0077
ExecStart=/usr/bin/python3 {script} {directory}
TimeoutStartSec=infinity
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths={directory}
ProtectHome=true
NoNewPrivileges=true
Environment=XDG_CACHE_HOME={directory}/data/updates/cache
Environment=GH_CONFIG_DIR={directory}/data/updates/github
""".format(script=installation.path / "deploy/updater.py", directory=installation.path)
    if any(character.isspace() for character in directory):
        raise ValueError("The systemd updater installation path cannot contain whitespace.")
    Path("/etc/systemd/system/nostalgia-update.service").write_text(unit)
    Path("/etc/systemd/system/nostalgia-update.timer").write_text("""[Unit]
Description=Check NostalgiaTV update requests
[Timer]
OnBootSec=2min
OnUnitInactiveSec=5min
RandomizedDelaySec=30
[Install]
WantedBy=timers.target
""")
    manage.run("systemctl", "daemon-reload")
    manage.run("systemctl", "enable", "--now", "nostalgia-update.timer")
    tick(directory)


if __name__ == "__main__":
    if sys.platform != "linux" or os.geteuid() != 0 or len(sys.argv) != 2:
        raise SystemExit("Run with sudo and the absolute installation directory.")
    os.umask(0o077)
    tick(sys.argv[1])
