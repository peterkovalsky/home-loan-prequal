namespace HomeLoan.Application.Common;

/// <summary>
/// One connection and transaction per request, opened on first use. Repositories enlist in it;
/// the handler commits. Disposing without committing rolls back.
/// </summary>
public interface IUnitOfWork
{
    Task CommitAsync(CancellationToken cancellationToken);

    /// <summary>
    /// Ends the transaction now instead of when the request scope is disposed (after the response
    /// has been sent), so a failed save releases its locks before the client can send the next request.
    /// </summary>
    Task RollbackAsync(CancellationToken cancellationToken);
}
