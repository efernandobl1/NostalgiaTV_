using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddViewingProfilesAndMediaPolicy : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ChannelComments",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ChannelId = table.Column<int>(type: "int", nullable: false),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    Body = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ChannelComments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ChannelComments_Channels_ChannelId",
                        column: x => x.ChannelId,
                        principalTable: "Channels",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ChannelComments_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "MediaResourcePolicies",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    DayCores = table.Column<int>(type: "int", nullable: false),
                    NightCores = table.Column<int>(type: "int", nullable: false),
                    NightEnabled = table.Column<bool>(type: "bit", nullable: false),
                    NightStartMinute = table.Column<int>(type: "int", nullable: false),
                    NightEndMinute = table.Column<int>(type: "int", nullable: false),
                    TimeZoneId = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    AvailableCores = table.Column<int>(type: "int", nullable: false),
                    AppliedCores = table.Column<int>(type: "int", nullable: false),
                    AppliedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MediaResourcePolicies", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ViewerProfiles",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ViewerProfiles", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ViewerDevices",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ProfileId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TokenHash = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    Name = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    ExpiresAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    LastSeenUtc = table.Column<DateTime>(type: "datetime2", nullable: false)
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
                name: "ViewerProgress",
                columns: table => new
                {
                    ProfileId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EpisodeId = table.Column<int>(type: "int", nullable: false),
                    CurrentSecond = table.Column<double>(type: "float", nullable: false),
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
                        onDelete: ReferentialAction.Cascade);
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
                name: "ViewerWatchRanges",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ProfileId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EpisodeId = table.Column<int>(type: "int", nullable: false),
                    StartSecond = table.Column<double>(type: "float", nullable: false),
                    EndSecond = table.Column<double>(type: "float", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ViewerWatchRanges", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ViewerWatchRanges_ViewerProgress_ProfileId_EpisodeId",
                        columns: x => new { x.ProfileId, x.EpisodeId },
                        principalTable: "ViewerProgress",
                        principalColumns: new[] { "ProfileId", "EpisodeId" },
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.InsertData(
                table: "MediaResourcePolicies",
                columns: new[] { "Id", "AppliedAtUtc", "AppliedCores", "AvailableCores", "DayCores", "NightCores", "NightEnabled", "NightEndMinute", "NightStartMinute", "TimeZoneId" },
                values: new object[] { 1, null, 0, 0, 1, 3, true, 300, 0, "America/Guatemala" });

            migrationBuilder.CreateIndex(
                name: "IX_ChannelComments_ChannelId_Status_CreatedAtUtc",
                table: "ChannelComments",
                columns: new[] { "ChannelId", "Status", "CreatedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_ChannelComments_UserId",
                table: "ChannelComments",
                column: "UserId");

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
                name: "IX_ViewerProgress_EpisodeId",
                table: "ViewerProgress",
                column: "EpisodeId");

            migrationBuilder.CreateIndex(
                name: "IX_ViewerWatchRanges_ProfileId_EpisodeId_StartSecond",
                table: "ViewerWatchRanges",
                columns: new[] { "ProfileId", "EpisodeId", "StartSecond" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ChannelComments");

            migrationBuilder.DropTable(
                name: "MediaResourcePolicies");

            migrationBuilder.DropTable(
                name: "ViewerPairingCodes");

            migrationBuilder.DropTable(
                name: "ViewerWatchRanges");

            migrationBuilder.DropTable(
                name: "ViewerDevices");

            migrationBuilder.DropTable(
                name: "ViewerProgress");

            migrationBuilder.DropTable(
                name: "ViewerProfiles");
        }
    }
}
