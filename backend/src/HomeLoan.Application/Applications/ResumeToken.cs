using System.Security.Cryptography;
using System.Text;

namespace HomeLoan.Application.Applications;

/// <summary>
/// The secret that lets one browser (and only it) reach its application: 256 random bits,
/// base64url-encoded (43 characters). Only its SHA-256 hash is stored, so a database leak doesn't
/// hand out working tokens.
/// </summary>
public sealed class ResumeToken
{
    private const int Bytes = 32;
    private const int EncodedLength = 43;

    private ResumeToken(string value) => Value = value;

    public string Value { get; }

    public static ResumeToken New()
    {
        var encoded = Convert.ToBase64String(RandomNumberGenerator.GetBytes(Bytes))
            .TrimEnd('=').Replace('+', '-').Replace('/', '_');
        return new ResumeToken(encoded);
    }

    public byte[] Hash() => HashOf(Value);

    /// <summary>The hash of a token presented by a client, or null if it isn't a well-formed token.</summary>
    public static byte[]? TryHash(string? candidate) =>
        candidate is { Length: EncodedLength } && candidate.All(IsBase64UrlChar) ? HashOf(candidate) : null;

    private static byte[] HashOf(string value) => SHA256.HashData(Encoding.ASCII.GetBytes(value));

    private static bool IsBase64UrlChar(char c) => char.IsAsciiLetterOrDigit(c) || c is '-' or '_';
}
