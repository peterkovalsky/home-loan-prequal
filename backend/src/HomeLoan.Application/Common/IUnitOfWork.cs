namespace HomeLoan.Application.Common;

/// <summary>
/// One connection and transaction per request, opened on first use. Repositories enlist in it;
/// the handler commits. Disposing without committing rolls back.
/// </summary>
public interface IUnitOfWork
{
    Task CommitAsync(CancellationToken cancellationToken);
}
