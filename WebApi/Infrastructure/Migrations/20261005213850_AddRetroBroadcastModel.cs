using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddRetroBroadcastModel : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                IF EXISTS (
                    SELECT 1 FROM ChannelEras
                    WHERE EndDate IS NOT NULL AND EndDate < StartDate
                )
                    THROW 51010, 'Fix inverted ChannelEras dates before applying this migration.', 1;

                IF EXISTS (
                    SELECT 1 FROM ChannelBumpers
                    WHERE DATALENGTH(Title) / 2 > 300
                       OR DATALENGTH(FilePath) / 2 > 1000
                )
                    THROW 51011, 'Shorten legacy bumper titles or file paths before applying this migration.', 1;
                """);

            migrationBuilder.DropIndex(
                name: "IX_ChannelEras_ChannelId",
                table: "ChannelEras");

            migrationBuilder.RenameColumn(
                name: "StartDate",
                table: "ChannelEras",
                newName: "HistoricalStartDate");

            migrationBuilder.RenameColumn(
                name: "EndDate",
                table: "ChannelEras",
                newName: "HistoricalEndDate");

            migrationBuilder.AddUniqueConstraint(
                name: "AK_ChannelEras_ChannelId_Id",
                table: "ChannelEras",
                columns: new[] { "ChannelId", "Id" });

            migrationBuilder.CreateTable(
                name: "ChannelEraBreakRules",
                columns: table => new
                {
                    ChannelEraId = table.Column<int>(type: "int", nullable: false),
                    MinimumAds = table.Column<int>(type: "int", nullable: false),
                    MaximumAds = table.Column<int>(type: "int", nullable: false),
                    MaximumBreakSeconds = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ChannelEraBreakRules", x => x.ChannelEraId);
                    table.CheckConstraint("CK_ChannelEraBreakRules_AdCount", "[MinimumAds] >= 1 AND [MaximumAds] >= [MinimumAds]");
                    table.CheckConstraint("CK_ChannelEraBreakRules_Duration", "[MaximumBreakSeconds] > 0");
                    table.ForeignKey(
                        name: "FK_ChannelEraBreakRules_ChannelEras_ChannelEraId",
                        column: x => x.ChannelEraId,
                        principalTable: "ChannelEras",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ChannelEraSelections",
                columns: table => new
                {
                    ChannelId = table.Column<int>(type: "int", nullable: false),
                    ChannelEraId = table.Column<int>(type: "int", nullable: false),
                    SelectedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ChannelEraSelections", x => x.ChannelId);
                    table.ForeignKey(
                        name: "FK_ChannelEraSelections_ChannelEras_ChannelId_ChannelEraId",
                        columns: x => new { x.ChannelId, x.ChannelEraId },
                        principalTable: "ChannelEras",
                        principalColumns: new[] { "ChannelId", "Id" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ChannelEraSelections_Channels_ChannelId",
                        column: x => x.ChannelId,
                        principalTable: "Channels",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "EpisodeBreakPoints",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    EpisodeId = table.Column<int>(type: "int", nullable: false),
                    OffsetSeconds = table.Column<decimal>(type: "decimal(12,3)", nullable: false),
                    Label = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EpisodeBreakPoints", x => x.Id);
                    table.CheckConstraint("CK_EpisodeBreakPoints_Offset", "[OffsetSeconds] > 0");
                    table.ForeignKey(
                        name: "FK_EpisodeBreakPoints_Episodes_EpisodeId",
                        column: x => x.EpisodeId,
                        principalTable: "Episodes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Interludes",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Kind = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    Title = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    FilePath = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    DurationSeconds = table.Column<decimal>(type: "decimal(12,3)", nullable: false),
                    OriginalYearFrom = table.Column<int>(type: "int", nullable: true),
                    OriginalYearTo = table.Column<int>(type: "int", nullable: true),
                    RegionCode = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    ApprovedForBroadcast = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Interludes", x => x.Id);
                    table.CheckConstraint("CK_Interludes_Duration", "[DurationSeconds] > 0");
                    table.CheckConstraint("CK_Interludes_Kind", "[Kind] IN ('Bumper', 'Advertisement')");
                    table.CheckConstraint("CK_Interludes_OriginalYears", "[OriginalYearTo] IS NULL OR [OriginalYearFrom] IS NULL OR [OriginalYearTo] >= [OriginalYearFrom]");
                });

            migrationBuilder.CreateTable(
                name: "MetadataProviders",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Code = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MetadataProviders", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ScheduledPrograms",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ChannelEraId = table.Column<int>(type: "int", nullable: false),
                    EpisodeId = table.Column<int>(type: "int", nullable: false),
                    GeneratedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ScheduledPrograms", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ScheduledPrograms_ChannelEras_ChannelEraId",
                        column: x => x.ChannelEraId,
                        principalTable: "ChannelEras",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ScheduledPrograms_Episodes_EpisodeId",
                        column: x => x.EpisodeId,
                        principalTable: "Episodes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "SeriesComments",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    SeriesId = table.Column<int>(type: "int", nullable: false),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    ParentCommentId = table.Column<long>(type: "bigint", nullable: true),
                    Body = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    EditedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SeriesComments", x => x.Id);
                    table.UniqueConstraint("AK_SeriesComments_Id_SeriesId", x => new { x.Id, x.SeriesId });
                    table.ForeignKey(
                        name: "FK_SeriesComments_SeriesComments_ParentCommentId_SeriesId",
                        columns: x => new { x.ParentCommentId, x.SeriesId },
                        principalTable: "SeriesComments",
                        principalColumns: new[] { "Id", "SeriesId" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_SeriesComments_Series_SeriesId",
                        column: x => x.SeriesId,
                        principalTable: "Series",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_SeriesComments_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ChannelEraInterludes",
                columns: table => new
                {
                    ChannelEraId = table.Column<int>(type: "int", nullable: false),
                    InterludeId = table.Column<int>(type: "int", nullable: false),
                    Role = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    Weight = table.Column<int>(type: "int", nullable: false),
                    MinimumGapSeconds = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ChannelEraInterludes", x => new { x.ChannelEraId, x.InterludeId, x.Role });
                    table.CheckConstraint("CK_ChannelEraInterludes_Gap", "[MinimumGapSeconds] >= 0");
                    table.CheckConstraint("CK_ChannelEraInterludes_Role", "[Role] IN ('BreakOpener', 'Advertisement', 'BreakCloser')");
                    table.CheckConstraint("CK_ChannelEraInterludes_Weight", "[Weight] > 0");
                    table.ForeignKey(
                        name: "FK_ChannelEraInterludes_ChannelEras_ChannelEraId",
                        column: x => x.ChannelEraId,
                        principalTable: "ChannelEras",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ChannelEraInterludes_Interludes_InterludeId",
                        column: x => x.InterludeId,
                        principalTable: "Interludes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "SeriesExternalIds",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    SeriesId = table.Column<int>(type: "int", nullable: false),
                    ProviderId = table.Column<int>(type: "int", nullable: false),
                    ExternalId = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SeriesExternalIds", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SeriesExternalIds_MetadataProviders_ProviderId",
                        column: x => x.ProviderId,
                        principalTable: "MetadataProviders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_SeriesExternalIds_Series_SeriesId",
                        column: x => x.SeriesId,
                        principalTable: "Series",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ScheduledAdBreaks",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ScheduledProgramId = table.Column<long>(type: "bigint", nullable: false),
                    EpisodeBreakPointId = table.Column<int>(type: "int", nullable: false),
                    Ordinal = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ScheduledAdBreaks", x => x.Id);
                    table.UniqueConstraint("AK_ScheduledAdBreaks_Id_ScheduledProgramId", x => new { x.Id, x.ScheduledProgramId });
                    table.CheckConstraint("CK_ScheduledAdBreaks_Ordinal", "[Ordinal] > 0");
                    table.ForeignKey(
                        name: "FK_ScheduledAdBreaks_EpisodeBreakPoints_EpisodeBreakPointId",
                        column: x => x.EpisodeBreakPointId,
                        principalTable: "EpisodeBreakPoints",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ScheduledAdBreaks_ScheduledPrograms_ScheduledProgramId",
                        column: x => x.ScheduledProgramId,
                        principalTable: "ScheduledPrograms",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "MetadataImportRuns",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    SeriesExternalId = table.Column<int>(type: "int", nullable: false),
                    LanguageCode = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    Status = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    StartedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    FinishedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MetadataImportRuns", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MetadataImportRuns_SeriesExternalIds_SeriesExternalId",
                        column: x => x.SeriesExternalId,
                        principalTable: "SeriesExternalIds",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ScheduledPlaybackSegments",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ScheduledProgramId = table.Column<long>(type: "bigint", nullable: false),
                    ScheduledAdBreakId = table.Column<long>(type: "bigint", nullable: true),
                    InterludeId = table.Column<int>(type: "int", nullable: true),
                    Sequence = table.Column<int>(type: "int", nullable: false),
                    StartsAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    EndsAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    MediaStartSecond = table.Column<decimal>(type: "decimal(12,3)", nullable: true),
                    MediaEndSecond = table.Column<decimal>(type: "decimal(12,3)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ScheduledPlaybackSegments", x => x.Id);
                    table.CheckConstraint("CK_ScheduledPlaybackSegments_Content", "([InterludeId] IS NULL AND [ScheduledAdBreakId] IS NULL AND [MediaStartSecond] IS NOT NULL AND [MediaEndSecond] IS NOT NULL AND [MediaStartSecond] >= 0 AND [MediaEndSecond] > [MediaStartSecond]) OR ([InterludeId] IS NOT NULL AND [ScheduledAdBreakId] IS NOT NULL AND [MediaStartSecond] IS NULL AND [MediaEndSecond] IS NULL)");
                    table.CheckConstraint("CK_ScheduledPlaybackSegments_Sequence", "[Sequence] > 0");
                    table.CheckConstraint("CK_ScheduledPlaybackSegments_Time", "[EndsAtUtc] > [StartsAtUtc]");
                    table.ForeignKey(
                        name: "FK_ScheduledPlaybackSegments_Interludes_InterludeId",
                        column: x => x.InterludeId,
                        principalTable: "Interludes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ScheduledPlaybackSegments_ScheduledAdBreaks_ScheduledAdBreakId_ScheduledProgramId",
                        columns: x => new { x.ScheduledAdBreakId, x.ScheduledProgramId },
                        principalTable: "ScheduledAdBreaks",
                        principalColumns: new[] { "Id", "ScheduledProgramId" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ScheduledPlaybackSegments_ScheduledPrograms_ScheduledProgramId",
                        column: x => x.ScheduledProgramId,
                        principalTable: "ScheduledPrograms",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.AddCheckConstraint(
                name: "CK_ChannelEras_HistoricalDates",
                table: "ChannelEras",
                sql: "[HistoricalEndDate] IS NULL OR [HistoricalEndDate] >= [HistoricalStartDate]");

            migrationBuilder.CreateIndex(
                name: "IX_ChannelEraInterludes_InterludeId",
                table: "ChannelEraInterludes",
                column: "InterludeId");

            migrationBuilder.CreateIndex(
                name: "IX_ChannelEraSelections_ChannelId_ChannelEraId",
                table: "ChannelEraSelections",
                columns: new[] { "ChannelId", "ChannelEraId" });

            migrationBuilder.CreateIndex(
                name: "IX_EpisodeBreakPoints_EpisodeId_OffsetSeconds",
                table: "EpisodeBreakPoints",
                columns: new[] { "EpisodeId", "OffsetSeconds" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_MetadataImportRuns_SeriesExternalId",
                table: "MetadataImportRuns",
                column: "SeriesExternalId");

            migrationBuilder.CreateIndex(
                name: "IX_MetadataProviders_Code",
                table: "MetadataProviders",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ScheduledAdBreaks_EpisodeBreakPointId",
                table: "ScheduledAdBreaks",
                column: "EpisodeBreakPointId");

            migrationBuilder.CreateIndex(
                name: "IX_ScheduledAdBreaks_ScheduledProgramId_EpisodeBreakPointId",
                table: "ScheduledAdBreaks",
                columns: new[] { "ScheduledProgramId", "EpisodeBreakPointId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ScheduledAdBreaks_ScheduledProgramId_Ordinal",
                table: "ScheduledAdBreaks",
                columns: new[] { "ScheduledProgramId", "Ordinal" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ScheduledPlaybackSegments_InterludeId",
                table: "ScheduledPlaybackSegments",
                column: "InterludeId");

            migrationBuilder.CreateIndex(
                name: "IX_ScheduledPlaybackSegments_ScheduledAdBreakId_ScheduledProgramId",
                table: "ScheduledPlaybackSegments",
                columns: new[] { "ScheduledAdBreakId", "ScheduledProgramId" });

            migrationBuilder.CreateIndex(
                name: "IX_ScheduledPlaybackSegments_ScheduledProgramId_Sequence",
                table: "ScheduledPlaybackSegments",
                columns: new[] { "ScheduledProgramId", "Sequence" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ScheduledPlaybackSegments_StartsAtUtc_EndsAtUtc",
                table: "ScheduledPlaybackSegments",
                columns: new[] { "StartsAtUtc", "EndsAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_ScheduledPrograms_ChannelEraId",
                table: "ScheduledPrograms",
                column: "ChannelEraId");

            migrationBuilder.CreateIndex(
                name: "IX_ScheduledPrograms_EpisodeId",
                table: "ScheduledPrograms",
                column: "EpisodeId");

            migrationBuilder.CreateIndex(
                name: "IX_SeriesComments_ParentCommentId_SeriesId",
                table: "SeriesComments",
                columns: new[] { "ParentCommentId", "SeriesId" });

            migrationBuilder.CreateIndex(
                name: "IX_SeriesComments_SeriesId",
                table: "SeriesComments",
                column: "SeriesId");

            migrationBuilder.CreateIndex(
                name: "IX_SeriesComments_UserId",
                table: "SeriesComments",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_SeriesExternalIds_ProviderId_ExternalId",
                table: "SeriesExternalIds",
                columns: new[] { "ProviderId", "ExternalId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SeriesExternalIds_SeriesId",
                table: "SeriesExternalIds",
                column: "SeriesId");

            migrationBuilder.Sql("""
                DECLARE @ImportedEras TABLE (Id int NOT NULL, ChannelId int NOT NULL);

                INSERT INTO ChannelEras
                    (ChannelId, Name, Description, HistoricalStartDate, HistoricalEndDate, FolderPath)
                OUTPUT INSERTED.Id, INSERTED.ChannelId INTO @ImportedEras
                SELECT channel.Id, 'Imported lineup', NULL, channel.StartDate, channel.EndDate, NULL
                FROM Channels AS channel
                WHERE NOT EXISTS (
                    SELECT 1 FROM ChannelEras AS era WHERE era.ChannelId = channel.Id
                );

                INSERT INTO ChannelEraSeries (ChannelErasId, SeriesId, HasSeasonFilter)
                SELECT imported.Id, link.SeriesId, 0
                FROM @ImportedEras AS imported
                INNER JOIN ChannelSeries AS link ON link.ChannelsId = imported.ChannelId;

                WITH RankedEras AS (
                    SELECT era.ChannelId, era.Id,
                        ROW_NUMBER() OVER (
                            PARTITION BY era.ChannelId
                            ORDER BY era.HistoricalStartDate DESC, era.Id DESC
                        ) AS RowNumber
                    FROM ChannelEras AS era
                )
                INSERT INTO ChannelEraSelections (ChannelId, ChannelEraId, SelectedAtUtc)
                SELECT ChannelId, Id, SYSUTCDATETIME()
                FROM RankedEras
                WHERE RowNumber = 1;

                INSERT INTO ChannelEraSeries (ChannelErasId, SeriesId, HasSeasonFilter)
                SELECT selection.ChannelEraId, link.SeriesId, 0
                FROM ChannelEraSelections AS selection
                INNER JOIN ChannelSeries AS link ON link.ChannelsId = selection.ChannelId
                WHERE NOT EXISTS (
                    SELECT 1 FROM ChannelEraSeries AS assigned
                    WHERE assigned.ChannelErasId = selection.ChannelEraId
                );

                SET IDENTITY_INSERT Interludes ON;
                INSERT INTO Interludes
                    (Id, Kind, Title, FilePath, DurationSeconds, OriginalYearFrom,
                     OriginalYearTo, RegionCode, ApprovedForBroadcast)
                SELECT Id, 'Bumper', Title, FilePath, 1, NULL, NULL, NULL, 0
                FROM ChannelBumpers
                WHERE FilePath IS NOT NULL AND LTRIM(RTRIM(FilePath)) <> '';
                SET IDENTITY_INSERT Interludes OFF;

                INSERT INTO ChannelEraInterludes
                    (ChannelEraId, InterludeId, Role, Weight, MinimumGapSeconds)
                SELECT bumper.ChannelEraId, bumper.Id, role.Name, 1, 0
                FROM ChannelBumpers AS bumper
                CROSS JOIN (VALUES ('BreakOpener'), ('BreakCloser')) AS role(Name)
                WHERE EXISTS (SELECT 1 FROM Interludes AS clip WHERE clip.Id = bumper.Id);
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ChannelEraBreakRules");

            migrationBuilder.DropTable(
                name: "ChannelEraInterludes");

            migrationBuilder.DropTable(
                name: "ChannelEraSelections");

            migrationBuilder.DropTable(
                name: "MetadataImportRuns");

            migrationBuilder.DropTable(
                name: "ScheduledPlaybackSegments");

            migrationBuilder.DropTable(
                name: "SeriesComments");

            migrationBuilder.DropTable(
                name: "SeriesExternalIds");

            migrationBuilder.DropTable(
                name: "Interludes");

            migrationBuilder.DropTable(
                name: "ScheduledAdBreaks");

            migrationBuilder.DropTable(
                name: "MetadataProviders");

            migrationBuilder.DropTable(
                name: "EpisodeBreakPoints");

            migrationBuilder.DropTable(
                name: "ScheduledPrograms");

            migrationBuilder.DropUniqueConstraint(
                name: "AK_ChannelEras_ChannelId_Id",
                table: "ChannelEras");

            migrationBuilder.DropCheckConstraint(
                name: "CK_ChannelEras_HistoricalDates",
                table: "ChannelEras");

            migrationBuilder.RenameColumn(
                name: "HistoricalStartDate",
                table: "ChannelEras",
                newName: "StartDate");

            migrationBuilder.RenameColumn(
                name: "HistoricalEndDate",
                table: "ChannelEras",
                newName: "EndDate");

            migrationBuilder.CreateIndex(
                name: "IX_ChannelEras_ChannelId",
                table: "ChannelEras",
                column: "ChannelId");
        }
    }
}
