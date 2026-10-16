using FluentValidation;
using HomeLoan.Application.Common;
using HomeLoan.Application.Drafts;
using HomeLoan.Application.Loans;

namespace HomeLoan.UnitTests.Application;

public class LoanDetailsHandlerTests
{
    private readonly FakeLoanDetailsRepository repository = new();
    private readonly FakeDraftRepository drafts = new();
    private readonly FakeUnitOfWork unitOfWork = new();

    private SaveLoanDetailsHandler Handler() => new(new LoanDetailsValidator(), repository, drafts, unitOfWork);

    private Task<Result<Saved<LoanDetailsDto>>> Save(LoanDetailsDto dto, string? ifMatch = null) =>
        Handler().HandleAsync(1, dto, ifMatch, CancellationToken.None);

    [Fact]
    public async Task Creates_loan_details_and_commits()
    {
        var result = await Save(Samples.Refinance());

        Assert.True(result.Value.Created);
        Assert.Equal(1, result.Value.Value.ApplicationId);
        Assert.Equal(1, unitOfWork.Commits);
    }

    [Fact]
    public async Task A_successful_save_clears_the_step_draft_but_a_rejected_one_keeps_it()
    {
        drafts.Rows[(1, DraftSteps.LoanDetails)] = "{}";
        drafts.Rows[(1, DraftSteps.AboutYou)] = "{}";

        await Save(Samples.Refinance() with { LoanAmount = null });
        Assert.True(drafts.Rows.ContainsKey((1, DraftSteps.LoanDetails)));

        await Save(Samples.Refinance());
        Assert.False(drafts.Rows.ContainsKey((1, DraftSteps.LoanDetails)));
        Assert.True(drafts.Rows.ContainsKey((1, DraftSteps.AboutYou)));
    }

    [Fact]
    public async Task Updates_with_the_current_etag_and_returns_a_new_one()
    {
        var first = await Save(Samples.Refinance());

        var second = await Save(Samples.Purchase(), first.Value.Version.ToETag());

        Assert.False(second.Value.Created);
        Assert.NotEqual(first.Value.Version, second.Value.Version);
    }

    [Fact]
    public async Task Requires_if_match_once_the_resource_exists()
    {
        await Save(Samples.Refinance());

        var result = await Save(Samples.Refinance());

        Assert.Equal(ErrorKind.PreconditionRequired, result.Error?.Kind);
        Assert.Equal(1, unitOfWork.Commits);
    }

    [Fact]
    public async Task Rejects_a_stale_or_malformed_etag()
    {
        var first = await Save(Samples.Refinance());
        await Save(Samples.Refinance(), first.Value.Version.ToETag());

        Assert.Equal(ErrorKind.PreconditionFailed, (await Save(Samples.Refinance(), first.Value.Version.ToETag())).Error?.Kind);
        Assert.Equal(ErrorKind.PreconditionFailed, (await Save(Samples.Refinance(), "W/\"abc\"")).Error?.Kind);
    }

    [Fact]
    public async Task Treats_if_match_on_a_resource_that_does_not_exist_as_stale() =>
        Assert.Equal(ErrorKind.PreconditionFailed, (await Save(Samples.Refinance(), Versions.Of(1).ToETag())).Error?.Kind);

    [Fact]
    public async Task Reports_a_lost_race_as_stale_without_committing()
    {
        repository.LoseNextWrite = true;

        var result = await Save(Samples.Refinance());

        Assert.Equal(ErrorKind.PreconditionFailed, result.Error?.Kind);
        Assert.Equal(0, unitOfWork.Commits);
        Assert.Equal(1, unitOfWork.Rollbacks);
    }

    [Fact]
    public async Task Rejects_invalid_details_and_a_mismatched_body_id_before_touching_the_database()
    {
        var invalid = await Save(Samples.Refinance() with { LoanAmount = null });
        var wrongId = await Save(Samples.Refinance() with { ApplicationId = 2 });

        Assert.Equal(ErrorKind.Validation, invalid.Error?.Kind);
        Assert.Contains("loanAmount", invalid.Error!.Fields!.Keys);
        Assert.Contains("applicationId", wrongId.Error!.Fields!.Keys);
        Assert.Null(await repository.GetAsync(1, CancellationToken.None));
    }

    [Fact]
    public async Task Get_returns_not_found_until_saved()
    {
        var handler = new GetLoanDetailsHandler(repository);
        Assert.Equal(ErrorKind.NotFound, (await handler.HandleAsync(1, CancellationToken.None)).Error?.Kind);

        await Save(Samples.Refinance());
        Assert.Equal(Samples.Refinance().LoanAmount, (await handler.HandleAsync(1, CancellationToken.None)).Value.Value.LoanAmount);
    }
}
