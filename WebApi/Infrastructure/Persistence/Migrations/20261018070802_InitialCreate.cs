using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Categories",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    DeletedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Categories", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Channels",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ShareId = table.Column<Guid>(type: "uniqueidentifier", nullable: false, defaultValueSql: "NEWID()"),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    History = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    LogoPath = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    StartDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    EndDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    DeletedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Channels", x => x.Id);
                    table.CheckConstraint("CK_Channels_Dates", "[EndDate] IS NULL OR [EndDate] >= [StartDate]");
                });

            migrationBuilder.CreateTable(
                name: "EpisodeTypes",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    DeletedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EpisodeTypes", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Interludes",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Title = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    Kind = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    BumperType = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    Season = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false, defaultValue: "AllYear"),
                    FilePath = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    DurationSeconds = table.Column<decimal>(type: "decimal(12,3)", precision: 12, scale: 3, nullable: false),
                    ApprovedForBroadcast = table.Column<bool>(type: "bit", nullable: false),
                    RedistributionAllowed = table.Column<bool>(type: "bit", nullable: false),
                    License = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    SourceUrl = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    RegionCode = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    OriginalYearFrom = table.Column<int>(type: "int", nullable: true),
                    OriginalYearTo = table.Column<int>(type: "int", nullable: true),
                    DeletedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Interludes", x => x.Id);
                    table.CheckConstraint("CK_Interludes_BumperType", "([Kind] = 'Bumper' AND [BumperType] IN ('ComingUp', 'WeContinueWith', 'Generic')) OR ([Kind] = 'Advertisement' AND [BumperType] IS NULL)");
                    table.CheckConstraint("CK_Interludes_Duration", "[DurationSeconds] > 0");
                    table.CheckConstraint("CK_Interludes_Kind", "[Kind] IN ('Bumper', 'Advertisement')");
                    table.CheckConstraint("CK_Interludes_OriginalYears", "[OriginalYearTo] IS NULL OR [OriginalYearFrom] IS NULL OR [OriginalYearTo] >= [OriginalYearFrom]");
                    table.CheckConstraint("CK_Interludes_Redistribution", "[RedistributionAllowed] = 0 OR LEN(LTRIM(RTRIM([License]))) > 0 AND [License] IS NOT NULL");
                    table.CheckConstraint("CK_Interludes_Season", "[Season] IN ('AllYear', 'Halloween', 'Christmas')");
                });

            migrationBuilder.CreateTable(
                name: "MediaResourcePolicies",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false),
                    DayCores = table.Column<int>(type: "int", nullable: false),
                    NightCores = table.Column<int>(type: "int", nullable: false),
                    NightEnabled = table.Column<bool>(type: "bit", nullable: false),
                    NightStartMinute = table.Column<int>(type: "int", nullable: false),
                    NightEndMinute = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MediaResourcePolicies", x => x.Id);
                    table.CheckConstraint("CK_MediaResourcePolicies_NightMinutes", "[NightStartMinute] BETWEEN 0 AND 1439 AND [NightEndMinute] BETWEEN 0 AND 1439");
                    table.CheckConstraint("CK_MediaResourcePolicies_Singleton", "[Id] = 1");
                });

            migrationBuilder.CreateTable(
                name: "MediaWorkerStates",
                columns: table => new
                {
                    Id = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Enabled = table.Column<bool>(type: "bit", nullable: false),
                    HeartbeatUtc = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MediaWorkerStates", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Menus",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ParentId = table.Column<int>(type: "int", nullable: true),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Caption = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Icon = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Url = table.Column<string>(type: "nvarchar(400)", maxLength: 400, nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    IsVisible = table.Column<bool>(type: "bit", nullable: false),
                    DeletedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Menus", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Menus_Menus_ParentId",
                        column: x => x.ParentId,
                        principalTable: "Menus",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "MetadataProviders",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Code = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    DeletedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MetadataProviders", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Roles",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    DeletedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Roles", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Series",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    History = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    LogoPath = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    FolderPath = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Rating = table.Column<float>(type: "real", nullable: true),
                    StartDate = table.Column<DateOnly>(type: "date", nullable: false),
                    EndDate = table.Column<DateOnly>(type: "date", nullable: true),
                    DeletedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Series", x => x.Id);
                    table.CheckConstraint("CK_Series_Dates", "[EndDate] IS NULL OR [EndDate] >= [StartDate]");
                });

            migrationBuilder.CreateTable(
                name: "ChannelEras",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ChannelId = table.Column<int>(type: "int", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    FolderPath = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    HistoricalStartDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    HistoricalEndDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    DeletedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ChannelEras", x => x.Id);
                    table.UniqueConstraint("AK_ChannelEras_ChannelId_Id", x => new { x.ChannelId, x.Id });
                    table.CheckConstraint("CK_ChannelEras_HistoricalDates", "[HistoricalEndDate] IS NULL OR [HistoricalEndDate] >= [HistoricalStartDate]");
                    table.ForeignKey(
                        name: "FK_ChannelEras_Channels_ChannelId",
                        column: x => x.ChannelId,
                        principalTable: "Channels",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "PlatformSettings",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false),
                    ViewerRoleId = table.Column<int>(type: "int", nullable: false),
                    TimeZoneId = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    PublicRegistrationEnabled = table.Column<bool>(type: "bit", nullable: false),
                    NoRepeatWindowHours = table.Column<int>(type: "int", nullable: false),
                    MaxSpecialsPerDay = table.Column<int>(type: "int", nullable: false),
                    MaxSpecialsPerSeriesPerDay = table.Column<int>(type: "int", nullable: false),
                    MaxMoviesPerDay = table.Column<int>(type: "int", nullable: false),
                    MaxMoviesPerSeriesPerDay = table.Column<int>(type: "int", nullable: false),
                    SeasonalEffectsEnabled = table.Column<bool>(type: "bit", nullable: false),
                    SeasonalEpisodesEnabled = table.Column<bool>(type: "bit", nullable: false),
                    SeasonalInterludesEnabled = table.Column<bool>(type: "bit", nullable: false),
                    SeasonalThemesEnabled = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PlatformSettings", x => x.Id);
                    table.CheckConstraint("CK_PlatformSettings_Limits", "[NoRepeatWindowHours] BETWEEN 0 AND 72 AND [MaxSpecialsPerDay] BETWEEN 0 AND 50 AND [MaxSpecialsPerSeriesPerDay] BETWEEN 0 AND [MaxSpecialsPerDay] AND [MaxMoviesPerDay] BETWEEN 0 AND 20 AND [MaxMoviesPerSeriesPerDay] BETWEEN 0 AND [MaxMoviesPerDay]");
                    table.CheckConstraint("CK_PlatformSettings_Singleton", "[Id] = 1");
                    table.ForeignKey(
                        name: "FK_PlatformSettings_Roles_ViewerRoleId",
                        column: x => x.ViewerRoleId,
                        principalTable: "Roles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "RoleMenus",
                columns: table => new
                {
                    RoleId = table.Column<int>(type: "int", nullable: false),
                    MenuId = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RoleMenus", x => new { x.RoleId, x.MenuId });
                    table.ForeignKey(
                        name: "FK_RoleMenus_Menus_MenuId",
                        column: x => x.MenuId,
                        principalTable: "Menus",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_RoleMenus_Roles_RoleId",
                        column: x => x.RoleId,
                        principalTable: "Roles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Users",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    RoleId = table.Column<int>(type: "int", nullable: false),
                    Username = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    PasswordHash = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    FailedLoginAttempts = table.Column<int>(type: "int", nullable: false),
                    LockedUntilUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    SessionVersion = table.Column<int>(type: "int", nullable: false),
                    DeletedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Users", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Users_Roles_RoleId",
                        column: x => x.RoleId,
                        principalTable: "Roles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "MediaProcessingJobs",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    SeriesId = table.Column<int>(type: "int", nullable: false),
                    Worker = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Fingerprint = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    SourcePath = table.Column<string>(type: "nvarchar(2048)", maxLength: 2048, nullable: false),
                    SourceSize = table.Column<long>(type: "bigint", nullable: false),
                    SourceModifiedUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    OutputPath = table.Column<string>(type: "nvarchar(2048)", maxLength: 2048, nullable: true),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Progress = table.Column<double>(type: "float", nullable: false),
                    Message = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MediaProcessingJobs", x => x.Id);
                    table.CheckConstraint("CK_MediaProcessingJobs_Progress", "[Progress] BETWEEN 0 AND 100");
                    table.CheckConstraint("CK_MediaProcessingJobs_Status", "[Status] IN ('Queued', 'Processing', 'Completed', 'Failed', 'Skipped')");
                    table.ForeignKey(
                        name: "FK_MediaProcessingJobs_MediaWorkerStates_Worker",
                        column: x => x.Worker,
                        principalTable: "MediaWorkerStates",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_MediaProcessingJobs_Series_SeriesId",
                        column: x => x.SeriesId,
                        principalTable: "Series",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "SeriesCategories",
                columns: table => new
                {
                    SeriesId = table.Column<int>(type: "int", nullable: false),
                    CategoryId = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SeriesCategories", x => new { x.SeriesId, x.CategoryId });
                    table.ForeignKey(
                        name: "FK_SeriesCategories_Categories_CategoryId",
                        column: x => x.CategoryId,
                        principalTable: "Categories",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_SeriesCategories_Series_SeriesId",
                        column: x => x.SeriesId,
                        principalTable: "Series",
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
                    ExternalId = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    DeletedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true)
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
                name: "SeriesSeasons",
                columns: table => new
                {
                    SeriesId = table.Column<int>(type: "int", nullable: false),
                    SeasonNumber = table.Column<int>(type: "int", nullable: false),
                    DeletedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SeriesSeasons", x => new { x.SeriesId, x.SeasonNumber });
                    table.CheckConstraint("CK_SeriesSeasons_SeasonNumber", "[SeasonNumber] >= 0");
                    table.ForeignKey(
                        name: "FK_SeriesSeasons_Series_SeriesId",
                        column: x => x.SeriesId,
                        principalTable: "Series",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

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
                name: "ChannelEraInterludes",
                columns: table => new
                {
                    ChannelEraId = table.Column<int>(type: "int", nullable: false),
                    InterludeId = table.Column<int>(type: "int", nullable: false),
                    Weight = table.Column<int>(type: "int", nullable: false),
                    MinimumGapSeconds = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ChannelEraInterludes", x => new { x.ChannelEraId, x.InterludeId });
                    table.CheckConstraint("CK_ChannelEraInterludes_Gap", "[MinimumGapSeconds] >= 0");
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
                });

            migrationBuilder.CreateTable(
                name: "ChannelEraSeries",
                columns: table => new
                {
                    ChannelEraId = table.Column<int>(type: "int", nullable: false),
                    SeriesId = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ChannelEraSeries", x => new { x.ChannelEraId, x.SeriesId });
                    table.ForeignKey(
                        name: "FK_ChannelEraSeries_ChannelEras_ChannelEraId",
                        column: x => x.ChannelEraId,
                        principalTable: "ChannelEras",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ChannelEraSeries_Series_SeriesId",
                        column: x => x.SeriesId,
                        principalTable: "Series",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ActivityLogs",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserId = table.Column<int>(type: "int", nullable: true),
                    Action = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Resource = table.Column<string>(type: "nvarchar(400)", maxLength: 400, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ActivityLogs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ActivityLogs_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "Comments",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    Body = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    EditedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    DeletedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Comments", x => x.Id);
                    table.CheckConstraint("CK_Comments_Status", "[Status] IN ('Pending', 'Approved', 'Rejected', 'Hidden')");
                    table.ForeignKey(
                        name: "FK_Comments_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "RefreshTokens",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    Token = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    ReplacedByTokenId = table.Column<int>(type: "int", nullable: true),
                    IpAddress = table.Column<string>(type: "nvarchar(45)", maxLength: 45, nullable: false),
                    IsPersistent = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    RevokedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RefreshTokens", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RefreshTokens_RefreshTokens_ReplacedByTokenId",
                        column: x => x.ReplacedByTokenId,
                        principalTable: "RefreshTokens",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_RefreshTokens_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "UserExternalLogins",
                columns: table => new
                {
                    Provider = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    Subject = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserExternalLogins", x => new { x.Provider, x.Subject });
                    table.ForeignKey(
                        name: "FK_UserExternalLogins_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ViewerProfiles",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UserId = table.Column<int>(type: "int", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ViewerProfiles", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ViewerProfiles_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
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
                name: "Episodes",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    SeriesId = table.Column<int>(type: "int", nullable: false),
                    SeasonNumber = table.Column<int>(type: "int", nullable: false),
                    EpisodeTypeId = table.Column<int>(type: "int", nullable: false),
                    EpisodeNumber = table.Column<int>(type: "int", nullable: false),
                    Title = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    FilePath = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    IsAvailable = table.Column<bool>(type: "bit", nullable: false, defaultValue: true),
                    DeletedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Episodes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Episodes_EpisodeTypes_EpisodeTypeId",
                        column: x => x.EpisodeTypeId,
                        principalTable: "EpisodeTypes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Episodes_SeriesSeasons_SeriesId_SeasonNumber",
                        columns: x => new { x.SeriesId, x.SeasonNumber },
                        principalTable: "SeriesSeasons",
                        principalColumns: new[] { "SeriesId", "SeasonNumber" },
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ChannelEraSelectedSeasons",
                columns: table => new
                {
                    ChannelEraId = table.Column<int>(type: "int", nullable: false),
                    SeriesId = table.Column<int>(type: "int", nullable: false),
                    SeasonNumber = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ChannelEraSelectedSeasons", x => new { x.ChannelEraId, x.SeriesId, x.SeasonNumber });
                    table.ForeignKey(
                        name: "FK_ChannelEraSelectedSeasons_ChannelEraSeries_ChannelEraId_SeriesId",
                        columns: x => new { x.ChannelEraId, x.SeriesId },
                        principalTable: "ChannelEraSeries",
                        principalColumns: new[] { "ChannelEraId", "SeriesId" },
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ChannelEraSelectedSeasons_SeriesSeasons_SeriesId_SeasonNumber",
                        columns: x => new { x.SeriesId, x.SeasonNumber },
                        principalTable: "SeriesSeasons",
                        principalColumns: new[] { "SeriesId", "SeasonNumber" });
                });

            migrationBuilder.CreateTable(
                name: "ChannelEraSeriesInterludes",
                columns: table => new
                {
                    ChannelEraId = table.Column<int>(type: "int", nullable: false),
                    SeriesId = table.Column<int>(type: "int", nullable: false),
                    InterludeId = table.Column<int>(type: "int", nullable: false),
                    Weight = table.Column<int>(type: "int", nullable: false),
                    MinimumGapSeconds = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ChannelEraSeriesInterludes", x => new { x.ChannelEraId, x.SeriesId, x.InterludeId });
                    table.CheckConstraint("CK_ChannelEraSeriesInterludes_Gap", "[MinimumGapSeconds] >= 0");
                    table.CheckConstraint("CK_ChannelEraSeriesInterludes_Weight", "[Weight] > 0");
                    table.ForeignKey(
                        name: "FK_ChannelEraSeriesInterludes_ChannelEraSeries_ChannelEraId_SeriesId",
                        columns: x => new { x.ChannelEraId, x.SeriesId },
                        principalTable: "ChannelEraSeries",
                        principalColumns: new[] { "ChannelEraId", "SeriesId" },
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ChannelEraSeriesInterludes_Interludes_InterludeId",
                        column: x => x.InterludeId,
                        principalTable: "Interludes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ChannelComments",
                columns: table => new
                {
                    CommentId = table.Column<long>(type: "bigint", nullable: false),
                    ChannelId = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ChannelComments", x => x.CommentId);
                    table.ForeignKey(
                        name: "FK_ChannelComments_Channels_ChannelId",
                        column: x => x.ChannelId,
                        principalTable: "Channels",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ChannelComments_Comments_CommentId",
                        column: x => x.CommentId,
                        principalTable: "Comments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "SeriesComments",
                columns: table => new
                {
                    CommentId = table.Column<long>(type: "bigint", nullable: false),
                    SeriesId = table.Column<int>(type: "int", nullable: false),
                    ParentCommentId = table.Column<long>(type: "bigint", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SeriesComments", x => x.CommentId);
                    table.UniqueConstraint("AK_SeriesComments_CommentId_SeriesId", x => new { x.CommentId, x.SeriesId });
                    table.ForeignKey(
                        name: "FK_SeriesComments_Comments_CommentId",
                        column: x => x.CommentId,
                        principalTable: "Comments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_SeriesComments_SeriesComments_ParentCommentId_SeriesId",
                        columns: x => new { x.ParentCommentId, x.SeriesId },
                        principalTable: "SeriesComments",
                        principalColumns: new[] { "CommentId", "SeriesId" });
                    table.ForeignKey(
                        name: "FK_SeriesComments_Series_SeriesId",
                        column: x => x.SeriesId,
                        principalTable: "Series",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "DeviceAuthorizations",
                columns: table => new
                {
                    DeviceCodeHash = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    UserCodeHash = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    ProfileId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Name = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    SessionVersion = table.Column<int>(type: "int", nullable: true),
                    ExpiresAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DeviceAuthorizations", x => x.DeviceCodeHash);
                    table.ForeignKey(
                        name: "FK_DeviceAuthorizations_ViewerProfiles_ProfileId",
                        column: x => x.ProfileId,
                        principalTable: "ViewerProfiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ViewerDevices",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ProfileId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    TokenHash = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    SessionVersion = table.Column<int>(type: "int", nullable: true),
                    LastSeenUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ExpiresAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ViewerDevices", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ViewerDevices_ViewerProfiles_ProfileId",
                        column: x => x.ProfileId,
                        principalTable: "ViewerProfiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "EpisodeBreakPoints",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    EpisodeId = table.Column<int>(type: "int", nullable: false),
                    OffsetSeconds = table.Column<decimal>(type: "decimal(12,3)", precision: 12, scale: 3, nullable: false),
                    Label = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    DeletedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true)
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
                name: "ScheduledPrograms",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ChannelEraId = table.Column<int>(type: "int", nullable: false),
                    EpisodeId = table.Column<int>(type: "int", nullable: false),
                    ShuffleCycle = table.Column<int>(type: "int", nullable: true),
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
                name: "ViewerProgress",
                columns: table => new
                {
                    ProfileId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EpisodeId = table.Column<int>(type: "int", nullable: false),
                    CurrentSecond = table.Column<decimal>(type: "decimal(12,3)", precision: 12, scale: 3, nullable: false),
                    Completed = table.Column<bool>(type: "bit", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ViewerProgress", x => new { x.ProfileId, x.EpisodeId });
                    table.ForeignKey(
                        name: "FK_ViewerProgress_Episodes_EpisodeId",
                        column: x => x.EpisodeId,
                        principalTable: "Episodes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ViewerProgress_ViewerProfiles_ProfileId",
                        column: x => x.ProfileId,
                        principalTable: "ViewerProfiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ViewerPairingCodes",
                columns: table => new
                {
                    Hash = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    DeviceId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ExpiresAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ViewerPairingCodes", x => x.Hash);
                    table.ForeignKey(
                        name: "FK_ViewerPairingCodes_ViewerDevices_DeviceId",
                        column: x => x.DeviceId,
                        principalTable: "ViewerDevices",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ScheduledAdBreaks",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ScheduledProgramId = table.Column<long>(type: "bigint", nullable: false),
                    EpisodeBreakPointId = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ScheduledAdBreaks", x => x.Id);
                    table.UniqueConstraint("AK_ScheduledAdBreaks_Id_ScheduledProgramId", x => new { x.Id, x.ScheduledProgramId });
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
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ViewerWatchRanges",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ProfileId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EpisodeId = table.Column<int>(type: "int", nullable: false),
                    StartSecond = table.Column<decimal>(type: "decimal(12,3)", precision: 12, scale: 3, nullable: false),
                    EndSecond = table.Column<decimal>(type: "decimal(12,3)", precision: 12, scale: 3, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ViewerWatchRanges", x => x.Id);
                    table.CheckConstraint("CK_ViewerWatchRanges_Range", "[StartSecond] >= 0 AND [EndSecond] > [StartSecond]");
                    table.ForeignKey(
                        name: "FK_ViewerWatchRanges_ViewerProgress_ProfileId_EpisodeId",
                        columns: x => new { x.ProfileId, x.EpisodeId },
                        principalTable: "ViewerProgress",
                        principalColumns: new[] { "ProfileId", "EpisodeId" },
                        onDelete: ReferentialAction.Cascade);
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
                    StartsAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    EndsAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    MediaStartSecond = table.Column<decimal>(type: "decimal(12,3)", precision: 12, scale: 3, nullable: true),
                    MediaEndSecond = table.Column<decimal>(type: "decimal(12,3)", precision: 12, scale: 3, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ScheduledPlaybackSegments", x => x.Id);
                    table.CheckConstraint("CK_ScheduledPlaybackSegments_Content", "([InterludeId] IS NULL AND [ScheduledAdBreakId] IS NULL AND [MediaStartSecond] IS NOT NULL AND [MediaEndSecond] IS NOT NULL AND [MediaStartSecond] >= 0 AND [MediaEndSecond] > [MediaStartSecond]) OR ([InterludeId] IS NOT NULL AND [MediaStartSecond] IS NULL AND [MediaEndSecond] IS NULL)");
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
                        principalColumns: new[] { "Id", "ScheduledProgramId" });
                    table.ForeignKey(
                        name: "FK_ScheduledPlaybackSegments_ScheduledPrograms_ScheduledProgramId",
                        column: x => x.ScheduledProgramId,
                        principalTable: "ScheduledPrograms",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.InsertData(
                table: "EpisodeTypes",
                columns: new[] { "Id", "DeletedAtUtc", "Name" },
                values: new object[,]
                {
                    { 1, null, "Episodio" },
                    { 2, null, "Especial" },
                    { 3, null, "Especial de Navidad" },
                    { 4, null, "Especial de Halloween" },
                    { 5, null, "Película" }
                });

            migrationBuilder.InsertData(
                table: "MediaResourcePolicies",
                columns: new[] { "Id", "DayCores", "NightCores", "NightEnabled", "NightEndMinute", "NightStartMinute" },
                values: new object[] { 1, 1, 3, true, 300, 0 });

            migrationBuilder.InsertData(
                table: "MediaWorkerStates",
                columns: new[] { "Id", "Enabled", "HeartbeatUtc" },
                values: new object[,]
                {
                    { "index", false, null },
                    { "transcode", false, null }
                });

            migrationBuilder.InsertData(
                table: "Menus",
                columns: new[] { "Id", "Caption", "DeletedAtUtc", "Icon", "IsVisible", "Name", "ParentId", "SortOrder", "Url" },
                values: new object[,]
                {
                    { 1, "OPERACIÓN", null, "radio", true, "Operation", null, 1, "" },
                    { 2, "CATÁLOGO", null, "library", true, "Catalog", null, 2, "" },
                    { 3, "AUDIENCIA", null, "users", true, "Audience", null, 3, "" },
                    { 4, "SISTEMA", null, "settings", true, "System", null, 4, "" }
                });

            migrationBuilder.InsertData(
                table: "MetadataProviders",
                columns: new[] { "Id", "Code", "DeletedAtUtc", "Name" },
                values: new object[,]
                {
                    { 1, "tmdb", null, "TMDB" },
                    { 2, "tvdb", null, "TheTVDB" }
                });

            migrationBuilder.InsertData(
                table: "Roles",
                columns: new[] { "Id", "DeletedAtUtc", "Description", "Name" },
                values: new object[,]
                {
                    { 1, null, "Acceso completo al panel", "Administrador" },
                    { 2, null, "Rol asignado al registrarse", "Espectador" },
                    { 3, null, "Catálogo, canales y programación", "Editor" }
                });

            migrationBuilder.InsertData(
                table: "Menus",
                columns: new[] { "Id", "Caption", "DeletedAtUtc", "Icon", "IsVisible", "Name", "ParentId", "SortOrder", "Url" },
                values: new object[,]
                {
                    { 5, "Resumen", null, "gauge", true, "Summary", 1, 1, "/admin" },
                    { 6, "Programación", null, "calendar", true, "Schedule", 1, 2, "/admin/programacion" },
                    { 7, "Canales y eras", null, "tv", true, "Channels", 1, 3, "/admin/canales" },
                    { 8, "Series y episodios", null, "film", true, "Series", 2, 1, "/admin/series" },
                    { 9, "Interludios", null, "clapperboard", true, "Interludes", 2, 2, "/admin/interludios" },
                    { 10, "Espectadores", null, "eye", true, "Viewers", 3, 1, "/admin/espectadores" },
                    { 11, "Comentarios", null, "message", true, "Comments", 3, 2, "/admin/comentarios" },
                    { 12, "Procesamiento", null, "cpu", true, "Media", 4, 1, "/admin/media" },
                    { 13, "Acceso", null, "shield", true, "Access", 4, 2, "/admin/acceso" },
                    { 14, "Ajustes", null, "sliders", true, "Settings", 4, 3, "/admin/ajustes" }
                });

            migrationBuilder.InsertData(
                table: "PlatformSettings",
                columns: new[] { "Id", "MaxMoviesPerDay", "MaxMoviesPerSeriesPerDay", "MaxSpecialsPerDay", "MaxSpecialsPerSeriesPerDay", "NoRepeatWindowHours", "PublicRegistrationEnabled", "SeasonalEffectsEnabled", "SeasonalEpisodesEnabled", "SeasonalInterludesEnabled", "SeasonalThemesEnabled", "TimeZoneId", "ViewerRoleId" },
                values: new object[] { 1, 2, 2, 5, 2, 24, false, true, true, true, true, "America/Guatemala", 2 });

            migrationBuilder.InsertData(
                table: "RoleMenus",
                columns: new[] { "MenuId", "RoleId" },
                values: new object[,]
                {
                    { 1, 1 },
                    { 2, 1 },
                    { 3, 1 },
                    { 4, 1 },
                    { 1, 3 },
                    { 2, 3 },
                    { 3, 3 }
                });

            migrationBuilder.InsertData(
                table: "Users",
                columns: new[] { "Id", "DeletedAtUtc", "FailedLoginAttempts", "LockedUntilUtc", "PasswordHash", "RoleId", "SessionVersion", "Username" },
                values: new object[] { 1, null, 0, null, "!bootstrap-required", 1, 0, "admin" });

            migrationBuilder.InsertData(
                table: "RoleMenus",
                columns: new[] { "MenuId", "RoleId" },
                values: new object[,]
                {
                    { 5, 1 },
                    { 6, 1 },
                    { 7, 1 },
                    { 8, 1 },
                    { 9, 1 },
                    { 10, 1 },
                    { 11, 1 },
                    { 12, 1 },
                    { 13, 1 },
                    { 14, 1 },
                    { 5, 3 },
                    { 6, 3 },
                    { 7, 3 },
                    { 8, 3 },
                    { 9, 3 },
                    { 11, 3 }
                });

            migrationBuilder.CreateIndex(
                name: "IX_ActivityLogs_CreatedAtUtc",
                table: "ActivityLogs",
                column: "CreatedAtUtc");

            migrationBuilder.CreateIndex(
                name: "IX_ActivityLogs_UserId_CreatedAtUtc",
                table: "ActivityLogs",
                columns: new[] { "UserId", "CreatedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_Categories_Name",
                table: "Categories",
                column: "Name",
                unique: true,
                filter: "[DeletedAtUtc] IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_ChannelComments_ChannelId",
                table: "ChannelComments",
                column: "ChannelId");

            migrationBuilder.CreateIndex(
                name: "IX_ChannelEraInterludes_InterludeId",
                table: "ChannelEraInterludes",
                column: "InterludeId");

            migrationBuilder.CreateIndex(
                name: "IX_ChannelEras_ChannelId_Name",
                table: "ChannelEras",
                columns: new[] { "ChannelId", "Name" },
                unique: true,
                filter: "[DeletedAtUtc] IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_ChannelEraSelectedSeasons_SeriesId_SeasonNumber",
                table: "ChannelEraSelectedSeasons",
                columns: new[] { "SeriesId", "SeasonNumber" });

            migrationBuilder.CreateIndex(
                name: "IX_ChannelEraSelections_ChannelId_ChannelEraId",
                table: "ChannelEraSelections",
                columns: new[] { "ChannelId", "ChannelEraId" });

            migrationBuilder.CreateIndex(
                name: "IX_ChannelEraSeries_SeriesId",
                table: "ChannelEraSeries",
                column: "SeriesId");

            migrationBuilder.CreateIndex(
                name: "IX_ChannelEraSeriesInterludes_InterludeId",
                table: "ChannelEraSeriesInterludes",
                column: "InterludeId");

            migrationBuilder.CreateIndex(
                name: "IX_Channels_Name",
                table: "Channels",
                column: "Name",
                unique: true,
                filter: "[DeletedAtUtc] IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Channels_ShareId",
                table: "Channels",
                column: "ShareId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Comments_Status_CreatedAtUtc",
                table: "Comments",
                columns: new[] { "Status", "CreatedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_Comments_UserId",
                table: "Comments",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_DeviceAuthorizations_ExpiresAtUtc",
                table: "DeviceAuthorizations",
                column: "ExpiresAtUtc");

            migrationBuilder.CreateIndex(
                name: "IX_DeviceAuthorizations_ProfileId",
                table: "DeviceAuthorizations",
                column: "ProfileId");

            migrationBuilder.CreateIndex(
                name: "IX_DeviceAuthorizations_UserCodeHash",
                table: "DeviceAuthorizations",
                column: "UserCodeHash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_EpisodeBreakPoints_EpisodeId_OffsetSeconds",
                table: "EpisodeBreakPoints",
                columns: new[] { "EpisodeId", "OffsetSeconds" },
                unique: true,
                filter: "[DeletedAtUtc] IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Episodes_EpisodeTypeId",
                table: "Episodes",
                column: "EpisodeTypeId");

            migrationBuilder.CreateIndex(
                name: "IX_Episodes_SeriesId_SeasonNumber_EpisodeTypeId_EpisodeNumber",
                table: "Episodes",
                columns: new[] { "SeriesId", "SeasonNumber", "EpisodeTypeId", "EpisodeNumber" },
                unique: true,
                filter: "[DeletedAtUtc] IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_EpisodeTypes_Name",
                table: "EpisodeTypes",
                column: "Name",
                unique: true,
                filter: "[DeletedAtUtc] IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Interludes_Kind_BumperType_Season_ApprovedForBroadcast",
                table: "Interludes",
                columns: new[] { "Kind", "BumperType", "Season", "ApprovedForBroadcast" });

            migrationBuilder.CreateIndex(
                name: "IX_MediaProcessingJobs_SeriesId_Status",
                table: "MediaProcessingJobs",
                columns: new[] { "SeriesId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_MediaProcessingJobs_Worker_Fingerprint",
                table: "MediaProcessingJobs",
                columns: new[] { "Worker", "Fingerprint" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_MediaProcessingJobs_Worker_Status_Id",
                table: "MediaProcessingJobs",
                columns: new[] { "Worker", "Status", "Id" });

            migrationBuilder.CreateIndex(
                name: "IX_Menus_Name",
                table: "Menus",
                column: "Name",
                unique: true,
                filter: "[DeletedAtUtc] IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Menus_ParentId_SortOrder",
                table: "Menus",
                columns: new[] { "ParentId", "SortOrder" });

            migrationBuilder.CreateIndex(
                name: "IX_MetadataImportRuns_SeriesExternalId_StartedAtUtc",
                table: "MetadataImportRuns",
                columns: new[] { "SeriesExternalId", "StartedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_MetadataProviders_Code",
                table: "MetadataProviders",
                column: "Code",
                unique: true,
                filter: "[DeletedAtUtc] IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_PlatformSettings_ViewerRoleId",
                table: "PlatformSettings",
                column: "ViewerRoleId");

            migrationBuilder.CreateIndex(
                name: "IX_RefreshTokens_ExpiresAt",
                table: "RefreshTokens",
                column: "ExpiresAt");

            migrationBuilder.CreateIndex(
                name: "IX_RefreshTokens_ReplacedByTokenId",
                table: "RefreshTokens",
                column: "ReplacedByTokenId");

            migrationBuilder.CreateIndex(
                name: "IX_RefreshTokens_Token",
                table: "RefreshTokens",
                column: "Token",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_RefreshTokens_UserId_RevokedAt",
                table: "RefreshTokens",
                columns: new[] { "UserId", "RevokedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_RoleMenus_MenuId",
                table: "RoleMenus",
                column: "MenuId");

            migrationBuilder.CreateIndex(
                name: "IX_Roles_Name",
                table: "Roles",
                column: "Name",
                unique: true,
                filter: "[DeletedAtUtc] IS NULL");

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
                name: "IX_ScheduledPlaybackSegments_InterludeId",
                table: "ScheduledPlaybackSegments",
                column: "InterludeId");

            migrationBuilder.CreateIndex(
                name: "IX_ScheduledPlaybackSegments_ScheduledAdBreakId_ScheduledProgramId",
                table: "ScheduledPlaybackSegments",
                columns: new[] { "ScheduledAdBreakId", "ScheduledProgramId" });

            migrationBuilder.CreateIndex(
                name: "IX_ScheduledPlaybackSegments_ScheduledProgramId_StartsAtUtc",
                table: "ScheduledPlaybackSegments",
                columns: new[] { "ScheduledProgramId", "StartsAtUtc" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ScheduledPlaybackSegments_StartsAtUtc_EndsAtUtc",
                table: "ScheduledPlaybackSegments",
                columns: new[] { "StartsAtUtc", "EndsAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_ScheduledPrograms_ChannelEraId_GeneratedAtUtc",
                table: "ScheduledPrograms",
                columns: new[] { "ChannelEraId", "GeneratedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_ScheduledPrograms_EpisodeId",
                table: "ScheduledPrograms",
                column: "EpisodeId");

            migrationBuilder.CreateIndex(
                name: "IX_Series_Name",
                table: "Series",
                column: "Name");

            migrationBuilder.CreateIndex(
                name: "IX_SeriesCategories_CategoryId",
                table: "SeriesCategories",
                column: "CategoryId");

            migrationBuilder.CreateIndex(
                name: "IX_SeriesComments_ParentCommentId_SeriesId",
                table: "SeriesComments",
                columns: new[] { "ParentCommentId", "SeriesId" });

            migrationBuilder.CreateIndex(
                name: "IX_SeriesComments_SeriesId",
                table: "SeriesComments",
                column: "SeriesId");

            migrationBuilder.CreateIndex(
                name: "IX_SeriesExternalIds_ProviderId_ExternalId",
                table: "SeriesExternalIds",
                columns: new[] { "ProviderId", "ExternalId" },
                unique: true,
                filter: "[DeletedAtUtc] IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_SeriesExternalIds_SeriesId_ProviderId",
                table: "SeriesExternalIds",
                columns: new[] { "SeriesId", "ProviderId" },
                unique: true,
                filter: "[DeletedAtUtc] IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_UserExternalLogins_UserId_Provider",
                table: "UserExternalLogins",
                columns: new[] { "UserId", "Provider" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Users_RoleId",
                table: "Users",
                column: "RoleId");

            migrationBuilder.CreateIndex(
                name: "IX_Users_Username",
                table: "Users",
                column: "Username",
                unique: true,
                filter: "[DeletedAtUtc] IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_ViewerDevices_ExpiresAtUtc",
                table: "ViewerDevices",
                column: "ExpiresAtUtc");

            migrationBuilder.CreateIndex(
                name: "IX_ViewerDevices_ProfileId",
                table: "ViewerDevices",
                column: "ProfileId");

            migrationBuilder.CreateIndex(
                name: "IX_ViewerDevices_TokenHash",
                table: "ViewerDevices",
                column: "TokenHash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ViewerPairingCodes_DeviceId",
                table: "ViewerPairingCodes",
                column: "DeviceId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ViewerPairingCodes_ExpiresAtUtc",
                table: "ViewerPairingCodes",
                column: "ExpiresAtUtc");

            migrationBuilder.CreateIndex(
                name: "IX_ViewerProfiles_UserId",
                table: "ViewerProfiles",
                column: "UserId",
                unique: true,
                filter: "[UserId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_ViewerProgress_EpisodeId",
                table: "ViewerProgress",
                column: "EpisodeId");

            migrationBuilder.CreateIndex(
                name: "IX_ViewerProgress_ProfileId_UpdatedAtUtc",
                table: "ViewerProgress",
                columns: new[] { "ProfileId", "UpdatedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_ViewerWatchRanges_ProfileId_EpisodeId_StartSecond",
                table: "ViewerWatchRanges",
                columns: new[] { "ProfileId", "EpisodeId", "StartSecond" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ActivityLogs");

            migrationBuilder.DropTable(
                name: "ChannelComments");

            migrationBuilder.DropTable(
                name: "ChannelEraBreakRules");

            migrationBuilder.DropTable(
                name: "ChannelEraInterludes");

            migrationBuilder.DropTable(
                name: "ChannelEraSelectedSeasons");

            migrationBuilder.DropTable(
                name: "ChannelEraSelections");

            migrationBuilder.DropTable(
                name: "ChannelEraSeriesInterludes");

            migrationBuilder.DropTable(
                name: "DeviceAuthorizations");

            migrationBuilder.DropTable(
                name: "MediaProcessingJobs");

            migrationBuilder.DropTable(
                name: "MediaResourcePolicies");

            migrationBuilder.DropTable(
                name: "MetadataImportRuns");

            migrationBuilder.DropTable(
                name: "PlatformSettings");

            migrationBuilder.DropTable(
                name: "RefreshTokens");

            migrationBuilder.DropTable(
                name: "RoleMenus");

            migrationBuilder.DropTable(
                name: "ScheduledPlaybackSegments");

            migrationBuilder.DropTable(
                name: "SeriesCategories");

            migrationBuilder.DropTable(
                name: "SeriesComments");

            migrationBuilder.DropTable(
                name: "UserExternalLogins");

            migrationBuilder.DropTable(
                name: "ViewerPairingCodes");

            migrationBuilder.DropTable(
                name: "ViewerWatchRanges");

            migrationBuilder.DropTable(
                name: "ChannelEraSeries");

            migrationBuilder.DropTable(
                name: "MediaWorkerStates");

            migrationBuilder.DropTable(
                name: "SeriesExternalIds");

            migrationBuilder.DropTable(
                name: "Menus");

            migrationBuilder.DropTable(
                name: "Interludes");

            migrationBuilder.DropTable(
                name: "ScheduledAdBreaks");

            migrationBuilder.DropTable(
                name: "Categories");

            migrationBuilder.DropTable(
                name: "Comments");

            migrationBuilder.DropTable(
                name: "ViewerDevices");

            migrationBuilder.DropTable(
                name: "ViewerProgress");

            migrationBuilder.DropTable(
                name: "MetadataProviders");

            migrationBuilder.DropTable(
                name: "EpisodeBreakPoints");

            migrationBuilder.DropTable(
                name: "ScheduledPrograms");

            migrationBuilder.DropTable(
                name: "ViewerProfiles");

            migrationBuilder.DropTable(
                name: "ChannelEras");

            migrationBuilder.DropTable(
                name: "Episodes");

            migrationBuilder.DropTable(
                name: "Users");

            migrationBuilder.DropTable(
                name: "Channels");

            migrationBuilder.DropTable(
                name: "EpisodeTypes");

            migrationBuilder.DropTable(
                name: "SeriesSeasons");

            migrationBuilder.DropTable(
                name: "Roles");

            migrationBuilder.DropTable(
                name: "Series");
        }
    }
}
