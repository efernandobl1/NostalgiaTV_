using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class NormalizeEraSeasonSelections : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "HasSeasonFilter",
                table: "ChannelEraSeries",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateTable(
                name: "ChannelEraSelectedSeasons",
                columns: table => new
                {
                    ChannelErasId = table.Column<int>(type: "int", nullable: false),
                    SeriesId = table.Column<int>(type: "int", nullable: false),
                    SeasonNumber = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ChannelEraSelectedSeasons", x => new { x.ChannelErasId, x.SeriesId, x.SeasonNumber });
                    table.CheckConstraint("CK_ChannelEraSelectedSeasons_SeasonNumber", "[SeasonNumber] >= 0");
                    table.ForeignKey(
                        name: "FK_ChannelEraSelectedSeasons_ChannelEraSeries_ChannelErasId_SeriesId",
                        columns: x => new { x.ChannelErasId, x.SeriesId },
                        principalTable: "ChannelEraSeries",
                        principalColumns: new[] { "ChannelErasId", "SeriesId" },
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.Sql("""
                IF EXISTS (
                    SELECT 1 FROM ChannelEras
                    WHERE ISJSON(SeriesSeasonsJson) <> 1
                       OR LEFT(LTRIM(SeriesSeasonsJson), 1) <> '{'
                )
                    THROW 51000, 'ChannelEras contains invalid season-selection JSON.', 1;

                IF EXISTS (
                    SELECT 1
                    FROM ChannelEras AS era
                    CROSS APPLY OPENJSON(era.SeriesSeasonsJson) AS selectedSeries
                    WHERE selectedSeries.[type] <> 4
                       OR TRY_CONVERT(int, selectedSeries.[key]) IS NULL
                       OR NOT EXISTS (
                           SELECT 1 FROM ChannelEraSeries AS link
                           WHERE link.ChannelErasId = era.Id
                             AND link.SeriesId = TRY_CONVERT(int, selectedSeries.[key])
                       )
                )
                    THROW 51001, 'An era season filter does not match its assigned series.', 1;

                IF EXISTS (
                    SELECT 1
                    FROM ChannelEras AS era
                    CROSS APPLY OPENJSON(era.SeriesSeasonsJson) AS selectedSeries
                    GROUP BY era.Id, TRY_CONVERT(int, selectedSeries.[key])
                    HAVING COUNT(*) > 1
                )
                    THROW 51003, 'An era season filter contains duplicate series keys.', 1;

                IF EXISTS (
                    SELECT 1
                    FROM ChannelEras AS era
                    CROSS APPLY OPENJSON(era.SeriesSeasonsJson) AS selectedSeries
                    CROSS APPLY OPENJSON(selectedSeries.[value]) AS selectedSeason
                    WHERE selectedSeason.[type] <> 2
                       OR TRY_CONVERT(int, selectedSeason.[value]) IS NULL
                       OR TRY_CONVERT(int, selectedSeason.[value]) < 0
                )
                    THROW 51002, 'An era season filter contains an invalid season number.', 1;

                UPDATE link
                SET HasSeasonFilter = 1
                FROM ChannelEraSeries AS link
                INNER JOIN ChannelEras AS era ON era.Id = link.ChannelErasId
                CROSS APPLY OPENJSON(era.SeriesSeasonsJson) AS selectedSeries
                WHERE TRY_CONVERT(int, selectedSeries.[key]) = link.SeriesId;

                INSERT INTO ChannelEraSelectedSeasons (ChannelErasId, SeriesId, SeasonNumber)
                SELECT DISTINCT era.Id,
                    TRY_CONVERT(int, selectedSeries.[key]),
                    TRY_CONVERT(int, selectedSeason.[value])
                FROM ChannelEras AS era
                CROSS APPLY OPENJSON(era.SeriesSeasonsJson) AS selectedSeries
                CROSS APPLY OPENJSON(selectedSeries.[value]) AS selectedSeason;
                """);

            migrationBuilder.DropColumn(
                name: "SeriesSeasonsJson",
                table: "ChannelEras");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "SeriesSeasonsJson",
                table: "ChannelEras",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "{}");

            migrationBuilder.Sql("""
                ;WITH SeasonValues AS (
                    SELECT ChannelErasId, SeriesId,
                        '[' + STRING_AGG(CONVERT(nvarchar(max), SeasonNumber), ',') + ']' AS SeasonJson
                    FROM ChannelEraSelectedSeasons
                    GROUP BY ChannelErasId, SeriesId
                ), FilterJson AS (
                    SELECT link.ChannelErasId,
                        '{' + STRING_AGG(
                            CONVERT(nvarchar(max), CONCAT('"', link.SeriesId, '":', COALESCE(seasons.SeasonJson, '[]'))),
                            ','
                        ) + '}' AS JsonValue
                    FROM ChannelEraSeries AS link
                    LEFT JOIN SeasonValues AS seasons
                        ON seasons.ChannelErasId = link.ChannelErasId AND seasons.SeriesId = link.SeriesId
                    WHERE link.HasSeasonFilter = 1
                    GROUP BY link.ChannelErasId
                )
                UPDATE era
                SET SeriesSeasonsJson = COALESCE(filter.JsonValue, '{}')
                FROM ChannelEras AS era
                LEFT JOIN FilterJson AS filter ON filter.ChannelErasId = era.Id;
                """);

            migrationBuilder.DropTable(
                name: "ChannelEraSelectedSeasons");

            migrationBuilder.DropColumn(
                name: "HasSeasonFilter",
                table: "ChannelEraSeries");
        }
    }
}
