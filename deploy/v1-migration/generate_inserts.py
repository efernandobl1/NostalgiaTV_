"""
Generates the INSERT script that carries NostalgiaTV v1 data into a fresh v2 database.

Run it on a machine with sqlcmd against a *restored copy* of the v1 database (never production):

    python deploy/v1-migration/generate_inserts.py --server "localhost\\SQLEXPRESS" --database NostalgiaTV_v1_copy --out v1_to_v2.sql

On the Docker host, read a copy restored inside the stack's sqlserver container instead (run with sudo):

    python3 generate_inserts.py --compose-dir /opt/nostalgiatv --database NostalgiaTV_v1_copy --out v1_to_v2.sql

The output runs once on the v2 database right after InitialCreate and the administrator bootstrap
(docs/database/V1-DATA.md). It keeps the original ids so relations, links and paired devices survive.
Migrated: categories, series (+ seasons, categories), episodes, channels, eras, era lineups and selections,
platform settings, CPU policy, viewer profiles, devices, progress and watch ranges.
Not migrated: users (v2 bootstraps a new admin), refresh tokens, activity log, media jobs, generated schedule.
"""
import argparse
import json
import re
import subprocess
from datetime import datetime

# Same rule as MediaFilePolicy.EpisodeFile: "T2E05A", "2x05b", "S02E05A" or "05B - …".
CODE = re.compile(r"[Ss]?\d{1,2}[xXeE](\d{1,3})(?:([A-Da-d])(?![A-Za-z0-9]))?")
LEADING = re.compile(r"^[Ee]?(\d{1,3})([A-Da-d])?[\s.\-_]+")


def query(server, database, sql, compose_dir=None):
    """Runs a FOR JSON query through sqlcmd and returns the rows (sent as UTF-16 hex so no console code page can garble text)."""
    wrapped = f"SET NOCOUNT ON; SELECT CONVERT(varbinary(max), ({sql}))"
    if compose_dir:
        # sqlcmd inside the stack's sqlserver container as sa; the password never leaves the container environment.
        command = ["docker", "compose", "--project-directory", compose_dir, "exec", "-T", "sqlserver", "/bin/bash", "-lc",
                   'export SQLCMDPASSWORD="$MSSQL_SA_PASSWORD"; exec /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -C -b -y 0 -d ' + database]
        result = subprocess.run(command, input=(wrapped + "\nGO\n").encode(), capture_output=True, check=True)
    else:
        result = subprocess.run(["sqlcmd", "-S", server, "-E", "-C", "-d", database, "-y", "0", "-Q", wrapped], capture_output=True, check=True)
    output = result.stdout.decode("ascii", errors="replace")
    start = output.find("0x")
    if start < 0:
        return []
    # sqlcmd prints long binaries in 8000-digit chunks, each prefixed with "0x"; hex digits never contain an "x".
    value = re.match(r"[0-9A-Fa-fx\s]*", output[start:]).group(0)
    digits = "".join(value.split()).replace("0x", "")
    return json.loads(bytes.fromhex(digits).decode("utf-16-le"))


def part_of(path):
    name = path.replace("\\", "/").rsplit("/", 1)[-1].rsplit(".", 1)[0]
    if name.lower().endswith(".web"):
        name = name[:-4]
    match = CODE.search(name) or LEADING.match(name)
    return match.group(2).upper() if match and match.group(2) else None


def lit(value):
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "1" if value else "0"
    if isinstance(value, (int, float)):
        return repr(value)
    return "N'" + str(value).replace("'", "''") + "'"


