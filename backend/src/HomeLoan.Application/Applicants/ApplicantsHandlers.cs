using FluentValidation;
using HomeLoan.Application.Common;
using HomeLoan.Application.Loans;
using HomeLoan.Domain;
using Microsoft.Extensions.Options;

namespace HomeLoan.Application.Applicants;

public sealed class GetApplicantsHandler(IApplicantsRepository repository)
{
    public async Task<Result<Versioned<ApplicantsResponse>>> HandleAsync(int applicationId, CancellationToken cancellationToken)
    {
        var found = await repository.GetAsync(applicationId, cancellationToken);
        return found is null
            ? AppError.NotFound("Applicants have not been saved yet.")
            : new Versioned<ApplicantsResponse>(ApplicantsResponse.FromDomain(applicationId, found.Value), found.Version);
    }
}

public sealed class SaveApplicantsHandler(
    IValidator<SaveApplicantsRequest> validator,
    ILoanDetailsRepository loanDetails,
    IApplicantsRepository repository,
    IUnitOfWork unitOfWork,
    IBusinessClock clock,
    IOptions<ApplicantOptions> options)
{
    public async Task<Result<Saved<ApplicantsResponse>>> HandleAsync(
        int applicationId, SaveApplicantsRequest request, string? ifMatch, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        var validation = await validator.ValidateAsync(request, cancellationToken);
        if (!validation.IsValid)
        {
            return validation.ToError();
        }

        var loan = await loanDetails.GetAsync(applicationId, cancellationToken);
        if (loan is null)
        {
            return AppError.Conflict("Save your loan details before adding applicants.");
        }
        var range = ApplicantCountRange.For(loan.Value.NumberOfApplicants, options.Value.MaxApplicants);
        if (!range.Contains(request.Applicants!.Count))
        {
            return AppError.Validation("applicants", range.Min == range.Max
                ? $"Expected {range.Min} applicant(s) to match your loan details."
                : $"Expected between {range.Min} and {range.Max} applicants to match your loan details.");
        }

        var applicants = request.Applicants.Select(a => a!.ToDomain()).ToList();
        var terms = request.Consent!.TermsVersion!;
        var now = clock.UtcNow;
        var saved = await OptimisticSave.RunAsync(
            await repository.GetVersionAsync(applicationId, cancellationToken),
            ifMatch,
            () => repository.InsertAsync(applicationId, applicants, terms, now, cancellationToken),
            expected => repository.UpdateAsync(applicationId, applicants, terms, now, expected, cancellationToken));
        if (!saved.IsSuccess)
        {
            return saved.Error!;
        }

        // Read back inside the transaction for the generated ids and the consent timestamp.
        var set = await repository.GetAsync(applicationId, cancellationToken)
            ?? throw new InvalidOperationException("Applicants vanished inside their own transaction.");
        await unitOfWork.CommitAsync(cancellationToken);
        var (version, created) = saved.Value;
        return new Saved<ApplicantsResponse>(ApplicantsResponse.FromDomain(applicationId, set.Value), version, created);
    }
}
