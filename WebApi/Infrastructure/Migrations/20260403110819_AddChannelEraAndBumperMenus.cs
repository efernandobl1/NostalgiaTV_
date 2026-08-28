using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddChannelEraAndBumperMenus : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.InsertData(
                table: "Menus",
                columns: new[] { "Id", "Caption", "Icon", "IsVisible", "Name", "ParentId", "SortOrder", "Url" },
                values: new object[,]
                {
                    { 9, "Eras", "history_edu", true, "Channel Eras", 1, 5, "/dashboard/channel-eras" },
                    { 10, "Bumpers", "movie_filter", true, "Channel Bumpers", 1, 6, "/dashboard/channel-bumpers" }
                });

            migrationBuilder.InsertData(
                table: "MenuRol",
                columns: new[] { "MenusId", "RolesId" },
                values: new object[,]
                {
                    { 9, 1 },
                    { 10, 1 }
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                table: "MenuRol",
                keyColumns: new[] { "MenusId", "RolesId" },
                keyValues: new object[] { 9, 1 });

            migrationBuilder.DeleteData(
                table: "MenuRol",
                keyColumns: new[] { "MenusId", "RolesId" },
                keyValues: new object[] { 10, 1 });

            migrationBuilder.DeleteData(
                table: "Menus",
                keyColumn: "Id",
                keyValue: 9);

            migrationBuilder.DeleteData(
                table: "Menus",
                keyColumn: "Id",
                keyValue: 10);
        }
    }
}