def insert(table, columns, rows, identity=False):
    if not rows:
        return [f"-- {table}: no rows"]
    lines = [f"-- {table}: {len(rows)} rows"]
    if identity:
        lines.append(f"SET IDENTITY_INSERT [{table}] ON;")
    for start in range(0, len(rows), 500):
        chunk = rows[start:start + 500]
        lines.append(f"INSERT INTO [{table}] ({', '.join(f'[{c}]' for c in columns)}) VALUES")
        lines.append(",\n".join("  (" + ", ".join(row) + ")" for row in chunk) + ";")
    if identity:
        lines.append(f"SET IDENTITY_INSERT [{table}] OFF;")
    return lines


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--server", default=r"localhost\SQLEXPRESS")
    parser.add_argument("--database", default="NostalgiaTV_v1_copy")
    parser.add_argument("--compose-dir", help="Docker Compose project whose sqlserver container holds the restored copy")
    parser.add_argument("--out", required=True)
    args = parser.parse_args()
    if not re.fullmatch(r"[A-Za-z0-9_]+", args.database):
        parser.error("Invalid database name.")
    q = lambda sql: query(args.server, args.database, sql, args.compose_dir)

    categories = q("SELECT Id, Name FROM Categories ORDER BY Id FOR JSON PATH, INCLUDE_NULL_VALUES")
    series = q("SELECT Id, Name, Description, History, LogoPath, FolderPath, Rating, CONVERT(char(10), StartDate, 23) StartDate, "
               "CONVERT(char(10), EndDate, 23) EndDate, Seasons FROM Series ORDER BY Id FOR JSON PATH, INCLUDE_NULL_VALUES")
    series_categories = q("SELECT SeriesId, CategoriesId FROM SeriesCategories ORDER BY SeriesId, CategoriesId FOR JSON PATH")
    episodes = q("SELECT Id, SeriesId, Season, EpisodeTypeId, EpisodeNumber, Title, FilePath, IsAvailable FROM Episodes "
                 "ORDER BY Id FOR JSON PATH, INCLUDE_NULL_VALUES")
    channels = q("SELECT Id, ShareId, Name, History, LogoPath, CONVERT(varchar(27), StartDate, 126) StartDate, "
                 "CONVERT(varchar(27), EndDate, 126) EndDate FROM Channels ORDER BY Id FOR JSON PATH, INCLUDE_NULL_VALUES")
    eras = q("SELECT Id, ChannelId, Name, Description, FolderPath, CONVERT(varchar(27), HistoricalStartDate, 126) HistoricalStartDate, "
             "CONVERT(varchar(27), HistoricalEndDate, 126) HistoricalEndDate FROM ChannelEras ORDER BY Id FOR JSON PATH, INCLUDE_NULL_VALUES")
    era_series = q("SELECT ChannelErasId, SeriesId FROM ChannelEraSeries ORDER BY 1, 2 FOR JSON PATH")
    era_seasons = q("SELECT ChannelErasId, SeriesId, SeasonNumber FROM ChannelEraSelectedSeasons ORDER BY 1, 2, 3 FOR JSON PATH")
    selections = q("SELECT ChannelId, ChannelEraId, CONVERT(varchar(27), SelectedAtUtc, 126) SelectedAtUtc FROM ChannelEraSelections FOR JSON PATH")
    settings = q("SELECT TOP 1 * FROM PlatformSettings FOR JSON PATH")
    policy = q("SELECT TOP 1 DayCores, NightCores, NightEnabled, NightStartMinute, NightEndMinute FROM MediaResourcePolicies FOR JSON PATH")
    admin_ids = {row["Id"] for row in q("SELECT Id FROM Users WHERE Username = N'admin' FOR JSON PATH")}
    profiles = q("SELECT Id, UserId, CONVERT(varchar(27), CreatedAtUtc, 126) CreatedAtUtc FROM ViewerProfiles ORDER BY CreatedAtUtc FOR JSON PATH, INCLUDE_NULL_VALUES")
    devices = q("SELECT Id, ProfileId, Name, TokenHash, CONVERT(varchar(27), LastSeenUtc, 126) LastSeenUtc, "
                "CONVERT(varchar(27), ExpiresAtUtc, 126) ExpiresAtUtc FROM ViewerDevices WHERE ExpiresAtUtc > SYSUTCDATETIME() FOR JSON PATH")
    progress = q("SELECT ProfileId, EpisodeId, CurrentSecond, Completed, CONVERT(varchar(27), UpdatedAtUtc, 126) UpdatedAtUtc FROM ViewerProgress FOR JSON PATH")
    ranges = q("SELECT ProfileId, EpisodeId, StartSecond, EndSecond FROM ViewerWatchRanges ORDER BY Id FOR JSON PATH")

    # Episodes: public paths, parts from file names, one row per (series, season, type, number, part).
    for episode in episodes:
        path = episode["FilePath"]
        if path:
            path = path.replace("\\", "/")
            path = "/" + path.split("wwwroot/", 1)[1] if "wwwroot/" in path else path
        episode["FilePath"] = path
        episode["Part"] = part_of(path) if path else None
    kept, remap, dropped = {}, {}, []
    for episode in sorted(episodes, key=lambda e: (not e["IsAvailable"], e["Id"])):
        key = (episode["SeriesId"], episode["Season"], episode["EpisodeTypeId"], episode["EpisodeNumber"], episode["Part"])
        if key in kept:
            remap[episode["Id"]] = kept[key]["Id"]
            dropped.append(episode)
        else:
            kept[key] = episode
    kept_episodes = sorted(kept.values(), key=lambda e: e["Id"])
    episode_ids = {e["Id"] for e in kept_episodes}

    seasons = set()
    for item in series:
        seasons.update((item["Id"], number) for number in range(1, (item["Seasons"] or 0) + 1))
    seasons.update((e["SeriesId"], e["Season"]) for e in kept_episodes)

    # Progress follows its episode; duplicates collapse to the most recent row.
    merged = {}
    for row in progress:
        key = (row["ProfileId"], remap.get(row["EpisodeId"], row["EpisodeId"]))
        if key[1] in episode_ids and (key not in merged or row["UpdatedAtUtc"] > merged[key]["UpdatedAtUtc"]):
            merged[key] = row
    linked = {p["Id"] for p in profiles if p["UserId"] in admin_ids}
    owner = "(SELECT [Id] FROM [Users] WHERE [Username] = N'admin')"
    version = "(SELECT [SessionVersion] FROM [Users] WHERE [Username] = N'admin')"

    out = [
        f"-- NostalgiaTV v1 -> v2 data, generated {datetime.now():%Y-%m-%d %H:%M} from [{args.database}].",
        "-- Run once on the v2 database after InitialCreate and the admin bootstrap. All or nothing.",
        "SET NOCOUNT ON;", "SET XACT_ABORT ON;",
        "-- Filtered unique indexes need these options; sqlcmd starts with QUOTED_IDENTIFIER OFF.",
        "SET QUOTED_IDENTIFIER ON; SET ANSI_NULLS ON; SET ANSI_PADDING ON; SET ANSI_WARNINGS ON; SET ARITHABORT ON; SET CONCAT_NULL_YIELDS_NULL ON;",
        "IF EXISTS (SELECT 1 FROM [Series]) OR EXISTS (SELECT 1 FROM [Channels]) OR EXISTS (SELECT 1 FROM [ViewerProfiles])",
        "    THROW 50000, 'The v2 database already has catalog or viewer data; this script runs only on a fresh database.', 1;",
        "IF NOT EXISTS (SELECT 1 FROM [Users] WHERE [Username] = N'admin')",
        "    THROW 50001, 'Bootstrap the v2 administrator before importing.', 1;",
        "BEGIN TRANSACTION;", "",
    ]
    out += insert("Categories", ["Id", "Name"], [[lit(c["Id"]), lit(c["Name"][:100])] for c in categories], identity=True)
    out += insert("Series", ["Id", "Name", "Description", "History", "LogoPath", "FolderPath", "Rating", "StartDate", "EndDate"],
                  [[lit(s["Id"]), lit(s["Name"][:200]), lit(s["Description"]), lit(s["History"]), lit(s["LogoPath"]), lit(s["FolderPath"]),
                    lit(None if s["Rating"] is None else round(s["Rating"], 1)), lit(s["StartDate"]), lit(s["EndDate"])] for s in series], identity=True)
    out += insert("SeriesSeasons", ["SeriesId", "SeasonNumber"], [[lit(a), lit(b)] for a, b in sorted(seasons)])
    out += insert("SeriesCategories", ["SeriesId", "CategoryId"], [[lit(r["SeriesId"]), lit(r["CategoriesId"])] for r in series_categories])
    out += insert("Episodes", ["Id", "SeriesId", "SeasonNumber", "EpisodeTypeId", "EpisodeNumber", "Part", "Title", "FilePath", "IsAvailable"],
                  [[lit(e["Id"]), lit(e["SeriesId"]), lit(e["Season"]), lit(e["EpisodeTypeId"]), lit(e["EpisodeNumber"]), lit(e["Part"]),
                    lit(e["Title"][:300]), lit(e["FilePath"]), lit(bool(e["IsAvailable"]))] for e in kept_episodes], identity=True)
    out += insert("Channels", ["Id", "ShareId", "Name", "History", "LogoPath", "StartDate", "EndDate"],
                  [[lit(c["Id"]), lit(c["ShareId"]), lit(c["Name"][:200]), lit(c["History"]), lit(c["LogoPath"]), lit(c["StartDate"]),
                    lit(c["EndDate"])] for c in channels], identity=True)
    out += insert("ChannelEras", ["Id", "ChannelId", "Name", "Description", "FolderPath", "HistoricalStartDate", "HistoricalEndDate"],
                  [[lit(e["Id"]), lit(e["ChannelId"]), lit(e["Name"][:200]), lit(e["Description"]), lit(e["FolderPath"]),
                    lit(e["HistoricalStartDate"]), lit(e["HistoricalEndDate"])] for e in eras], identity=True)
    out += insert("ChannelEraSeries", ["ChannelEraId", "SeriesId"], [[lit(r["ChannelErasId"]), lit(r["SeriesId"])] for r in era_series])
    out += insert("ChannelEraSelectedSeasons", ["ChannelEraId", "SeriesId", "SeasonNumber"],
                  [[lit(r["ChannelErasId"]), lit(r["SeriesId"]), lit(r["SeasonNumber"])] for r in era_seasons])
    out += insert("ChannelEraSelections", ["ChannelId", "ChannelEraId", "SelectedAtUtc"],
                  [[lit(r["ChannelId"]), lit(r["ChannelEraId"]), lit(r["SelectedAtUtc"])] for r in selections])
    if settings:
        s = settings[0]
        out += ["-- PlatformSettings (the viewer role keeps its v2 seed)",
                "UPDATE [PlatformSettings] SET " + ", ".join(f"[{k}] = {lit(s[k])}" for k in [
                    "TimeZoneId", "PublicRegistrationEnabled", "NoRepeatWindowHours", "MaxSpecialsPerDay", "MaxSpecialsPerSeriesPerDay",
                    "MaxMoviesPerDay", "MaxMoviesPerSeriesPerDay", "SeasonalEffectsEnabled", "SeasonalEpisodesEnabled",
                    "SeasonalInterludesEnabled", "SeasonalThemesEnabled"]) + " WHERE [Id] = 1;"]
    if policy:
        p = policy[0]
        out += ["-- MediaResourcePolicies (v2 limits: 1-2 day cores, 1-4 night cores)",
                f"UPDATE [MediaResourcePolicies] SET [DayCores] = {min(max(p['DayCores'], 1), 2)}, [NightCores] = {min(max(p['NightCores'], 1), 4)}, "
                f"[NightEnabled] = {lit(bool(p['NightEnabled']))}, [NightStartMinute] = {p['NightStartMinute']}, [NightEndMinute] = {p['NightEndMinute']} WHERE [Id] = 1;"]
    out += insert("ViewerProfiles", ["Id", "UserId", "CreatedAtUtc"],
                  [[lit(p["Id"]), owner if p["Id"] in linked else "NULL", lit(p["CreatedAtUtc"])] for p in profiles])
    out += insert("ViewerDevices", ["Id", "ProfileId", "Name", "TokenHash", "SessionVersion", "LastSeenUtc", "ExpiresAtUtc"],
                  [[lit(d["Id"]), lit(d["ProfileId"]), lit(d["Name"][:80]), lit(d["TokenHash"]), version if d["ProfileId"] in linked else "NULL",
                    lit(d["LastSeenUtc"]), lit(d["ExpiresAtUtc"])] for d in devices])
    out += insert("ViewerProgress", ["ProfileId", "EpisodeId", "CurrentSecond", "Completed", "UpdatedAtUtc"],
                  [[lit(r["ProfileId"]), lit(e), f"{round(r['CurrentSecond'], 3):.3f}", lit(bool(r["Completed"])), lit(r["UpdatedAtUtc"])]
                   for (profile, e), r in sorted(merged.items())])
    valid_ranges = [r for r in ranges if (r["ProfileId"], remap.get(r["EpisodeId"], r["EpisodeId"])) in merged
                    and r["StartSecond"] >= 0 and r["EndSecond"] > r["StartSecond"]]
    out += insert("ViewerWatchRanges", ["ProfileId", "EpisodeId", "StartSecond", "EndSecond"],
                  [[lit(r["ProfileId"]), lit(remap.get(r["EpisodeId"], r["EpisodeId"])), f"{r['StartSecond']:.3f}", f"{r['EndSecond']:.3f}"]
                   for r in valid_ranges])
    out += ["", "COMMIT TRANSACTION;", "PRINT 'NostalgiaTV v1 data imported.';"]

    # No BOM: sqlcmd skips it with -i but fails on it when the script arrives on standard input.
    with open(args.out, "w", encoding="utf-8", newline="\n") as file:
        file.write("\n".join(out) + "\n")
    parts = [e for e in kept_episodes if e["Part"]]
    print(f"categories {len(categories)}, series {len(series)}, seasons {len(seasons)}, episodes {len(kept_episodes)} "
          f"(dropped {len(dropped)} duplicates), parts {len(parts)}, channels {len(channels)}, eras {len(eras)}, "
          f"profiles {len(profiles)} ({len(linked)} linked), devices {len(devices)}, progress {len(merged)}, ranges {len(valid_ranges)}")
    for e in dropped:
        print(f"  dropped episode {e['Id']} (series {e['SeriesId']} T{e['Season']} E{e['EpisodeNumber']}, available={e['IsAvailable']}) -> kept {remap[e['Id']]}")
    for e in parts:
        print(f"  part {e['Part']}: episode {e['Id']} (series {e['SeriesId']} T{e['Season']} E{e['EpisodeNumber']})")


if __name__ == "__main__":
    main()
