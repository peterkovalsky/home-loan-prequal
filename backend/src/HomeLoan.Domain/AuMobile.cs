using System.Text.RegularExpressions;

namespace HomeLoan.Domain;

/// <summary>Australian mobile numbers, stored as <c>04XXXXXXXX</c>.</summary>
public static partial class AuMobile
{
    /// <summary>
    /// Accepts the ways people type a mobile (<c>0412 345 678</c>, <c>+61 412 345 678</c>,
    /// <c>61412345678</c>, <c>(04) 1234-5678</c>) and returns <c>04XXXXXXXX</c>, or null.
    /// </summary>
    public static string? Normalise(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            return null;
        }
        var digits = Separators().Replace(raw, string.Empty);
        digits = CountryCode().Replace(digits, "0");
        if (digits.StartsWith("00", StringComparison.Ordinal))
        {
            digits = digits[1..];
        }
        return Mobile().IsMatch(digits) ? digits : null;
    }

    [GeneratedRegex(@"[\s\-().]")]
    private static partial Regex Separators();

    [GeneratedRegex(@"^\+?61")]
    private static partial Regex CountryCode();

    [GeneratedRegex(@"^04\d{8}$")]
    private static partial Regex Mobile();
}
