using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class UpdateMenuHierarchy : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.UpdateData(
                table: "Menus",
                keyColumn: "Id",
                keyValue: 1,
                columns: new[] { "Caption", "Name", "Url" },
                values: new object[] { "CONTENIDO", "Contenido", "" });

            migrationBuilder.UpdateData(
                table: "Menus",
                keyColumn: "Id",
                keyValue: 2,
                columns: new[] { "Caption", "Icon", "Name", "Url" },
                values: new object[] { "SEGURIDAD", "security", "Seguridad", "" });

            migrationBuilder.UpdateData(
                table: "Menus",
                keyColumn: "Id",
                keyValue: 3,
                columns: new[] { "Caption", "Icon", "Name", "ParentId", "SortOrder", "Url" },
                values: new object[] { "Series", "movie", "Series", 1, 1, "/dashboard/series" });

            migrationBuilder.UpdateData(
                table: "Menus",
                keyColumn: "Id",
                keyValue: 4,
                columns: new[] { "Caption", "Icon", "Name", "ParentId", "SortOrder", "Url" },
                values: new object[] { "Episodios", "video_library", "Episodes", 1, 2, "/dashboard/episodes" });

            migrationBuilder.UpdateData(
                table: "Menus",
                keyColumn: "Id",
                keyValue: 5,
                columns: new[] { "Caption", "Icon", "Name", "ParentId", "SortOrder", "Url" },
                values: new object[] { "Canales", "live_tv", "Channels", 1, 3, "/dashboard/channels" });

            migrationBuilder.InsertData(
                table: "Menus",
                columns: new[] { "Id", "Caption", "Icon", "IsVisible", "Name", "ParentId", "SortOrder", "Url" },
                values: new object[,]
                {
                    { 6, "Roles", "admin_panel_settings", true, "Roles", 2, 1, "/dashboard/roles" },
                    { 7, "Usuarios", "people", true, "Users", 2, 2, "/dashboard/users" }
                });

            migrationBuilder.InsertData(
                table: "MenuRol",
                columns: new[] { "MenusId", "RolesId" },
                values: new object[,]
                {
                    { 6, 1 },
                    { 7, 1 }
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                table: "MenuRol",
                keyColumns: new[] { "MenusId", "RolesId" },
                keyValues: new object[] { 6, 1 });

            migrationBuilder.DeleteData(
                table: "MenuRol",
                keyColumns: new[] { "MenusId", "RolesId" },
                keyValues: new object[] { 7, 1 });

            migrationBuilder.DeleteData(
                table: "Menus",
                keyColumn: "Id",
                keyValue: 6);

            migrationBuilder.DeleteData(
                table: "Menus",
                keyColumn: "Id",
                keyValue: 7);

            migrationBuilder.UpdateData(
                table: "Menus",
                keyColumn: "Id",
                keyValue: 1,
                columns: new[] { "Caption", "Name", "Url" },
                values: new object[] { "Series", "Series", "/dashboard/series" });

            migrationBuilder.UpdateData(
                table: "Menus",
                keyColumn: "Id",
                keyValue: 2,
                columns: new[] { "Caption", "Icon", "Name", "Url" },
                values: new object[] { "Episodios", "video_library", "Episodes", "/dashboard/episodes" });

            migrationBuilder.UpdateData(
                table: "Menus",
                keyColumn: "Id",
                keyValue: 3,
                columns: new[] { "Caption", "Icon", "Name", "ParentId", "SortOrder", "Url" },
                values: new object[] { "Canales", "live_tv", "Channels", null, 3, "/dashboard/channels" });

            migrationBuilder.UpdateData(
                table: "Menus",
                keyColumn: "Id",
                keyValue: 4,
                columns: new[] { "Caption", "Icon", "Name", "ParentId", "SortOrder", "Url" },
                values: new object[] { "Roles", "admin_panel_settings", "Roles", null, 4, "/dashboard/roles" });

            migrationBuilder.UpdateData(
                table: "Menus",
                keyColumn: "Id",
                keyValue: 5,
                columns: new[] { "Caption", "Icon", "Name", "ParentId", "SortOrder", "Url" },
                values: new object[] { "Usuarios", "people", "Users", null, 5, "/dashboard/users" });
        }
    }
}
