using HomeLoan.Application.Common;
using HomeLoan.Domain;

namespace HomeLoan.Application.Loans;

public interface ILoanDetailsRepository
{
    Task<Versioned<LoanDetails>?> GetAsync(int applicationId, CancellationToken cancellationToken);

    Task<ConcurrencyToken?> GetVersionAsync(int applicationId, CancellationToken cancellationToken);

    /// <summary>Creates the application if needed. Returns null if loan details already exist (lost a race).</summary>
    Task<ConcurrencyToken?> InsertAsync(int applicationId, LoanDetails details, CancellationToken cancellationToken);

    /// <summary>Compare-and-swap on the row version. Returns null if <paramref name="expected"/> is stale.</summary>
    Task<ConcurrencyToken?> UpdateAsync(
        int applicationId, LoanDetails details, ConcurrencyToken expected, CancellationToken cancellationToken);
}
