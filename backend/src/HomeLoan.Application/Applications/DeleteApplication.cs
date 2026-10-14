using HomeLoan.Application.Common;

namespace HomeLoan.Application.Applications;

public interface IApplicationRepository
{
    /// <summary>Deletes the application and, by cascade, everything saved for it.</summary>
    Task DeleteAsync(int applicationId, CancellationToken cancellationToken);
}

/// <summary>Withdrawal / right to erasure. Idempotent: deleting a missing application succeeds.</summary>
public sealed class DeleteApplicationHandler(IApplicationRepository repository, IUnitOfWork unitOfWork)
{
    public async Task HandleAsync(int applicationId, CancellationToken cancellationToken)
    {
        await repository.DeleteAsync(applicationId, cancellationToken);
        await unitOfWork.CommitAsync(cancellationToken);
    }
}
