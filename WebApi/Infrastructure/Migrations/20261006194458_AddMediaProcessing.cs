using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddMediaProcessing : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
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
                    OutputPath = table.Column<string>(type: "nvarchar(2048)", maxLength: 2048, nullable: true),
                    SourceSize = table.Column<long>(type: "bigint", nullable: false),
                    SourceModifiedUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Progress = table.Column<double>(type: "float", nullable: false),
                    Message = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MediaProcessingJobs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MediaProcessingJobs_Series_SeriesId",
                        column: x => x.SeriesId,
                        principalTable: "Series",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
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

            migrationBuilder.AddForeignKey(
                name: "FK_MediaProcessingJobs_MediaWorkerStates_Worker",
                table: "MediaProcessingJobs",
                column: "Worker",
                principalTable: "MediaWorkerStates",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

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
                columns: new[] { "Id", "Caption", "Icon", "IsVisible", "Name", "ParentId", "SortOrder", "Url" },
                values: new object[] { 11, "Transcodificación", "video_settings", true, "Transcoding", 1, 7, "/dashboard/transcoding" });

            migrationBuilder.InsertData(
                table: "MenuRol",
                columns: new[] { "MenusId", "RolesId" },
                values: new object[] { 11, 1 });

            migrationBuilder.CreateIndex(
                name: "IX_MediaProcessingJobs_SeriesId",
                table: "MediaProcessingJobs",
                column: "SeriesId");

            migrationBuilder.CreateIndex(
                name: "IX_MediaProcessingJobs_Worker_Fingerprint",
                table: "MediaProcessingJobs",
                columns: new[] { "Worker", "Fingerprint" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_MediaProcessingJobs_Worker_Status_Id",
                table: "MediaProcessingJobs",
                columns: new[] { "Worker", "Status", "Id" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "MediaProcessingJobs");

            migrationBuilder.DropTable(
                name: "MediaWorkerStates");

            migrationBuilder.DeleteData(
                table: "MenuRol",
                keyColumns: new[] { "MenusId", "RolesId" },
                keyValues: new object[] { 11, 1 });

            migrationBuilder.DeleteData(
                table: "Menus",
                keyColumn: "Id",
                keyValue: 11);
        }
    }
}
