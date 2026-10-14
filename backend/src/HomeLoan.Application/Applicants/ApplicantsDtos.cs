using System.Globalization;
using HomeLoan.Domain;

namespace HomeLoan.Application.Applicants;

// Shapes match the front end's core/models/applicant.model.ts.

public sealed record ApplicantDto
{
    public Title? Title { get; init; }
    public string? FirstName { get; init; }
    public string? LastName { get; init; }
    public string? Email { get; init; }
    public string? Mobile { get; init; }
    /// <summary>ISO calendar date, <c>yyyy-MM-dd</c>. A string so a bad date is a field error, not a JSON error.</summary>
    public string? DateOfBirth { get; init; }

    /// <summary>Only call after validation. Trims names, normalises the mobile, empty email becomes null.</summary>
    internal Applicant ToDomain() => new(
        Title!.Value,
        FirstName!.Trim(),
        LastName!.Trim(),
        string.IsNullOrWhiteSpace(Email) ? null : Email.Trim(),
        AuMobile.Normalise(Mobile)!,
        Domain.DateOfBirth.Parse(DateOfBirth)!.Value);
}

public sealed record ConsentDto
{
    public bool? Accepted { get; init; }
    public string? TermsVersion { get; init; }
}

/// <summary>PUT body. Replaces the whole set; array order is the applicant order.</summary>
public sealed record SaveApplicantsRequest
{
    public IReadOnlyList<ApplicantDto?>? Applicants { get; init; }
    public ConsentDto? Consent { get; init; }
}

public sealed record SavedApplicantDto(
    int Id,
    int Ordinal,
    Title Title,
    string FirstName,
    string LastName,
    string? Email,
    string Mobile,
    string DateOfBirth);

public sealed record ConsentResponse(string TermsVersion, DateTime AcceptedAt);

public sealed record ApplicantsResponse(int ApplicationId, IReadOnlyList<SavedApplicantDto> Applicants, ConsentResponse Consent)
{
    internal static ApplicantsResponse FromDomain(int applicationId, ApplicantSet set) => new(
        applicationId,
        set.Applicants
            .Select(a => new SavedApplicantDto(
                a.Id,
                a.Ordinal,
                a.Details.Title,
                a.Details.FirstName,
                a.Details.LastName,
                a.Details.Email,
                a.Details.Mobile,
                a.Details.DateOfBirth.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)))
            .ToList(),
        new ConsentResponse(set.Consent.TermsVersion, DateTime.SpecifyKind(set.Consent.AcceptedAt, DateTimeKind.Utc)));
}
