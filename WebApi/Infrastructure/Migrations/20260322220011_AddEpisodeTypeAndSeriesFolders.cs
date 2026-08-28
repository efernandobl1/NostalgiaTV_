using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddEpisodeTypeAndSeriesFolders : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "FolderPath",
                table: "Series",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Seasons",
                table: "Series",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AlterColumn<string>(
                name: "FilePath",
                table: "Episodes",
                type: "nvarchar(max)",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)");

            migrationBuilder.AddColumn<int>(
                name: "EpisodeTypeId",
                table: "Episodes",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "Season",
                table: "Episodes",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateTable(
                name: "EpisodeTypes",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(max)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EpisodeTypes", x => x.Id);
                });

            migrationBuilder.InsertData(
            table: "EpisodeTypes",
            columns: new[] { "Id", "Name" },
            values: new object[,]
            {
                { 1, "Regular" },
                { 2, "Special" },
                { 3, "Christmas Special" },
                { 4, "Halloween Special" },
                { 5, "Movie" }
            });

            // Fix existing episodes with invalid EpisodeTypeId
            migrationBuilder.Sql("UPDATE Episodes SET EpisodeTypeId = 1 WHERE EpisodeTypeId = 0");

            migrationBuilder.CreateIndex(
                            name: "IX_Episodes_EpisodeTypeId",
                table: "Episodes",
                column: "EpisodeTypeId");

            migrationBuilder.AddForeignKey(
                name: "FK_Episodes_EpisodeTypes_EpisodeTypeId",
                table: "Episodes",
                column: "EpisodeTypeId",
                principalTable: "EpisodeTypes",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Episodes_EpisodeTypes_EpisodeTypeId",
                table: "Episodes");

            migrationBuilder.DropTable(
                name: "EpisodeTypes");

            migrationBuilder.DropIndex(
                name: "IX_Episodes_EpisodeTypeId",
                table: "Episodes");

            migrationBuilder.DropColumn(
                name: "FolderPath",
                table: "Series");

            migrationBuilder.DropColumn(
                name: "Seasons",
                table: "Series");

            migrationBuilder.DropColumn(
                name: "EpisodeTypeId",
                table: "Episodes");

            migrationBuilder.DropColumn(
                name: "Season",
                table: "Episodes");

            migrationBuilder.AlterColumn<string>(
                name: "FilePath",
                table: "Episodes",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "nvarchar(max)",
                oldNullable: true);
        }
    }
}
