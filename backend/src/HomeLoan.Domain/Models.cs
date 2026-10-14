namespace HomeLoan.Domain;

/// <summary>Validated answers from the Loan details step.</summary>
public sealed record LoanDetails(
    LendingPurpose Purpose,
    PropertyUsage PropertyUsage,
    NumberOfApplicants NumberOfApplicants,
    bool? IsSameHousehold,
    int NumberOfDependants,
    decimal LoanAmount,
    decimal? Deposit,
    decimal EstimatedPropertyValue,
    bool IsAddressKnown,
    string? Address,
    AuState? State);

/// <summary>A validated, normalised applicant (names trimmed, mobile as 04XXXXXXXX).</summary>
public sealed record Applicant(
    Title Title,
    string FirstName,
    string LastName,
    string? Email,
    string Mobile,
    DateOnly DateOfBirth);

public sealed record SavedApplicant(int Id, int Ordinal, Applicant Details);

/// <summary>When the applicants agreed to a version of the pre-qualification and privacy terms (UTC).</summary>
public sealed record Consent(string TermsVersion, DateTime AcceptedAt);

public sealed record ApplicantSet(IReadOnlyList<SavedApplicant> Applicants, Consent Consent);
