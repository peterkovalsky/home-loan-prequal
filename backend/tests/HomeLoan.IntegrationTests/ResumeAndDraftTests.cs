using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using HomeLoan.IntegrationTests.Infrastructure;

namespace HomeLoan.IntegrationTests;

/// <summary>Per-visitor applications, the resume token, and drafts, against the real database.</summary>
public sealed class ResumeAndDraftTests(ApiFixture fixture) : ApiTest(fixture)
{
    private static readonly string[] Routes =
    [
        "loan-details", "applicants", "drafts"
    ];

    private async Task<(int Id, HttpClient Client)> CreateApplicationAsync()
    {
        using var anonymous = Fixture.Factory.CreateClient();
        var response = await anonymous.PostAsync(new Uri("/api/applications", UriKind.Relative), null);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var body = await response.JsonAsync();
        var client = Fixture.Factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-Application-Token", (string)body["resumeToken"]!);
        return ((int)body["id"]!, client);
    }

    [Fact]
    public async Task Post_creates_an_application_that_only_its_token_opens()
    {
        var (id, owner) = await CreateApplicationAsync();
        using var _ = owner;

        Assert.True(id >= 1_000_000, "ids come from the sequence");
        Assert.Equal(HttpStatusCode.OK, (await owner.GetAsync(new Uri($"/api/applications/{id}/drafts", UriKind.Relative))).StatusCode);
        // The client holding application 1's token can't open the new one.
        Assert.Equal(HttpStatusCode.NotFound, (await Client.GetAsync(new Uri($"/api/applications/{id}/drafts", UriKind.Relative))).StatusCode);
        // Only the hash is stored.
        Assert.Equal(32, await ScalarAsync<int>("SELECT DATALENGTH(ResumeTokenHash) FROM app.Application WHERE Id = @id", new { id }));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("not-a-token")]
    [InlineData("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA")]
    public async Task Every_route_answers_404_without_the_right_token(string? token)
    {
        await Client.SaveLoanDetailsAsync();
        using var stranger = Fixture.Factory.CreateClient();
        if (token is not null)
        {
            stranger.DefaultRequestHeaders.Add("X-Application-Token", token);
        }

        foreach (var route in Routes)
        {
            var response = await stranger.GetAsync(new Uri($"/api/applications/1/{route}", UriKind.Relative));
            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
            Assert.Equal("Application not found.", (string?)(await response.JsonAsync())["detail"]);
        }
        Assert.Equal(HttpStatusCode.NotFound, (await stranger.PutAsync("/api/applications/1/loan-details", TestApi.LoanDetailsBody())).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await stranger.PutAsync("/api/applications/1/drafts/loan-details", new JsonObject())).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await stranger.DeleteAsync(new Uri("/api/applications/1", UriKind.Relative))).StatusCode);
        Assert.Equal(1, await ScalarAsync<int>("SELECT COUNT(*) FROM app.LoanDetails WHERE ApplicationId = 1"));
    }

    [Fact]
    public async Task The_token_also_works_as_a_cookie()
    {
        using var browser = Fixture.Factory.CreateClient();
        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/applications/1/drafts");
        request.Headers.Add("Cookie", $"hl_resume={ApiFixture.TestToken.Value}");

        Assert.Equal(HttpStatusCode.OK, (await browser.SendAsync(request)).StatusCode);
    }

    [Fact]
    public async Task An_application_unused_for_more_than_7_days_can_no_longer_be_resumed()
    {
        await ExecuteAsync("UPDATE app.Application SET LastActivityAt = DATEADD(hour, -(7 * 24 - 1), SYSUTCDATETIME()) WHERE Id = 1");
        Assert.Equal(HttpStatusCode.OK, (await Client.GetAsync(new Uri("/api/applications/1/drafts", UriKind.Relative))).StatusCode);

        // That request counted as activity; now push it past the limit.
        await ExecuteAsync("UPDATE app.Application SET LastActivityAt = DATEADD(hour, -(7 * 24 + 1), SYSUTCDATETIME()) WHERE Id = 1");
        Assert.Equal(HttpStatusCode.NotFound, (await Client.GetAsync(new Uri("/api/applications/1/drafts", UriKind.Relative))).StatusCode);
    }

    [Fact]
    public async Task A_request_records_activity()
    {
        await ExecuteAsync("UPDATE app.Application SET LastActivityAt = DATEADD(day, -3, SYSUTCDATETIME()) WHERE Id = 1");

        await Client.GetAsync(new Uri("/api/applications/1/drafts", UriKind.Relative));

        Assert.True(await ScalarAsync<int>("SELECT DATEDIFF(minute, LastActivityAt, SYSUTCDATETIME()) FROM app.Application WHERE Id = 1") < 1);
    }

    [Fact]
    public async Task Saves_an_incomplete_draft_and_gives_it_back_as_sent()
    {
        var half = new JsonObject { ["purpose"] = 1006, ["loanAmount"] = null, ["address"] = "12 Smi" };

        var saved = await Client.PutAsync("/api/applications/1/drafts/loan-details", half);
        var again = await Client.PutAsync("/api/applications/1/drafts/loan-details", new JsonObject { ["purpose"] = 1001 });
        var drafts = await (await Client.GetAsync(new Uri("/api/applications/1/drafts", UriKind.Relative))).JsonAsync();

        Assert.Equal(HttpStatusCode.NoContent, saved.StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, again.StatusCode);
        Assert.Equal(1001, (int)drafts["loan-details"]!["data"]!["purpose"]!);
        Assert.Null(drafts["loan-details"]!["data"]!["address"]);
        Assert.NotNull(drafts["loan-details"]!["updatedAt"]);
        Assert.Null(drafts["about-you"]);
    }

    [Fact]
    public async Task Rejects_drafts_that_are_not_objects_or_too_large_or_for_an_unknown_step()
    {
        Assert.Equal(HttpStatusCode.BadRequest, (await Client.PutRawAsync("/api/applications/1/drafts/loan-details", "[1]")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await Client.PutAsync("/api/applications/1/drafts/loan-details",
            new JsonObject { ["a"] = new string('x', 40_000) })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await Client.PutAsync("/api/applications/1/drafts/income", new JsonObject())).StatusCode);
        Assert.Equal(0, await ScalarAsync<int>("SELECT COUNT(*) FROM app.ApplicationDraft"));
    }

    [Fact]
    public async Task Continue_replaces_the_draft_with_the_validated_answers()
    {
        await Client.PutAsync("/api/applications/1/drafts/loan-details", new JsonObject { ["purpose"] = 1006 });
        await Client.PutAsync("/api/applications/1/drafts/about-you", new JsonObject { ["applicants"] = new JsonArray() });

        await Client.SaveLoanDetailsAsync();
        var drafts = await Client.GetFromJsonAsync<Dictionary<string, JsonObject>>(new Uri("/api/applications/1/drafts", UriKind.Relative));

        Assert.Equal("about-you", Assert.Single(drafts!.Keys));
    }

    [Fact]
    public async Task A_failed_continue_keeps_the_draft()
    {
        await Client.PutAsync("/api/applications/1/drafts/loan-details", new JsonObject { ["purpose"] = 1006 });

        var invalid = TestApi.LoanDetailsBody();
        invalid["loanAmount"] = null;
        Assert.Equal(HttpStatusCode.BadRequest, (await Client.PutAsync(TestApi.LoanDetails, invalid)).StatusCode);

        Assert.Equal(1, await ScalarAsync<int>("SELECT COUNT(*) FROM app.ApplicationDraft WHERE Step = 'loan-details'"));
    }
}
