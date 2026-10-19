namespace ApplicationCore.Entities;

public class Role : ISoftDeletable
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string Description { get; set; } = "";
    public DateTime? DeletedAtUtc { get; set; }

    public ICollection<RoleMenu> Menus { get; set; } = [];
}

public class Menu : ISoftDeletable
{
    public int Id { get; set; }
    public int? ParentId { get; set; }
    public string Name { get; set; } = "";
    public string Caption { get; set; } = "";
    public string Icon { get; set; } = "";
    public string Url { get; set; } = "";
    public int SortOrder { get; set; }
    public bool IsVisible { get; set; }
    public DateTime? DeletedAtUtc { get; set; }

    public Menu? Parent { get; set; }
}

public class RoleMenu
{
    public int RoleId { get; set; }
    public int MenuId { get; set; }

    public Role Role { get; set; } = null!;
    public Menu Menu { get; set; } = null!;
}

public class User : ISoftDeletable
{
    public int Id { get; set; }
    public int RoleId { get; set; }
    public string Username { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public int FailedLoginAttempts { get; set; }
    public DateTime? LockedUntilUtc { get; set; }
    public int SessionVersion { get; set; }
    public DateTime? DeletedAtUtc { get; set; }

    public Role Role { get; set; } = null!;
    public ICollection<UserExternalLogin> ExternalLogins { get; set; } = [];
}

public class UserExternalLogin
{
    public string Provider { get; set; } = "";
    public string Subject { get; set; } = "";
    public int UserId { get; set; }
    public DateTime CreatedAtUtc { get; set; }

    public User User { get; set; } = null!;
}

public class RefreshToken
{
    public int Id { get; set; }
    public int UserId { get; set; }
    /// <summary>SHA-256 digest; the credential itself only travels in an HttpOnly cookie.</summary>
    public string Token { get; set; } = "";
    public int? ReplacedByTokenId { get; set; }
    public string IpAddress { get; set; } = "";
    public bool IsPersistent { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime ExpiresAt { get; set; }
    public DateTime? RevokedAt { get; set; }

    public User User { get; set; } = null!;
}

public class ActivityLog
{
    public long Id { get; set; }
    public int? UserId { get; set; }
    public string Action { get; set; } = "";
    public string Resource { get; set; } = "";
    public string Description { get; set; } = "";
    public DateTime CreatedAtUtc { get; set; }

    public User? User { get; set; }
}
