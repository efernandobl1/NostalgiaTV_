#!/usr/bin/env python3
"""Install and maintain a single Linux/Docker NostalgiaTV installation."""

import argparse
import contextlib
import hashlib
import ipaddress
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import subprocess
import sys
import tarfile
import tempfile
import time
from datetime import datetime, timezone
from urllib.parse import urlsplit
from urllib.request import ProxyHandler, HTTPSHandler, build_opener
import ssl


def run(*arguments, input=None, capture=False):
    return subprocess.run(arguments, input=input, text=True, check=True,
                          stdout=subprocess.PIPE if capture else None).stdout


def stamp():
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S") + "-" + secrets.token_hex(4)


def release(value):
    if not re.fullmatch(r"[a-f0-9]{40}", value):
        raise ValueError("Use a full 40-character main release commit, not latest.")
    return value


def origin(value):
    url = urlsplit(value)
    if (url.scheme != "https" or not url.hostname or url.username or url.password or
            url.path not in ("", "/") or url.query or url.fragment or re.search(r"[\s\\'\"$]", value)):
        raise ValueError("Use an HTTPS server origin without credentials, path or query.")
    if not re.fullmatch(r"[a-zA-Z0-9.:-]+", url.hostname):
        raise ValueError("Use an ASCII hostname or IP address.")
    return value.rstrip("/"), url.hostname, url.port or 443


def directory(value):
    path = Path(value)
    if not path.is_absolute() or len(path.parts) < 3 or path.is_symlink() or path.resolve() != path:
        raise ValueError("Use a specific absolute directory with no symbolic links.")
    return path


def write_private(path, text):
    with open(path, "x", encoding="utf-8") as file:
        os.chmod(path, 0o600)
        file.write(text)


def settings(path):
    result = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        match = re.fullmatch(r"([A-Z_]+)=(.*)", line)
        if match:
            result[match[1]] = match[2].strip("'\"")
    return result


def sql_literal(value):
    return "N'" + value.replace("'", "''") + "'"


