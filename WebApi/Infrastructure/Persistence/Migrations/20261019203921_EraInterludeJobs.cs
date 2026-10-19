using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class EraInterludeJobs : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<int>(
                name: "SeriesId",
                table: "MediaProcessingJobs",
                type: "int",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "int");

            migrationBuilder.AddColumn<int>(
                name: "ChannelEraId",
                table: "MediaProcessingJobs",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_MediaProcessingJobs_ChannelEraId_Status",
                table: "MediaProcessingJobs",
                columns: new[] { "ChannelEraId", "Status" });

            migrationBuilder.AddCheckConstraint(
                name: "CK_MediaProcessingJobs_Owner",
                table: "MediaProcessingJobs",
                sql: "([SeriesId] IS NULL AND [ChannelEraId] IS NOT NULL) OR ([SeriesId] IS NOT NULL AND [ChannelEraId] IS NULL)");

            migrationBuilder.AddForeignKey(
                name: "FK_MediaProcessingJobs_ChannelEras_ChannelEraId",
                table: "MediaProcessingJobs",
                column: "ChannelEraId",
                principalTable: "ChannelEras",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_MediaProcessingJobs_ChannelEras_ChannelEraId",
                table: "MediaProcessingJobs");

            migrationBuilder.DropIndex(
                name: "IX_MediaProcessingJobs_ChannelEraId_Status",
                table: "MediaProcessingJobs");

            migrationBuilder.DropCheckConstraint(
                name: "CK_MediaProcessingJobs_Owner",
                table: "MediaProcessingJobs");

            migrationBuilder.DropColumn(
                name: "ChannelEraId",
                table: "MediaProcessingJobs");

            migrationBuilder.AlterColumn<int>(
                name: "SeriesId",
                table: "MediaProcessingJobs",
                type: "int",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "int",
                oldNullable: true);
        }
    }
}
