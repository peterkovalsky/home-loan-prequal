using FluentValidation;
using HomeLoan.Application.Common;
using HomeLoan.Application.Drafts;

namespace HomeLoan.Application.Loans;

public sealed class GetLoanDetailsHandler(ILoanDetailsRepository repository)
{
    public async Task<Result<Versioned<LoanDetailsDto>>> HandleAsync(int applicationId, CancellationToken cancellationToken)
    {
        var found = await repository.GetAsync(applicationId, cancellationToken);
        return found is null
            ? AppError.NotFound("Loan details have not been saved yet.")
            : new Versioned<LoanDetailsDto>(LoanDetailsDto.FromDomain(applicationId, found.Value), found.Version);
    }
}

public sealed class SaveLoanDetailsHandler(
    IValidator<LoanDetailsDto> validator,
    ILoanDetailsRepository repository,
    IDraftRepository drafts,
    IUnitOfWork unitOfWork)
{
    public async Task<Result<Saved<LoanDetailsDto>>> HandleAsync(
        int applicationId, LoanDetailsDto request, string? ifMatch, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        if (request.ApplicationId is { } bodyId && bodyId != applicationId)
        {
            return AppError.Validation("applicationId", "The application id in the body doesn't match the URL.");
        }
        var validation = await validator.ValidateAsync(request, cancellationToken);
        if (!validation.IsValid)
        {
            return validation.ToError();
        }

        var details = request.ToDomain();
        var current = await repository.GetVersionAsync(applicationId, cancellationToken);
        var saved = await OptimisticSave.RunAsync(
            current,
            ifMatch,
            () => repository.InsertAsync(applicationId, details, cancellationToken),
            expected => repository.UpdateAsync(applicationId, details, expected, cancellationToken));
        if (!saved.IsSuccess)
        {
            await unitOfWork.RollbackAsync(cancellationToken);
            return saved.Error!;
        }

        // The validated answers are now the only copy; the draft would only go stale.
        await drafts.DeleteAsync(applicationId, DraftSteps.LoanDetails, cancellationToken);
        await unitOfWork.CommitAsync(cancellationToken);
        var (version, created) = saved.Value;
        return new Saved<LoanDetailsDto>(LoanDetailsDto.FromDomain(applicationId, details), version, created);
    }
}
