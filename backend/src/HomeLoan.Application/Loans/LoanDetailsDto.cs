using HomeLoan.Domain;

namespace HomeLoan.Application.Loans;

/// <summary>
/// Request and response body for <c>/applications/{id}/loan-details</c>; the same shape as the front
/// end's <c>LoanDetails</c> model. Properties are nullable so a missing field is reported as missing
/// instead of quietly becoming 0 or false.
/// </summary>
public sealed record LoanDetailsDto
{
    public int? ApplicationId { get; init; }
    public LendingPurpose? Purpose { get; init; }
    public PropertyUsage? PropertyUsage { get; init; }
    public NumberOfApplicants? NumberOfApplicants { get; init; }
    public bool? IsSameHousehold { get; init; }
    public int? NumberOfDependants { get; init; }
    public decimal? LoanAmount { get; init; }
    public decimal? Deposit { get; init; }
    public decimal? EstimatedPropertyValue { get; init; }
    public bool? IsAddressKnown { get; init; }
    public string? Address { get; init; }
    public AuState? State { get; init; }

    /// <summary>Only call after validation.</summary>
    internal LoanDetails ToDomain() => new(
        Purpose!.Value,
        PropertyUsage!.Value,
        NumberOfApplicants!.Value,
        IsSameHousehold,
        NumberOfDependants!.Value,
        LoanAmount!.Value,
        Deposit,
        EstimatedPropertyValue!.Value,
        IsAddressKnown!.Value,
        Address?.Trim(),
        State);

    internal static LoanDetailsDto FromDomain(int applicationId, LoanDetails details) => new()
    {
        ApplicationId = applicationId,
        Purpose = details.Purpose,
        PropertyUsage = details.PropertyUsage,
        NumberOfApplicants = details.NumberOfApplicants,
        IsSameHousehold = details.IsSameHousehold,
        NumberOfDependants = details.NumberOfDependants,
        LoanAmount = details.LoanAmount,
        Deposit = details.Deposit,
        EstimatedPropertyValue = details.EstimatedPropertyValue,
        IsAddressKnown = details.IsAddressKnown,
        Address = details.Address,
        State = details.State
    };
}
