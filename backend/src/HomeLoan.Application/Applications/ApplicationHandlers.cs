using HomeLoan.Application.Common;
using Microsoft.Extensions.Options;

namespace HomeLoan.Application.Applications;

public interface IApplicationRepository
{
    /// <summary>Creates an empty application reachable with the token whose hash is given; returns its id.</summary>
    Task<int> CreateAsync(byte[] resumeTokenHash, CancellationToken cancellationToken);

    /// <summary>
    /// True if the application exists, the token hash matches and it was active within
    /// <paramref name="expiryDays"/>; then also records the activity.
    /// </summary>
    Task<bool> TouchAsync(int applicationId, byte[] resumeTokenHash, int expiryDays, CancellationToken cancellationToken);

    /// <summary>Deletes the application and, by cascade, everything saved for it.</summary>
    Task DeleteAsync(int applicationId, CancellationToken cancellationToken);
}

public sealed record CreatedApplication(int Id, string ResumeToken);

/// <summary>Starts an application for a new visitor. The token is returned once and never again.</summary>
public sealed class CreateApplicationHandler(IApplicationRepository repository, IUnitOfWork unitOfWork)
{
    public async Task<CreatedApplication> HandleAsync(CancellationToken cancellationToken)
    {
        var token = ResumeToken.New();
        var id = await repository.CreateAsync(token.Hash(), cancellationToken);
        await unitOfWork.CommitAsync(cancellationToken);
        return new CreatedApplication(id, token.Value);
    }
}

/// <summary>
/// Every request for an application must carry its resume token. A wrong, malformed or expired
/// token looks exactly like a missing application, so ids can't be probed.
/// </summary>
public sealed class ApplicationAccess(IApplicationRepository repository, IOptions<ApplicationOptions> options)
{
    public async Task<bool> CanAccessAsync(int applicationId, string? token, CancellationToken cancellationToken) =>
        ResumeToken.TryHash(token) is { } hash
        && await repository.TouchAsync(applicationId, hash, options.Value.ResumeExpiryDays, cancellationToken);
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
