using HomeLoan.Application.Applicants;
using HomeLoan.Application.Common;
using HomeLoan.Application.Drafts;
using HomeLoan.Domain;
using Microsoft.Extensions.Options;

namespace HomeLoan.UnitTests.Application;

public class ApplicantsHandlerTests
{
    private readonly FakeLoanDetailsRepository loanDetails = new();
    private readonly FakeApplicantsRepository repository = new();
    private readonly FakeDraftRepository drafts = new();
    private readonly FakeUnitOfWork unitOfWork = new();

    private SaveApplicantsHandler Handler() => new(
        new SaveApplicantsRequestValidator(Options.Create(new ConsentOptions { CurrentTermsVersion = "2026-10" }), TestClock.Default),
        loanDetails,
        repository,
        drafts,
        unitOfWork,
        TestClock.Default,
        Options.Create(new ApplicantOptions { MaxApplicants = 4 }));

    private Task<Result<Saved<ApplicantsResponse>>> Save(SaveApplicantsRequest request, string? ifMatch = null) =>
        Handler().HandleAsync(1, request, ifMatch, CancellationToken.None);

    private void LoanDetailsFor(NumberOfApplicants answer) => loanDetails.Seed(1, new LoanDetails(
        LendingPurpose.Refinance, PropertyUsage.OwnerOccupied, answer,
        IsSameHousehold: answer == NumberOfApplicants.Single ? null : true,
        NumberOfDependants: 0, LoanAmount: 500_000m, Deposit: null, EstimatedPropertyValue: 900_000m,
        IsAddressKnown: false, Address: null, State: AuState.NSW));

    [Fact]
    public async Task Needs_loan_details_first() =>
        Assert.Equal(ErrorKind.Conflict, (await Save(Samples.Request(Samples.Alex()))).Error?.Kind);

    [Theory]
    [InlineData(NumberOfApplicants.Single, 2, "Expected 1 applicant(s)")]
    [InlineData(NumberOfApplicants.Couple, 1, "Expected 2 applicant(s)")]
    [InlineData(NumberOfApplicants.More, 2, "between 3 and 4")]
    [InlineData(NumberOfApplicants.More, 5, "between 3 and 4")]
    public async Task Requires_the_number_of_applicants_the_loan_details_call_for(NumberOfApplicants answer, int count, string message)
    {
        LoanDetailsFor(answer);

        var result = await Save(Samples.Request(Enumerable.Repeat(Samples.Alex(), count).ToArray()));

        Assert.Contains(message, result.Error!.Fields!["applicants"][0], StringComparison.Ordinal);
    }

    [Fact]
    public async Task A_successful_save_clears_the_about_you_draft()
    {
        drafts.Rows[(1, DraftSteps.AboutYou)] = "{}";
        LoanDetailsFor(NumberOfApplicants.Single);

        await Save(Samples.Request(Samples.Alex(), Samples.Jordan()));
        Assert.True(drafts.Rows.ContainsKey((1, DraftSteps.AboutYou)), "a rejected save keeps the draft");

        await Save(Samples.Request(Samples.Alex()));
        Assert.False(drafts.Rows.ContainsKey((1, DraftSteps.AboutYou)));
    }

    [Fact]
    public async Task Saves_normalised_applicants_and_records_consent()
    {
        LoanDetailsFor(NumberOfApplicants.Couple);

        var result = await Save(Samples.Request(Samples.Alex(), Samples.Jordan()));

        var saved = result.Value.Value;
        Assert.True(result.Value.Created);
        Assert.Equal(["Alex", "Jordan"], saved.Applicants.Select(a => a.FirstName));
        Assert.Equal(["0412345678", "0498765432"], saved.Applicants.Select(a => a.Mobile));
        Assert.Null(saved.Applicants[1].Email);
        Assert.Equal("2026-10", saved.Consent.TermsVersion);
        Assert.Equal(DateTimeKind.Utc, saved.Consent.AcceptedAt.Kind);
        Assert.Equal(1, unitOfWork.Commits);
    }

    [Fact]
    public async Task Applies_the_same_if_match_rules_as_loan_details()
    {
        LoanDetailsFor(NumberOfApplicants.Single);
        var created = await Save(Samples.Request(Samples.Alex()));

        Assert.Equal(ErrorKind.PreconditionRequired, (await Save(Samples.Request(Samples.Alex()))).Error?.Kind);
        Assert.False((await Save(Samples.Request(Samples.Alex()), created.Value.Version.ToETag())).Value.Created);
        Assert.Equal(ErrorKind.PreconditionFailed, (await Save(Samples.Request(Samples.Alex()), created.Value.Version.ToETag())).Error?.Kind);
    }
}
