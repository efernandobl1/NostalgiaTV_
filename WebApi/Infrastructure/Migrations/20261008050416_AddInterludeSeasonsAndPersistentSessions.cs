using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddInterludeSeasonsAndPersistentSessions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsPersistent",
                table: "RefreshTokens",
                type: "bit",
                nullable: false,
                defaultValue: false);

            // Existing remembered logins used a 30-day token instead of seven days.
            migrationBuilder.Sql("UPDATE [RefreshTokens] SET [IsPersistent] = 1 WHERE [ExpiresAt] >= DATEADD(day, 29, [CreatedAt])");

            migrationBuilder.AddColumn<string>(
                name: "Season",
                table: "Interludes",
                type: "nvarchar(30)",
                maxLength: 30,
                nullable: false,
                defaultValue: "AllYear");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Interludes_Season",
                table: "Interludes",
                sql: "[Season] IN ('AllYear', 'Halloween', 'Christmas')");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_Interludes_Season",
                table: "Interludes");

            migrationBuilder.DropColumn(
                name: "IsPersistent",
                table: "RefreshTokens");

            migrationBuilder.DropColumn(
                name: "Season",
                table: "Interludes");
        }
    }
}
