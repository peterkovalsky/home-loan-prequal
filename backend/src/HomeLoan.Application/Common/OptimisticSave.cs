namespace HomeLoan.Application.Common;

/// <summary>
/// The If-Match rules shared by every PUT. Once a resource exists, the client must send its ETag
/// (428 if missing, 412 if stale). Creating a resource must not send one (412: it doesn't match
/// "nothing"). The repository's compare-and-swap is the real guard; these checks only fail fast.
/// </summary>
public static class OptimisticSave
{
    public static async Task<Result<(ConcurrencyToken Version, bool Created)>> RunAsync(
        ConcurrencyToken? current,
        string? ifMatch,
        Func<Task<ConcurrencyToken?>> insert,
        Func<ConcurrencyToken, Task<ConcurrencyToken?>> update)
    {
        ArgumentNullException.ThrowIfNull(insert);
        ArgumentNullException.ThrowIfNull(update);

        if (current is null)
        {
            if (ifMatch is not null)
            {
                return AppError.PreconditionFailed;
            }
            return await insert() is { } created ? (created, true) : AppError.PreconditionFailed;
        }

        if (ifMatch is null)
        {
            return AppError.PreconditionRequired;
        }
        if (ConcurrencyToken.FromETag(ifMatch) is not { } expected || !expected.Equals(current))
        {
            return AppError.PreconditionFailed;
        }
        return await update(expected) is { } updated ? (updated, false) : AppError.PreconditionFailed;
    }
}
