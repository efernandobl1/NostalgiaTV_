using System.Security.Cryptography;
using System.Text;
using Konscious.Security.Cryptography;

namespace Infrastructure.Security;

/// <summary>Argon2id password hashes stored as "salt:hash" (base64).</summary>
public static class PasswordHasher
{
    private static readonly Lazy<string> Dummy = new(() => Hash(Convert.ToHexString(RandomNumberGenerator.GetBytes(32))));

    /// <summary>Verifying against this keeps unknown usernames as slow as wrong passwords.</summary>
    public static string DummyHash => Dummy.Value;

    public static string Hash(string password)
    {
        var salt = RandomNumberGenerator.GetBytes(16);
        return $"{Convert.ToBase64String(salt)}:{Convert.ToBase64String(Derive(password, salt))}";
    }

    public static bool Verify(string password, string storedHash)
    {
        try
        {
            var parts = storedHash.Split(':');
            if (parts.Length != 2) return false;
            var salt = Convert.FromBase64String(parts[0]);
            var expected = Convert.FromBase64String(parts[1]);
            return salt.Length == 16 && expected.Length == 32 && CryptographicOperations.FixedTimeEquals(Derive(password, salt), expected);
        }
        catch (FormatException) { return false; }
    }

    /// <summary>Accounts created through an external provider have no usable password.</summary>
    public static bool IsUsable(string storedHash) => storedHash.Contains(':');

    private static byte[] Derive(string password, byte[] salt)
    {
        using var argon2 = new Argon2id(Encoding.UTF8.GetBytes(password))
        {
            Salt = salt,
            Iterations = 4,
            MemorySize = 65536,
            DegreeOfParallelism = 2
        };
        return argon2.GetBytes(32);
    }
}

/// <summary>Random bearer secrets (refresh tokens, device tokens, codes) are stored only as SHA-256 digests.</summary>
public static class Secrets
{
    public const string CodeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    public static string Hash(string value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value)));

    public static string NewToken(int bytes = 32) => Convert.ToHexString(RandomNumberGenerator.GetBytes(bytes));

    /// <summary>12 unambiguous characters shown as XXX-XXX-XXX-XXX.</summary>
    public static string NewUserCode() =>
        new(Enumerable.Range(0, 12).Select(_ => CodeAlphabet[RandomNumberGenerator.GetInt32(CodeAlphabet.Length)]).ToArray());

    public static string FormatUserCode(string code) => string.Join('-', Enumerable.Range(0, 4).Select(index => code.Substring(index * 3, 3)));

    public static string? NormalizeUserCode(string? value)
    {
        if (value == null || value.Length > 32) return null;
        var code = value.Replace("-", "").Replace(" ", "").ToUpperInvariant();
        return code.Length == 12 && code.All(CodeAlphabet.Contains) ? code : null;
    }

    public static string SafeName(string? value, string fallback = "Dispositivo")
    {
        var name = new string((value ?? "").Where(character => !char.IsControl(character)).ToArray()).Trim();
        return name.Length == 0 ? fallback : name[..Math.Min(80, name.Length)].Trim();
    }
}
