namespace HomeLoan.Domain;

public static class LoanRules
{
    /// <summary>Sanity cap for amounts; fits decimal(12,2). Mirrored by the front end's max validators.</summary>
    public const decimal MaxAmount = 100_000_000m;
    public const int MaxDependants = 20;
    public const int AddressMaxLength = 200;
}
