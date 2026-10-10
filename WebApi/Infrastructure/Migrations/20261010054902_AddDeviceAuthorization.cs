using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddDeviceAuthorization : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "UserId",
                table: "ViewerProfiles",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "SessionVersion",
                table: "ViewerDevices",
                type: "int",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "DeviceAuthorizations",
                columns: table => new
                {
                    DeviceCodeHash = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    UserCodeHash = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    Name = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    ExpiresAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    LastPolledAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ProfileId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    SessionVersion = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DeviceAuthorizations", x => x.DeviceCodeHash);
                    table.ForeignKey(
                        name: "FK_DeviceAuthorizations_ViewerProfiles_ProfileId",
                        column: x => x.ProfileId,
                        principalTable: "ViewerProfiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ViewerProfiles_UserId",
                table: "ViewerProfiles",
                column: "UserId",
                unique: true,
                filter: "[UserId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_DeviceAuthorizations_ExpiresAtUtc",
                table: "DeviceAuthorizations",
                column: "ExpiresAtUtc");

            migrationBuilder.CreateIndex(
                name: "IX_DeviceAuthorizations_ProfileId",
                table: "DeviceAuthorizations",
                column: "ProfileId");

            migrationBuilder.CreateIndex(
                name: "IX_DeviceAuthorizations_UserCodeHash",
                table: "DeviceAuthorizations",
                column: "UserCodeHash",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_ViewerProfiles_Users_UserId",
                table: "ViewerProfiles",
                column: "UserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ViewerProfiles_Users_UserId",
                table: "ViewerProfiles");

            migrationBuilder.DropTable(
                name: "DeviceAuthorizations");

            migrationBuilder.DropIndex(
                name: "IX_ViewerProfiles_UserId",
                table: "ViewerProfiles");

            migrationBuilder.DropColumn(
                name: "UserId",
                table: "ViewerProfiles");

            migrationBuilder.DropColumn(
                name: "SessionVersion",
                table: "ViewerDevices");
        }
    }
}
