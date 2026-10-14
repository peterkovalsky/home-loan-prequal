namespace HomeLoan.Application.Common;

/// <summary>
/// A SQL Server <c>rowversion</c>, exposed to clients as a quoted hex ETag (<c>"00000000000007D3"</c>).
/// </summary>
public sealed class ConcurrencyToken : IEquatable<ConcurrencyToken>
{
    private readonly byte[] bytes;

    public ConcurrencyToken(byte[] rowVersion)
    {
        ArgumentNullException.ThrowIfNull(rowVersion);
        if (rowVersion.Length != 8)
        {
            throw new ArgumentException("A rowversion is 8 bytes.", nameof(rowVersion));
        }
        bytes = (byte[])rowVersion.Clone();
    }

    public byte[] ToRowVersion() => (byte[])bytes.Clone();

    public string ToETag() => $"\"{Convert.ToHexString(bytes)}\"";

    /// <summary>Parses one strong ETag. Weak (<c>W/</c>), lists and <c>*</c> are not accepted.</summary>
    public static ConcurrencyToken? FromETag(string? etag)
    {
        if (etag is not { Length: 18 } || etag[0] != '"' || etag[^1] != '"')
        {
            return null;
        }
        try
        {
            return new ConcurrencyToken(Convert.FromHexString(etag.AsSpan(1, 16)));
        }
        catch (FormatException)
        {
            return null;
        }
    }

    public bool Equals(ConcurrencyToken? other) => other is not null && bytes.AsSpan().SequenceEqual(other.bytes);

    public override bool Equals(object? obj) => Equals(obj as ConcurrencyToken);

    public override int GetHashCode() => BitConverter.ToInt32(bytes, 4);

    public override string ToString() => ToETag();
}

/// <summary>A resource with its current version.</summary>
public sealed record Versioned<T>(T Value, ConcurrencyToken Version);

/// <summary>The outcome of a successful PUT.</summary>
public sealed record Saved<T>(T Value, ConcurrencyToken Version, bool Created);
