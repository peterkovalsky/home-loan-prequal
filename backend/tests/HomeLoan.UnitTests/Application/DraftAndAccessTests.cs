using System.Text.Json;
using HomeLoan.Application.Applications;
using HomeLoan.Application.Common;
using HomeLoan.Application.Drafts;
using Microsoft.Extensions.Options;

namespace HomeLoan.UnitTests.Application;

public class SaveDraftHandlerTests
{
    private readonly FakeDraftRepository drafts = new();
    private readonly FakeUnitOfWork unitOfWork = new();

    private Task<Result<bool>> Save(string step, string json) =>
        new SaveDraftHandler(drafts, unitOfWork).HandleAsync(1, step, JsonDocument.Parse(json).RootElement, CancellationToken.None);

    [Fact]
    public async Task Keeps_incomplete_answers_as_sent_and_commits()
    {
        var result = await Save(DraftSteps.LoanDetails, """{"loanAmount":null,"purpose":"half typed"}""");

        Assert.True(result.IsSuccess);
        Assert.Equal("""{"loanAmount":null,"purpose":"half typed"}""", drafts.Rows[(1, DraftSteps.LoanDetails)]);
        Assert.Equal(1, unitOfWork.Commits);
    }

    [Theory]
    [InlineData("[1,2]")]
    [InlineData("\"text\"")]
    [InlineData("null")]
    public async Task Rejects_anything_but_a_json_object(string json)
    {
        var result = await Save(DraftSteps.AboutYou, json);

        Assert.Equal(ErrorKind.Validation, result.Error?.Kind);
        Assert.Empty(drafts.Rows);
    }

    [Fact]
    public async Task Rejects_an_unknown_step_as_not_found() =>
        Assert.Equal(ErrorKind.NotFound, (await Save("income", "{}")).Error?.Kind);

    [Fact]
    public async Task Accepts_up_to_the_size_limit_and_rejects_one_character_more()
    {
        // {"a":"xxx..."} is 8 characters plus the padding.
        var padding = SaveDraftHandler.MaxLength - 8;
        Assert.True((await Save(DraftSteps.AboutYou, $$"""{"a":"{{new string('x', padding)}}"}""")).IsSuccess);
        Assert.Equal(ErrorKind.Validation, (await Save(DraftSteps.AboutYou, $$"""{"a":"{{new string('x', padding + 1)}}"}""")).Error?.Kind);
    }
}

public class ResumeTokenTests
{
    [Fact]
    public void A_new_token_is_43_url_safe_characters_and_never_repeats()
    {
        var tokens = Enumerable.Range(0, 100).Select(_ => ResumeToken.New().Value).ToList();

        Assert.All(tokens, t => Assert.Matches("^[A-Za-z0-9_-]{43}$", t));
        Assert.Equal(tokens.Count, tokens.Distinct().Count());
    }

    [Fact]
    public void The_hash_of_a_presented_token_matches_the_stored_hash()
    {
        var token = ResumeToken.New();

        Assert.Equal(token.Hash(), ResumeToken.TryHash(token.Value));
        Assert.NotEqual(token.Hash(), ResumeToken.TryHash(ResumeToken.New().Value));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("too-short")]
    [InlineData("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=")]
    [InlineData("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA")]
    public void A_malformed_token_has_no_hash(string? candidate) => Assert.Null(ResumeToken.TryHash(candidate));
}

public class ApplicationAccessTests
{
    private sealed class FakeApplications : IApplicationRepository
    {
        public List<(int Id, byte[] Hash, int ExpiryDays)> Touched { get; } = [];

        public byte[]? StoredHash { get; set; }

        public Task<int> CreateAsync(byte[] resumeTokenHash, CancellationToken cancellationToken) => Task.FromResult(1_000_000);

        public Task<bool> TouchAsync(int applicationId, byte[] resumeTokenHash, int expiryDays, CancellationToken cancellationToken)
        {
            Touched.Add((applicationId, resumeTokenHash, expiryDays));
            return Task.FromResult(StoredHash is not null && StoredHash.SequenceEqual(resumeTokenHash));
        }

        public Task DeleteAsync(int applicationId, CancellationToken cancellationToken) => Task.CompletedTask;
    }

    private readonly FakeApplications applications = new();

    private ApplicationAccess Access() => new(applications, Options.Create(new ApplicationOptions { ResumeExpiryDays = 7 }));

    [Fact]
    public async Task Allows_the_token_the_application_was_created_with_using_the_configured_expiry()
    {
        var token = ResumeToken.New();
        applications.StoredHash = token.Hash();

        Assert.True(await Access().CanAccessAsync(5, token.Value, CancellationToken.None));
        Assert.Equal(7, applications.Touched.Single().ExpiryDays);
    }

    [Fact]
    public async Task Refuses_a_malformed_token_without_asking_the_database()
    {
        Assert.False(await Access().CanAccessAsync(5, "nope", CancellationToken.None));
        Assert.Empty(applications.Touched);
    }

    [Fact]
    public async Task Create_returns_the_token_whose_hash_was_stored()
    {
        byte[]? stored = null;
        var repository = new CapturingApplications(hash => stored = hash);

        var created = await new CreateApplicationHandler(repository, new FakeUnitOfWork()).HandleAsync(CancellationToken.None);

        Assert.Equal(stored, ResumeToken.TryHash(created.ResumeToken));
    }

    private sealed class CapturingApplications(Action<byte[]> onCreate) : IApplicationRepository
    {
        public Task<int> CreateAsync(byte[] resumeTokenHash, CancellationToken cancellationToken)
        {
            onCreate(resumeTokenHash);
            return Task.FromResult(1_000_000);
        }

        public Task<bool> TouchAsync(int applicationId, byte[] resumeTokenHash, int expiryDays, CancellationToken cancellationToken) =>
            Task.FromResult(false);

        public Task DeleteAsync(int applicationId, CancellationToken cancellationToken) => Task.CompletedTask;
    }
}
