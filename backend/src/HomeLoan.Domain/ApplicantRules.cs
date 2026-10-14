namespace HomeLoan.Domain;

/// <summary>Limits shared with the front end (shared/validation/applicant-rules.ts). Change both together.</summary>
public static class ApplicantRules
{
    public const int MinimumAge = 18;
    public const int MaximumAge = 120;
    public const int NameMaxLength = 50;
    public const int EmailMaxLength = 254;
}

/// <summary>How many applicants the "Who's applying?" answer allows.</summary>
public sealed record ApplicantCountRange(int Min, int Max)
{
    /// <summary>"More than two" starts at three and goes up to the configured maximum.</summary>
    public static ApplicantCountRange For(NumberOfApplicants answer, int maxApplicants) => answer switch
    {
        NumberOfApplicants.Single => new(1, 1),
        NumberOfApplicants.Couple => new(2, 2),
        NumberOfApplicants.More => new(3, Math.Max(3, maxApplicants)),
        _ => throw new ArgumentOutOfRangeException(nameof(answer), answer, "Unknown applicant count.")
    };

    public bool Contains(int count) => count >= Min && count <= Max;
}
