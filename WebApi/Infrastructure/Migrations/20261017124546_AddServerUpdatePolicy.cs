using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddServerUpdatePolicy : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "AutomaticUpdatesEnabled",
                table: "PlatformSettings",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "UpdateHour",
                table: "PlatformSettings",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.UpdateData(
                table: "PlatformSettings",
                keyColumn: "Id",
                keyValue: 1,
                columns: new[] { "AutomaticUpdatesEnabled", "UpdateHour" },
                values: new object[] { false, 3 });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AutomaticUpdatesEnabled",
                table: "PlatformSettings");

            migrationBuilder.DropColumn(
                name: "UpdateHour",
                table: "PlatformSettings");
        }
    }
}
