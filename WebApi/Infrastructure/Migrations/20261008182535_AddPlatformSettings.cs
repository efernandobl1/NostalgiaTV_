using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddPlatformSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "PlatformSettings",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false),
                    SeasonalThemesEnabled = table.Column<bool>(type: "bit", nullable: false),
                    SeasonalEffectsEnabled = table.Column<bool>(type: "bit", nullable: false),
                    SeasonalEpisodesEnabled = table.Column<bool>(type: "bit", nullable: false),
                    SeasonalInterludesEnabled = table.Column<bool>(type: "bit", nullable: false),
                    TimeZoneId = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    NoRepeatWindowHours = table.Column<int>(type: "int", nullable: false),
                    MaxSpecialsPerSeriesPerDay = table.Column<int>(type: "int", nullable: false),
                    MaxSpecialsPerDay = table.Column<int>(type: "int", nullable: false),
                    MaxMoviesPerSeriesPerDay = table.Column<int>(type: "int", nullable: false),
                    MaxMoviesPerDay = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PlatformSettings", x => x.Id);
                    table.CheckConstraint("CK_PlatformSettings_Limits", "[NoRepeatWindowHours] BETWEEN 0 AND 72 AND [MaxSpecialsPerDay] BETWEEN 0 AND 50 AND [MaxSpecialsPerSeriesPerDay] BETWEEN 0 AND [MaxSpecialsPerDay] AND [MaxMoviesPerDay] BETWEEN 0 AND 20 AND [MaxMoviesPerSeriesPerDay] BETWEEN 0 AND [MaxMoviesPerDay]");
                    table.CheckConstraint("CK_PlatformSettings_Singleton", "[Id] = 1");
                });

            migrationBuilder.InsertData(
                table: "Menus",
                columns: new[] { "Id", "Caption", "Icon", "IsVisible", "Name", "ParentId", "SortOrder", "Url" },
                values: new object[] { 12, "Configuración", "settings", true, "Settings", 2, 3, "/dashboard/settings" });

            migrationBuilder.InsertData(
                table: "PlatformSettings",
                columns: new[] { "Id", "MaxMoviesPerDay", "MaxMoviesPerSeriesPerDay", "MaxSpecialsPerDay", "MaxSpecialsPerSeriesPerDay", "NoRepeatWindowHours", "SeasonalEffectsEnabled", "SeasonalEpisodesEnabled", "SeasonalInterludesEnabled", "SeasonalThemesEnabled", "TimeZoneId" },
                values: new object[] { 1, 2, 2, 5, 2, 24, true, true, true, true, "America/Guatemala" });

            migrationBuilder.InsertData(
                table: "MenuRol",
                columns: new[] { "MenusId", "RolesId" },
                values: new object[] { 12, 1 });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PlatformSettings");

            migrationBuilder.DeleteData(
                table: "MenuRol",
                keyColumns: new[] { "MenusId", "RolesId" },
                keyValues: new object[] { 12, 1 });

            migrationBuilder.DeleteData(
                table: "Menus",
                keyColumn: "Id",
                keyValue: 12);
        }
    }
}
