using System.Diagnostics.CodeAnalysis;

namespace HomeLoan.Domain;

// Codes are shared with the front end (core/models/reference-data.ts) and seeded into the ref
// schema by migration 0002. Never renumber them.

public enum LendingPurpose
{
    Construction = 1000,
    FurtherAdvance = 1001,
    Other = 1002,
    PurchaseExistingDwelling = 1003,
    PurchaseNewDwelling = 1004,
    Refinance = 1006
}

public enum PropertyUsage
{
    InvestmentResidential = 1002,
    OwnerOccupied = 1003
}

public enum NumberOfApplicants
{
    [SuppressMessage("Naming", "CA1720:Identifier contains type name", Justification = "Mirrors the front-end enum member.")]
    Single = 1,
    Couple = 2,
    More = 3
}

public enum AuState
{
    ACT = 1000,
    NSW = 1001,
    NT = 1002,
    QLD = 1003,
    SA = 1004,
    TAS = 1005,
    VIC = 1006,
    WA = 1007
}

public enum Title
{
    Mr = 1,
    Mrs = 2,
    Ms = 3,
    Miss = 4,
    Dr = 5
}

public static class LendingPurposes
{
    /// <summary>Buying or building: the only purposes where we ask for a deposit (ref.LendingPurpose.IsPurchase).</summary>
    public static bool IsPurchase(LendingPurpose purpose) =>
        purpose is LendingPurpose.PurchaseExistingDwelling or LendingPurpose.PurchaseNewDwelling or LendingPurpose.Construction;
}
