"""Assemble complete, versioned release assets; CI attests them before publication."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import tarfile


def package(source, output, commit, version):
    if not re.fullmatch(r"[a-f0-9]{40}", commit) or not re.fullmatch(r"v\d+\.\d+\.\d+", version):
        raise ValueError("A full commit and stable version are required.")
    output.mkdir(parents=True, exist_ok=True)
    for name in ("nostalgiatv-windows-x64-setup.exe", "nostalgiatv-server-windows-x64.zip", "image-api.json", "image-web.json"):
        if not (output / name).is_file():
            raise ValueError("Missing complete-release asset: " + name)
    if not list(output.glob("*.apk")):
        raise ValueError("The signed Android APK is required.")
    archive = output / "nostalgiatv-server-linux-x64.tar.gz"
    with tarfile.open(archive, "w:gz") as bundle:
        for name in ("docker-compose.production.yml", ".env.production.example", "deploy", "WebApp/public/assets/env.js"):
            bundle.add(source / name, arcname=name, filter=lambda item: None if "__pycache__" in item.name or item.name.endswith(".pyc") else item)
    installer = output / "nostalgiatv-linux-x64.run"
    header = f"""#!/bin/sh
set -eu
if [ "${{1:-}}" = "--help" ]; then
  echo 'Usage: sudo sh nostalgiatv-linux-x64.run /opt/nostalgiatv --server-url https://SERVER [--local-bind PRIVATE_IP]'
  echo 'Requires Linux x86-64, Docker Compose, Python 3.12+ and OpenSSL. Installs only into a new directory.'
  exit 0
fi
[ "$(id -u)" = 0 ] || {{ echo 'Run with sudo.' >&2; exit 1; }}
[ "$(uname -m)" = x86_64 ] || {{ echo 'This release requires Linux x86-64.' >&2; exit 1; }}
for command in docker python3 openssl tar; do command -v "$command" >/dev/null || {{ echo "Missing prerequisite: $command" >&2; exit 1; }}; done
python3 -c 'import sys; assert sys.version_info >= (3, 12), "Python 3.12+ required"'
task_dir="$(mktemp -d /tmp/nostalgiatv-install.XXXXXX)"
readonly task_dir
cleanup() {{ case "$task_dir" in /tmp/nostalgiatv-install.*) rm -rf -- "$task_dir" ;; esac; }}
trap cleanup EXIT HUP INT TERM
payload_line="$(awk '/^__NOSTALGIA_PAYLOAD__$/ {{ print NR + 1; exit }}' "$0")"
tail -n +"$payload_line" "$0" | tar -xz --no-same-owner -C "$task_dir"
python3 "$task_dir/deploy/manage.py" init "$@" --release {commit}
exit 0
__NOSTALGIA_PAYLOAD__
"""
    with installer.open("wb") as file:
        file.write(header.encode())
        file.write(archive.read_bytes())
    assets = []
    for file in sorted(output.iterdir()):
        if file.is_file() and file.name not in ("release.json", "SHA256SUMS.txt", "release.intoto.jsonl"):
            assets.append({"name": file.name, "sha256": hashlib.sha256(file.read_bytes()).hexdigest()})
    images = {}
    for kind in ("api", "web"):
        metadata = output / ("image-" + kind + ".json")
        if metadata.exists():
            image = json.loads(metadata.read_text())["image"]
            if not re.fullmatch(r"ghcr\.io/efernandobl1/nostalgia-" + kind + r"@sha256:[a-f0-9]{64}", image):
                raise ValueError("Unexpected release image digest.")
            images[kind] = image
    (output / "release.json").write_text(json.dumps({"schemaVersion": 1, "version": version, "commit": commit, "assets": assets, "images": images}, indent=2))
    files = [*assets, {"name": "release.json", "sha256": hashlib.sha256((output / "release.json").read_bytes()).hexdigest()}]
    (output / "SHA256SUMS.txt").write_text("".join(f"{file['sha256']}  {file['name']}\n" for file in files))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--commit", required=True)
    parser.add_argument("--version", required=True)
    parser.add_argument("--output", type=Path, default=Path("release"))
    args = parser.parse_args()
    package(Path(__file__).resolve().parent.parent, args.output, args.commit, args.version)
