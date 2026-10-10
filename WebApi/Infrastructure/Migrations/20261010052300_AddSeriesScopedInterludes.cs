using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddSeriesScopedInterludes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_ScheduledPlaybackSegments_Content",
                table: "ScheduledPlaybackSegments");

            migrationBuilder.DropCheckConstraint(
                name: "CK_ChannelEraInterludes_Role",
                table: "ChannelEraInterludes");

            migrationBuilder.AddColumn<int>(
                name: "SeriesId",
                table: "ChannelEraInterludes",
                type: "int",
                nullable: true);

            migrationBuilder.AddCheckConstraint(
                name: "CK_ScheduledPlaybackSegments_Content",
                table: "ScheduledPlaybackSegments",
                sql: "([InterludeId] IS NULL AND [ScheduledAdBreakId] IS NULL AND [MediaStartSecond] IS NOT NULL AND [MediaEndSecond] IS NOT NULL AND [MediaStartSecond] >= 0 AND [MediaEndSecond] > [MediaStartSecond]) OR ([InterludeId] IS NOT NULL AND [MediaStartSecond] IS NULL AND [MediaEndSecond] IS NULL)");

            migrationBuilder.CreateIndex(
                name: "IX_ChannelEraInterludes_ChannelEraId_SeriesId",
                table: "ChannelEraInterludes",
                columns: new[] { "ChannelEraId", "SeriesId" });

            migrationBuilder.AddCheckConstraint(
                name: "CK_ChannelEraInterludes_Role",
                table: "ChannelEraInterludes",
                sql: "[Role] IN ('BreakOpener', 'Advertisement', 'BreakCloser', 'ProgramIntro')");

            migrationBuilder.AddForeignKey(
                name: "FK_ChannelEraInterludes_ChannelEraSeries_ChannelEraId_SeriesId",
                table: "ChannelEraInterludes",
                columns: new[] { "ChannelEraId", "SeriesId" },
                principalTable: "ChannelEraSeries",
                principalColumns: new[] { "ChannelErasId", "SeriesId" },
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ChannelEraInterludes_ChannelEraSeries_ChannelEraId_SeriesId",
                table: "ChannelEraInterludes");

            migrationBuilder.DropCheckConstraint(
                name: "CK_ScheduledPlaybackSegments_Content",
                table: "ScheduledPlaybackSegments");

            migrationBuilder.DropIndex(
                name: "IX_ChannelEraInterludes_ChannelEraId_SeriesId",
                table: "ChannelEraInterludes");

            migrationBuilder.DropCheckConstraint(
                name: "CK_ChannelEraInterludes_Role",
                table: "ChannelEraInterludes");

            migrationBuilder.DropColumn(
                name: "SeriesId",
                table: "ChannelEraInterludes");

            migrationBuilder.AddCheckConstraint(
                name: "CK_ScheduledPlaybackSegments_Content",
                table: "ScheduledPlaybackSegments",
                sql: "([InterludeId] IS NULL AND [ScheduledAdBreakId] IS NULL AND [MediaStartSecond] IS NOT NULL AND [MediaEndSecond] IS NOT NULL AND [MediaStartSecond] >= 0 AND [MediaEndSecond] > [MediaStartSecond]) OR ([InterludeId] IS NOT NULL AND [ScheduledAdBreakId] IS NOT NULL AND [MediaStartSecond] IS NULL AND [MediaEndSecond] IS NULL)");

            migrationBuilder.AddCheckConstraint(
                name: "CK_ChannelEraInterludes_Role",
                table: "ChannelEraInterludes",
                sql: "[Role] IN ('BreakOpener', 'Advertisement', 'BreakCloser')");
        }
    }
}
