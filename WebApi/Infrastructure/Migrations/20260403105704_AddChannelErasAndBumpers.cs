using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddChannelErasAndBumpers : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ChannelScheduleEntries_Episodes_EpisodeId",
                table: "ChannelScheduleEntries");

            migrationBuilder.AlterColumn<int>(
                name: "EpisodeId",
                table: "ChannelScheduleEntries",
                type: "int",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "int");

            migrationBuilder.AddColumn<int>(
                name: "BumperId",
                table: "ChannelScheduleEntries",
                type: "int",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "ChannelEras",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ChannelId = table.Column<int>(type: "int", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Description = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    StartDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    EndDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    FolderPath = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ChannelEras", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ChannelEras_Channels_ChannelId",
                        column: x => x.ChannelId,
                        principalTable: "Channels",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ChannelBumpers",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ChannelEraId = table.Column<int>(type: "int", nullable: false),
                    Title = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    FilePath = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Order = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ChannelBumpers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ChannelBumpers_ChannelEras_ChannelEraId",
                        column: x => x.ChannelEraId,
                        principalTable: "ChannelEras",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ChannelEraSeries",
                columns: table => new
                {
                    ChannelErasId = table.Column<int>(type: "int", nullable: false),
                    SeriesId = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ChannelEraSeries", x => new { x.ChannelErasId, x.SeriesId });
                    table.ForeignKey(
                        name: "FK_ChannelEraSeries_ChannelEras_ChannelErasId",
                        column: x => x.ChannelErasId,
                        principalTable: "ChannelEras",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ChannelEraSeries_Series_SeriesId",
                        column: x => x.SeriesId,
                        principalTable: "Series",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ChannelScheduleEntries_BumperId",
                table: "ChannelScheduleEntries",
                column: "BumperId");

            migrationBuilder.CreateIndex(
                name: "IX_ChannelBumpers_ChannelEraId",
                table: "ChannelBumpers",
                column: "ChannelEraId");

            migrationBuilder.CreateIndex(
                name: "IX_ChannelEras_ChannelId",
                table: "ChannelEras",
                column: "ChannelId");

            migrationBuilder.CreateIndex(
                name: "IX_ChannelEraSeries_SeriesId",
                table: "ChannelEraSeries",
                column: "SeriesId");

            migrationBuilder.AddForeignKey(
                name: "FK_ChannelScheduleEntries_ChannelBumpers_BumperId",
                table: "ChannelScheduleEntries",
                column: "BumperId",
                principalTable: "ChannelBumpers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_ChannelScheduleEntries_Episodes_EpisodeId",
                table: "ChannelScheduleEntries",
                column: "EpisodeId",
                principalTable: "Episodes",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ChannelScheduleEntries_ChannelBumpers_BumperId",
                table: "ChannelScheduleEntries");

            migrationBuilder.DropForeignKey(
                name: "FK_ChannelScheduleEntries_Episodes_EpisodeId",
                table: "ChannelScheduleEntries");

            migrationBuilder.DropTable(
                name: "ChannelBumpers");

            migrationBuilder.DropTable(
                name: "ChannelEraSeries");

            migrationBuilder.DropTable(
                name: "ChannelEras");

            migrationBuilder.DropIndex(
                name: "IX_ChannelScheduleEntries_BumperId",
                table: "ChannelScheduleEntries");

            migrationBuilder.DropColumn(
                name: "BumperId",
                table: "ChannelScheduleEntries");

            migrationBuilder.AlterColumn<int>(
                name: "EpisodeId",
                table: "ChannelScheduleEntries",
                type: "int",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "int",
                oldNullable: true);

            migrationBuilder.AddForeignKey(
                name: "FK_ChannelScheduleEntries_Episodes_EpisodeId",
                table: "ChannelScheduleEntries",
                column: "EpisodeId",
                principalTable: "Episodes",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
