using HomeLoan.Application.Common;
using HomeLoan.Domain;

namespace HomeLoan.Application.Applicants;

public interface IApplicantsRepository
{
    Task<Versioned<ApplicantSet>?> GetAsync(int applicationId, CancellationToken cancellationToken);

    Task<ConcurrencyToken?> GetVersionAsync(int applicationId, CancellationToken cancellationToken);

    /// <summary>Creates the set. Returns null if one already exists (lost a race).</summary>
    Task<ConcurrencyToken?> InsertAsync(
        int applicationId, IReadOnlyList<Applicant> applicants, string termsVersion, DateTime acceptedAt,
        CancellationToken cancellationToken);

    /// <summary>
    /// Compare-and-swap on the set's row version, then replaces the applicants (stable ids per
    /// position) and records consent if this terms version is new. Returns null if stale.
    /// </summary>
    Task<ConcurrencyToken?> UpdateAsync(
        int applicationId, IReadOnlyList<Applicant> applicants, string termsVersion, DateTime acceptedAt,
        ConcurrencyToken expected, CancellationToken cancellationToken);
}
