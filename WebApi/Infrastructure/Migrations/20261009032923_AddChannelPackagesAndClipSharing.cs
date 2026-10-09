using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddChannelPackagesAndClipSharing : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "License",
                table: "Interludes",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "RedistributionAllowed",
                table: "Interludes",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "SourceUrl",
                table: "Interludes",
                type: "nvarchar(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ShareId",
                table: "Channels",
                type: "uniqueidentifier",
                nullable: false,
                defaultValueSql: "NEWID()");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Interludes_Redistribution",
                table: "Interludes",
                sql: "[RedistributionAllowed] = 0 OR LEN(LTRIM(RTRIM([License]))) > 0 AND [License] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Channels_ShareId",
                table: "Channels",
                column: "ShareId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_Interludes_Redistribution",
                table: "Interludes");

            migrationBuilder.DropIndex(
                name: "IX_Channels_ShareId",
                table: "Channels");

            migrationBuilder.DropColumn(
                name: "License",
                table: "Interludes");

            migrationBuilder.DropColumn(
                name: "RedistributionAllowed",
                table: "Interludes");

            migrationBuilder.DropColumn(
                name: "SourceUrl",
                table: "Interludes");

            migrationBuilder.DropColumn(
                name: "ShareId",
                table: "Channels");
        }
    }
}