class Installation:
    def __init__(self, path):
        self.path = directory(path)
        self.compose = self.path / "docker-compose.yml"
        self.env = self.path / ".env"

    def docker(self, *args, capture=False):
        return run("docker", "compose", "--project-directory", str(self.path),
                   "--env-file", str(self.env), "-f", str(self.compose), *args, capture=capture)

    def sql(self, query, capture=False):
        return run("docker", "compose", "--project-directory", str(self.path),
                   "--env-file", str(self.env), "-f", str(self.compose), "exec", "-T", "sqlserver",
                   "/bin/bash", "-lc", 'export SQLCMDPASSWORD="$MSSQL_SA_PASSWORD"; '
                   'exec /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -Nm -C -b -y 0 -h -1 -w 65535',
                   input="SET NOCOUNT ON;\n" + query + "\nGO\n", capture=capture)

    def check(self):
        if self.env.is_symlink() or self.compose.is_symlink():
            raise ValueError("Configuration files cannot be symbolic links.")
        if self.env.stat().st_mode & 0o077:
            raise ValueError("Protect .env with chmod 600 before continuing.")
        self.docker("config", "--quiet")
        config = json.loads(self.docker("config", "--format", "json", capture=True))
        services = config["services"]
        for name in ("sqlserver", "migrate", "webapi", "media-worker", "webapp"):
            if name not in services:
                raise ValueError("Missing production service: " + name)
        for name in ("sqlserver", "webapi", "media-worker", "migrate"):
            if services[name].get("ports"):
                raise ValueError("Database, worker and API must not publish host ports.")
        for name in ("webapi", "media-worker", "migrate"):
            key = "ConnectionStrings__MigrationConnection" if name == "migrate" else "ConnectionStrings__DefaultConnection"
            connection = services[name].get("environment", {}).get(key, "")
            if not re.search(r"TrustServerCertificate\s*=\s*False", connection, re.I):
                raise ValueError("Verified database TLS is required on " + name)
            user = "nostalgia_migrator" if name == "migrate" else "nostalgia_app"
            if not re.search(r"(?:^|;)\s*User Id\s*=\s*" + user + r"\s*(?:;|$)", connection, re.I):
                raise ValueError("Use the dedicated SQL login on " + name)
            if not re.search(r"(?:^|;)\s*Encrypt\s*=\s*(Mandatory|Strict|True)\s*(?:;|$)", connection, re.I):
                raise ValueError("SQL encryption is required on " + name)
        expected = {"/app/wwwroot/uploads": self.path / "uploads", "/app/wwwroot/uploads/media": self.path / "media",
                    "/var/opt/mssql": self.path / "data/sqlserver", "/run/sqlserver": self.path / "certificates/sqlserver",
                    "/usr/share/nginx/html/assets/env.js": self.path / "env.js"}
        for service in services.values():
            for volume in service.get("volumes", []):
                if volume["target"] in expected and (volume.get("type") != "bind" or
                        Path(volume["source"]).resolve() != expected[volume["target"]].resolve()):
                    raise ValueError("External or unexpected storage path; back it up separately: " + volume["target"])
        if subprocess.run(["openssl", "x509", "-in", str(self.path / "certificates/sqlserver/server.cer"),
                           "-checkend", "2592000", "-noout"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode:
            print("SQL certificate is unreadable or expires within 30 days; review it before updating.", file=sys.stderr)
        self.configuration = config
        return config

    @contextlib.contextmanager
    def writers_stopped(self):
        records = self.docker("ps", "--format", "json", capture=True).strip()
        states = json.loads(records) if records.startswith("[") else [json.loads(line) for line in records.splitlines() if line]
        active = [state["Service"] for state in states if state.get("State") == "running" and
                  state["Service"] in ("webapi", "media-worker", "webapp", "local-https")]
        try:
            if active:
                self.docker("stop", "--timeout", "60", *active)
            yield
        finally:
            if active:
                self.docker("start", *active)

    def health(self):
        self.docker("exec", "-T", "webapi", "curl", "--fail", "--silent", "--show-error", "http://127.0.0.1:8080/health/ready")
        self.docker("exec", "-T", "webapp", "wget", "-q", "-O", "/dev/null", "http://127.0.0.1:8080/health")
        print("Database readiness and web health: OK")

    def export_ca(self):
        source = self.path / "data/caddy/caddy/pki/authorities/local/root.crt"
        if not source.is_file():
            raise ValueError("Local HTTPS has not generated its public CA yet.")
        output = self.path / "certificates/local"
        output.mkdir(mode=0o755, parents=True, exist_ok=True)
        os.chmod(output, 0o755)
        destination = output / "nostalgiatv-local-ca.crt"
        shutil.copyfile(source, destination)
        os.chmod(destination, 0o644)
        run("openssl", "x509", "-in", str(destination), "-noout", "-fingerprint", "-sha256")
        print("Public CA for clients: " + str(destination) + "; verify the fingerprint over SSH. Never copy root.key.")
        return destination

    def provision_logins(self):
        env = settings(self.env)
        sql = []
        for key, user, roles in (
                ("DB_APP_CONNECTION_STRING", "nostalgia_app", ("db_datareader", "db_datawriter")),
                ("DB_MIGRATION_CONNECTION_STRING", "nostalgia_migrator", ("db_owner",))):
            match = re.search(r"(?:^|;)Password=([^;]+)(?:;|$)", env[key], re.I)
            if not match:
                raise ValueError("Cannot read the dedicated SQL password from " + key)
            password = sql_literal(match[1])
            sql.append(f"IF SUSER_ID(N'{user}') IS NULL CREATE LOGIN [{user}] WITH PASSWORD={password}, CHECK_POLICY=ON, CHECK_EXPIRATION=OFF;")
            sql.append(f"USE [NostalgiaTV]; IF USER_ID(N'{user}') IS NULL CREATE USER [{user}] FOR LOGIN [{user}]; ELSE ALTER USER [{user}] WITH LOGIN=[{user}];")
            sql.extend(f"IF IS_ROLEMEMBER(N'{role}',N'{user}') <> 1 ALTER ROLE [{role}] ADD MEMBER [{user}];" for role in roles)
            sql.append("USE [master];")
        self.sql("\n".join(sql))

    def backup(self):
        self.check()
        backup_root = self.path / "backups"
        if backup_root.is_symlink():
            raise ValueError("The backup directory cannot be a symbolic link.")
        backup_root.mkdir(mode=0o700, exist_ok=True)
        os.chmod(backup_root, 0o700)
        destination = backup_root / (stamp() + ".tar")
        temporary_sql = "/var/opt/mssql/data/nostalgia-maintenance-" + stamp() + ".bak"
        media_size = sum(file.stat().st_size for name in ("uploads", "media") for file in (self.path / name).rglob("*") if file.is_file())
        database_size = int(self.sql("SELECT SUM(CAST(size AS bigint))*8192 FROM NostalgiaTV.sys.database_files;", capture=True).strip())
        if shutil.disk_usage(backup_root).free < media_size + database_size + 1024 ** 3:
            raise ValueError("Not enough free space for a full backup and 1 GiB reserve.")
        with tempfile.TemporaryDirectory(prefix="nostalgia-backup-") as temporary:
            temporary = Path(temporary)
            with self.writers_stopped():
                try:
                    print("Writers stopped. Creating and verifying SQL backup...")
                    self.sql(f"BACKUP DATABASE [NostalgiaTV] TO DISK={sql_literal(temporary_sql)} WITH COPY_ONLY,CHECKSUM;\n"
                             f"RESTORE VERIFYONLY FROM DISK={sql_literal(temporary_sql)} WITH CHECKSUM;")
                    files = json.loads(self.sql("SELECT name,type_desc FROM NostalgiaTV.sys.database_files FOR JSON PATH;", capture=True).strip())
                    database = self.docker("ps", "-q", "sqlserver", capture=True).strip()
                    run("docker", "cp", database + ":" + temporary_sql, str(temporary / "database.bak"))
                    with tarfile.open(destination, "x") as archive:
                        archive.add(temporary / "database.bak", arcname="database.bak")
                        metadata = temporary / "manifest.json"
                        metadata.write_text(json.dumps({"version": 1, "databaseFiles": files}), encoding="utf-8")
                        archive.add(metadata, arcname="manifest.json")
                        for name in (".env", "docker-compose.yml", "env.js", "uploads", "media", "certificates", "deploy",
                                     "data/sqlserver/tls", "data/sqlserver/mssql.conf", "data/caddy", "data/caddy-config"):
                            source = self.path / name
                            if source.exists():
                                if source.is_symlink() or source.is_dir() and any(file.is_symlink() for file in source.rglob("*")):
                                    raise ValueError("Backup cannot safely include symbolic links: " + name)
                                archive.add(source, arcname=name, recursive=True)
                finally:
                    self.docker("exec", "-T", "--user", "0", "sqlserver", "rm", "-f", "--", temporary_sql)
            os.chmod(destination, 0o600)
            checksum = digest(destination)
            write_private(Path(str(destination) + ".sha256"), checksum + "\n")
        print("Backup (includes secrets; keep private): " + str(destination))
        return destination

    def update(self, version):
        version = release(version)
        original = self.env.read_text(encoding="utf-8")
        candidate = original
        for name, image in (("API_IMAGE", "nostalgia-api"), ("WEB_IMAGE", "nostalgia-web")):
            candidate, count = re.subn(r"^" + name + r"=.*$", name + "=ghcr.io/efernandobl1/" + image + ":" + version,
                                      candidate, flags=re.M)
            if count != 1:
                raise ValueError("Expected exactly one " + name + " entry.")
        self.backup()
        pending = self.path / (".env.update-" + stamp())
        write_private(pending, candidate)
        try:
            run("docker", "compose", "--project-directory", str(self.path), "--env-file", str(pending),
                "-f", str(self.compose), "config", "--quiet")
            run("docker", "compose", "--project-directory", str(self.path), "--env-file", str(pending),
                "-f", str(self.compose), "pull", "webapi", "media-worker", "migrate", "webapp")
            os.replace(pending, self.env)
            # Explicitly rerun the isolated migrations even if an earlier one-shot exited successfully.
            self.docker("stop", "--timeout", "60", "webapp", "media-worker", "webapi")
            self.docker("up", "-d", "--wait", "sqlserver")
            self.docker("run", "--rm", "--no-deps", "migrate")
            self.docker("up", "-d", "--wait", "--wait-timeout", "180")
            self.health()
        except Exception:
            print("Update stopped. A verified backup exists; do not downgrade images after a schema change.", file=sys.stderr)
            raise
        finally:
            pending.unlink(missing_ok=True)


def digest(path):
    result = hashlib.sha256()
    with path.open("rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            result.update(chunk)
    return result.hexdigest()


def verified_archive(path):
    path = path.resolve(strict=True)
    expected = Path(str(path) + ".sha256").read_text().strip()
    if not re.fullmatch(r"[a-f0-9]{64}", expected) or digest(path) != expected:
        raise ValueError("Backup checksum does not match.")
    archive = tarfile.open(path)
    files = {".env", "docker-compose.yml", "env.js", "manifest.json", "database.bak", "data/sqlserver/mssql.conf"}
    trees = ("uploads", "media", "certificates", "deploy", "data/sqlserver/tls", "data/caddy", "data/caddy-config")
    for member in archive.getmembers():
        name = Path(member.name)
        allowed = member.name in files or any(member.name == tree or member.name.startswith(tree + "/") for tree in trees)
        if name.is_absolute() or ".." in name.parts or not name.parts or not allowed or not (member.isfile() or member.isdir()):
            archive.close()
            raise ValueError("Unsafe backup entry: " + member.name)
    return archive


def restore(path, backup):
    target = directory(path)
    if target.exists():
        raise ValueError("Restore only to a new directory; an existing installation is never overwritten.")
    require_empty_project()
    with verified_archive(backup) as archive:
        for name in (".env", "docker-compose.yml", "env.js", "database.bak", "manifest.json"):
            if not archive.getmember(name).isfile():
                raise ValueError("Missing backup file: " + name)
        target.mkdir(mode=0o700, parents=True)
        archive.extractall(target, filter="data")
    os.chmod(target / ".env", 0o600)
    env = target / ".env"
    env.write_text(re.sub(r"^ENV_JS_PATH=.*$", "ENV_JS_PATH=./env.js", env.read_text(), flags=re.M))
    for name in ("uploads", "media", "logs/webapi", "logs/media-worker", "data/caddy", "data/caddy-config"):
        folder = target / name
        folder.mkdir(mode=0o770, parents=True, exist_ok=True)
        chown_tree(folder, 1654, 1654)
    # Restore the SQL backup, never raw live MDF/LDF files.
    sql_data = target / "data/sqlserver"
    sql_data.mkdir(mode=0o750, parents=True, exist_ok=True)
    chown_tree(sql_data, 10001, 0)
    manifest = json.loads((target / "manifest.json").read_text())
    if manifest.get("version") != 1:
        raise ValueError("Unsupported backup format.")
    moves = []
    for index, file in enumerate(manifest["databaseFiles"]):
        if file["type_desc"] not in ("ROWS", "LOG"):
            raise ValueError("Unsupported database file type.")
        extension = "mdf" if file["type_desc"] == "ROWS" else "ldf"
        moves.append("MOVE " + sql_literal(file["name"]) + " TO " + sql_literal(f"/var/opt/mssql/data/NostalgiaTV-{index}.{extension}"))
    installation = Installation(str(target))
    installation.check()
    config = settings(installation.env)
    ensure_network(config.get("MONITORING_NETWORK_NAME", "monitoring-nostalgia"))
    installation.docker("up", "-d", "--wait", "sqlserver")
    database = installation.docker("ps", "-q", "sqlserver", capture=True).strip()
    run("docker", "cp", str(target / "database.bak"), database + ":/var/opt/mssql/data/restore.bak")
    installation.docker("exec", "-T", "--user", "0", "sqlserver", "chown", "10001:0", "/var/opt/mssql/data/restore.bak")
    installation.sql("RESTORE DATABASE [NostalgiaTV] FROM DISK=N'/var/opt/mssql/data/restore.bak' WITH CHECKSUM," + ",".join(moves) + ";")
    installation.provision_logins()
    print("Database and files restored. Review .env paths/ports before starting the full stack.")


def chown_tree(path, uid, gid):
    for root, directories, files in os.walk(path):
        os.chown(root, uid, gid)
        for name in files:
            os.chown(Path(root) / name, uid, gid, follow_symlinks=False)


def ensure_network(name):
    if not re.fullmatch(r"[a-zA-Z0-9_-]{1,100}", name):
        raise ValueError("Invalid monitoring network name.")
    if subprocess.run(["docker", "network", "inspect", name], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode:
        run("docker", "network", "create", name)


def require_empty_project():
    if run("docker", "ps", "-aq", "--filter", "label=com.docker.compose.project=nostalgiatv", capture=True).strip():
        raise ValueError("A NostalgiaTV installation already exists on this Docker host. Use update/backup; restore on a clean host.")


def initialize(args):
    target = directory(args.directory)
    if target.exists():
        raise ValueError("Install only to a new directory; existing data is never overwritten.")
    version = release(args.release)
    url, host, port = origin(args.server_url)
    if args.local_bind:
        address = ipaddress.ip_address(args.local_bind)
        networks = ("10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16", "127.0.0.0/8", "fc00::/7", "::1/128")
        if not any(address in ipaddress.ip_network(network) for network in networks):
            raise ValueError("Local HTTPS must bind a specific private IP, never 0.0.0.0.")
        try:
            if ipaddress.ip_address(host) != address:
                raise ValueError("The URL IP must match the local bind IP.")
        except ValueError:
            if host != args.local_bind and not host.endswith((".home.arpa", ".local")):
                raise ValueError("Use the local bind IP or a private .home.arpa/.local DNS name.")
    source = Path(__file__).resolve().parent.parent
    if target.is_relative_to(source / "deploy"):
        raise ValueError("The installation cannot be created inside the deployment tools directory.")
    run("docker", "info", "--format", "{{.OSType}}", capture=True)
    require_empty_project()
    target.mkdir(mode=0o750, parents=True)
    shutil.copyfile(source / "docker-compose.production.yml", target / "docker-compose.yml")
    shutil.copytree(source / "deploy", target / "deploy", ignore=shutil.ignore_patterns("__pycache__", "tests"))
    shutil.copyfile(source / "WebApp/public/assets/env.js", target / "env.js")
    os.chmod(target / "env.js", 0o644)
    for name, uid, gid in (("data/sqlserver", 10001, 0), ("logs/webapi", 1654, 1654), ("logs/media-worker", 1654, 1654),
                           ("media", 1654, 1654), ("uploads", 1654, 1654), ("data/caddy", 1654, 1654), ("data/caddy-config", 1654, 1654)):
        path = target / name
        path.mkdir(mode=0o770, parents=True, exist_ok=True)
        os.chown(path, uid, gid)
    tls = target / "data/sqlserver/tls"
    tls.mkdir(mode=0o700)
    os.chown(tls, 10001, 0)
    run("openssl", "req", "-x509", "-newkey", "rsa:3072", "-sha256", "-nodes", "-days", "365",
        "-subj", "/CN=sqlserver", "-addext", "subjectAltName=DNS:sqlserver,DNS:nostalgia-db",
        "-addext", "basicConstraints=critical,CA:FALSE", "-addext", "keyUsage=critical,digitalSignature,keyEncipherment",
        "-addext", "extendedKeyUsage=serverAuth", "-keyout", str(tls / "server.key"), "-out", str(tls / "server.pem"))
    for name in ("server.pem", "server.key"):
        os.chmod(tls / name, 0o600)
        os.chown(tls / name, 10001, 0)
    public = target / "certificates/sqlserver"
    public.mkdir(parents=True)
    os.chmod(public, 0o755)
    shutil.copyfile(tls / "server.pem", public / "server.cer")
    os.chmod(public / "server.cer", 0o644)
    conf = target / "data/sqlserver/mssql.conf"
    write_private(conf, "[network]\ntlscert = /var/opt/mssql/tls/server.pem\ntlskey = /var/opt/mssql/tls/server.key\ntlsprotocols = 1.2\nforceencryption = 1\n")
    os.chown(conf, 10001, 0)
    env = f"APP_PUBLIC_URL={url}\nWEB_HTTP_PORT={args.web_port}\nENV_JS_PATH=./env.js\nTIME_ZONE={args.time_zone}\n"
    cores = min(4, os.cpu_count() or 1)
    env += f"API_CPUS={cores}\nMEDIA_WORKER_CPUS={cores}\n"
    env += f"API_IMAGE=ghcr.io/efernandobl1/nostalgia-api:{version}\nWEB_IMAGE=ghcr.io/efernandobl1/nostalgia-web:{version}\n"
    env += f"DB_PASSWORD=NtvS1!{secrets.token_hex(32)}\nJWT_SECRET_KEY={secrets.token_hex(48)}\nBOOTSTRAP_ADMIN_PASSWORD=NtvA1!{secrets.token_hex(24)}\n"
    for key, user in (("DB_APP_CONNECTION_STRING", "nostalgia_app"), ("DB_MIGRATION_CONNECTION_STRING", "nostalgia_migrator")):
        env += f"{key}='Server=sqlserver;Database=NostalgiaTV;User Id={user};Password=NtvD1!{secrets.token_hex(32)};Encrypt=Mandatory;TrustServerCertificate=False;ServerCertificate=/run/sqlserver/server.cer'\n"
    if args.local_bind:
        tls_host = "[" + host + "]" if ":" in host else host
        bind = "[" + args.local_bind + "]" if ":" in args.local_bind else args.local_bind
        env += f"COMPOSE_PROFILES=local-https\nLOCAL_HTTPS_HOST={tls_host}\nLOCAL_HTTPS_BIND_IP={bind}\nLOCAL_HTTPS_PORT={port}\n"
    write_private(target / ".env", env)
    ensure_network("monitoring-nostalgia")
    installation = Installation(str(target))
    installation.check()
    installation.docker("up", "-d", "--wait", "sqlserver")
    installation.sql("CREATE DATABASE [NostalgiaTV];")
    installation.provision_logins()
    installation.docker("up", "-d", "--wait", "--wait-timeout", "180")
    installation.health()
    print("Installed at " + str(target) + ". Initial admin password is in the private .env (not printed).")
    if args.local_bind:
        for attempt in range(10):
            if (target / "data/caddy/caddy/pki/authorities/local/root.crt").is_file():
                break
            time.sleep(1)
        certificate = installation.export_ca()
        client = build_opener(ProxyHandler({}), HTTPSHandler(context=ssl.create_default_context(cafile=str(certificate))))
        with client.open(url + "/api/v1/server", timeout=10) as response:
            if json.load(response).get("product") != "NostalgiaTV":
                raise ValueError("Local HTTPS returned an unexpected server.")
        print("Local HTTPS certificate and server identity: OK. Install the public CA in each client before connecting.")
    else:
        print("Configure the existing host HTTPS reverse proxy for " + url + "; only the web loopback port is exposed.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    install = commands.add_parser("init")
    install.add_argument("directory")
    install.add_argument("--server-url", required=True)
    install.add_argument("--release", required=True)
    install.add_argument("--local-bind")
    install.add_argument("--web-port", type=int, default=8090)
    install.add_argument("--time-zone", default="America/Guatemala")
    for name in ("check", "backup", "update", "restore", "export-ca"):
        command = commands.add_parser(name)
        command.add_argument("directory")
        if name == "update":
            command.add_argument("--release", required=True)
        if name == "restore":
            command.add_argument("--backup", type=Path, required=True)
    args = parser.parse_args()
    if sys.platform != "linux" or os.geteuid() != 0:
        parser.error("Run on Linux with sudo; do not grant users access to the Docker socket.")
    os.umask(0o077)
    for tool in ("docker", "openssl"):
        if not shutil.which(tool):
            parser.error("Install prerequisite: " + tool)
    if args.command == "init":
        if not 1 <= args.web_port <= 65535 or not re.fullmatch(r"[A-Za-z0-9_+/-]+", args.time_zone):
            parser.error("Invalid port or timezone.")
        initialize(args)
    elif args.command == "restore":
        restore(args.directory, args.backup)
    else:
        installation = Installation(args.directory)
        if args.command == "update":
            installation.update(args.release)
        elif args.command == "backup":
            installation.backup()
        elif args.command == "export-ca":
            installation.export_ca()
        else:
            installation.check()
            installation.health()


if __name__ == "__main__":
    try:
        main()
    except (ValueError, KeyError, OSError, subprocess.CalledProcessError, tarfile.TarError) as error:
        print("Maintenance stopped: " + str(error), file=sys.stderr)
        sys.exit(1)
