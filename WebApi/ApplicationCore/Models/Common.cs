namespace ApplicationCore.Models;

public sealed record PagedResult<T>(IReadOnlyList<T> Items, int TotalCount, int Page, int PageSize)
{
    public int TotalPages => PageSize <= 0 ? 0 : (int)Math.Ceiling((double)TotalCount / PageSize);
}

/// <summary>An uploaded file without ASP.NET types, so repositories stay framework-agnostic.</summary>
public sealed record FileUpload(string FileName, long Length, string? ContentType, Func<Stream> OpenReadStream);

public sealed record IdName(int Id, string Name);
