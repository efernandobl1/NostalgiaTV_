namespace ApplicationCore.Entities;

/// <summary>Rows that are hidden instead of removed (DeletedAtUtc NULL = active).</summary>
public interface ISoftDeletable
{
    DateTime? DeletedAtUtc { get; set; }
}
