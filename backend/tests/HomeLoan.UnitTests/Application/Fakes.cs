using HomeLoan.Application.Applicants;
using HomeLoan.Application.Common;
using HomeLoan.Application.Drafts;
using HomeLoan.Application.Loans;
using HomeLoan.Domain;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Time.Testing;

namespace HomeLoan.UnitTests.Application;

internal static class Versions
{
    public static ConcurrencyToken Of(long n) => new(BitConverter.GetBytes(n).Reverse().ToArray());
}

internal sealed class FakeUnitOfWork : IUnitOfWork
{
    public int Commits { get; private set; }

    public int Rollbacks { get; private set; }

    public Task CommitAsync(CancellationToken cancellationToken)
    {
        Commits++;
        return Task.CompletedTask;
    }

    public Task RollbackAsync(CancellationToken cancellationToken)
    {
        Rollbacks++;
        return Task.CompletedTask;
    }
}

internal sealed class FakeLoanDetailsRepository : ILoanDetailsRepository
{
    private readonly Dictionary<int, Versioned<LoanDetails>> rows = [];
    private long nextVersion = 1;

    /// <summary>Simulates another request winning the race between the version read and the write.</summary>
    public bool LoseNextWrite { get; set; }

    public void Seed(int applicationId, LoanDetails details) =>
        rows[applicationId] = new(details, Versions.Of(nextVersion++));

    public Task<Versioned<LoanDetails>?> GetAsync(int applicationId, CancellationToken cancellationToken) =>
        Task.FromResult(rows.GetValueOrDefault(applicationId));

    public Task<ConcurrencyToken?> GetVersionAsync(int applicationId, CancellationToken cancellationToken) =>
        Task.FromResult(rows.GetValueOrDefault(applicationId)?.Version);

    public Task<ConcurrencyToken?> InsertAsync(int applicationId, LoanDetails details, CancellationToken cancellationToken)
    {
        if (LoseNextWrite || rows.ContainsKey(applicationId))
        {
            return Task.FromResult<ConcurrencyToken?>(null);
        }
        Seed(applicationId, details);
        return Task.FromResult<ConcurrencyToken?>(rows[applicationId].Version);
    }

    public Task<ConcurrencyToken?> UpdateAsync(
        int applicationId, LoanDetails details, ConcurrencyToken expected, CancellationToken cancellationToken)
    {
        if (LoseNextWrite || !rows.TryGetValue(applicationId, out var row) || !row.Version.Equals(expected))
        {
            return Task.FromResult<ConcurrencyToken?>(null);
        }
        Seed(applicationId, details);
        return Task.FromResult<ConcurrencyToken?>(rows[applicationId].Version);
    }
}

internal sealed class FakeApplicantsRepository : IApplicantsRepository
{
    private readonly Dictionary<int, Versioned<ApplicantSet>> rows = [];
    private long nextVersion = 100;

    public Task<Versioned<ApplicantSet>?> GetAsync(int applicationId, CancellationToken cancellationToken) =>
        Task.FromResult(rows.GetValueOrDefault(applicationId));

    public Task<ConcurrencyToken?> GetVersionAsync(int applicationId, CancellationToken cancellationToken) =>
        Task.FromResult(rows.GetValueOrDefault(applicationId)?.Version);

    public Task<ConcurrencyToken?> InsertAsync(
        int applicationId, IReadOnlyList<Applicant> applicants, string termsVersion, DateTime acceptedAt,
        CancellationToken cancellationToken) =>
        Task.FromResult<ConcurrencyToken?>(rows.ContainsKey(applicationId) ? null : Store(applicationId, applicants, new(termsVersion, acceptedAt)));

    public Task<ConcurrencyToken?> UpdateAsync(
        int applicationId, IReadOnlyList<Applicant> applicants, string termsVersion, DateTime acceptedAt,
        ConcurrencyToken expected, CancellationToken cancellationToken)
    {
        if (!rows.TryGetValue(applicationId, out var row) || !row.Version.Equals(expected))
        {
            return Task.FromResult<ConcurrencyToken?>(null);
        }
        var consent = row.Value.Consent.TermsVersion == termsVersion ? row.Value.Consent : new Consent(termsVersion, acceptedAt);
        return Task.FromResult<ConcurrencyToken?>(Store(applicationId, applicants, consent));
    }

    private ConcurrencyToken Store(int applicationId, IReadOnlyList<Applicant> applicants, Consent consent)
    {
        var saved = applicants.Select((a, i) => new SavedApplicant(applicationId * 100 + i + 1, i + 1, a)).ToList();
        rows[applicationId] = new(new ApplicantSet(saved, consent), Versions.Of(nextVersion++));
        return rows[applicationId].Version;
    }
}

internal static class TestClock
{
    /// <summary>A business clock in Sydney at the given UTC instant.</summary>
    public static BusinessClock At(DateTimeOffset utc) =>
        new(new FakeTimeProvider(utc), Options.Create(new ClockOptions { TimeZone = "Australia/Sydney" }));

    /// <summary>14 Oct 2026, midday in Sydney.</summary>
    public static BusinessClock Default => At(new DateTimeOffset(2026, 10, 14, 1, 0, 0, TimeSpan.Zero));
}

internal sealed class FakeDraftRepository : IDraftRepository
{
    public Dictionary<(int ApplicationId, string Step), string> Rows { get; } = [];

    public Task<IReadOnlyList<Draft>> GetAllAsync(int applicationId, CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlyList<Draft>>(Rows
            .Where(r => r.Key.ApplicationId == applicationId)
            .Select(r => new Draft(r.Key.Step, r.Value, new DateTime(2026, 10, 16, 1, 2, 3)))
            .ToList());

    public Task SaveAsync(int applicationId, string journeyStep, string data, CancellationToken cancellationToken)
    {
        Rows[(applicationId, journeyStep)] = data;
        return Task.CompletedTask;
    }

    public Task DeleteAsync(int applicationId, string journeyStep, CancellationToken cancellationToken)
    {
        Rows.Remove((applicationId, journeyStep));
        return Task.CompletedTask;
    }
}
