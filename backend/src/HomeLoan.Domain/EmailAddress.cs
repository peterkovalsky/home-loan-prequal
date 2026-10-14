using System.Text.RegularExpressions;

namespace HomeLoan.Domain;

public static partial class EmailAddress
{
    /// <summary>Same deliberately simple check as the front end: something@something.something, no spaces.</summary>
    public static bool IsValid(string? raw)
    {
        var email = raw?.Trim() ?? string.Empty;
        return email.Length <= ApplicantRules.EmailMaxLength && Pattern().IsMatch(email);
    }

    [GeneratedRegex(@"^[^\s@]+@[^\s@]+\.[^\s@]+$")]
    private static partial Regex Pattern();
}
