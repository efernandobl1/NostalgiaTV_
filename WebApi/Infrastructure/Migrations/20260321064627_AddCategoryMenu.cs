using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddCategoryMenu : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.InsertData(
                table: "Menus",
                columns: new[] { "Id", "Caption", "Icon", "IsVisible", "Name", "ParentId", "SortOrder", "Url" },
                values: new object[] { 8, "Categorías", "category", true, "Categories", 1, 4, "/dashboard/categories" });

            migrationBuilder.InsertData(
                table: "MenuRol",
                columns: new[] { "MenusId", "RolesId" },
                values: new object[] { 8, 1 });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                table: "MenuRol",
                keyColumns: new[] { "MenusId", "RolesId" },
                keyValues: new object[] { 8, 1 });

            migrationBuilder.DeleteData(
                table: "Menus",
                keyColumn: "Id",
                keyValue: 8);
        }
    }
}
