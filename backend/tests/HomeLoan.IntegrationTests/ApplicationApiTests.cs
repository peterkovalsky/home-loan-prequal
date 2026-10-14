using System.Net;
using HomeLoan.IntegrationTests.Infrastructure;

namespace HomeLoan.IntegrationTests;

public sealed class ApplicationApiTests(ApiFixture fixture) : ApiTest(fixture)
{
    [Fact]
    public async Task Delete_removes_everything_saved_and_is_idempotent()
    {
        await Client.SaveLoanDetailsAsync();
        await Client.PutAsync(TestApi.Applicants, TestApi.ApplicantsBody());

        var first = await Client.DeleteAsync("/api/applications/1");
        var again = await Client.DeleteAsync("/api/applications/1");

        Assert.Equal(HttpStatusCode.NoContent, first.StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, again.StatusCode);
        Assert.Equal(0, await ScalarAsync<int>("""
            SELECT (SELECT COUNT(*) FROM app.Application) + (SELECT COUNT(*) FROM app.LoanDetails)
                 + (SELECT COUNT(*) FROM app.ApplicantSet) + (SELECT COUNT(*) FROM app.Applicant)
                 + (SELECT COUNT(*) FROM app.ConsentRecord)
            """));
    }

    [Fact]
    public async Task Reports_ready_when_the_database_is_reachable() =>
        Assert.Equal(HttpStatusCode.OK, (await Client.GetAsync("/health/ready")).StatusCode);

    [Fact]
    public async Task Allows_the_front_end_origin_and_exposes_the_etag()
    {
        using var preflight = new HttpRequestMessage(HttpMethod.Options, TestApi.Applicants);
        preflight.Headers.Add("Origin", "http://localhost:4200");
        preflight.Headers.Add("Access-Control-Request-Method", "PUT");
        preflight.Headers.Add("Access-Control-Request-Headers", "if-match,content-type");

        var response = await Client.SendAsync(preflight);
        var get = new HttpRequestMessage(HttpMethod.Get, TestApi.LoanDetails);
        get.Headers.Add("Origin", "http://localhost:4200");
        var actual = await Client.SendAsync(get);

        Assert.Equal("http://localhost:4200", response.Headers.GetValues("Access-Control-Allow-Origin").Single());
        Assert.Contains("ETag", actual.Headers.GetValues("Access-Control-Expose-Headers").Single(), StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Does_not_allow_other_origins()
    {
        using var preflight = new HttpRequestMessage(HttpMethod.Options, TestApi.Applicants);
        preflight.Headers.Add("Origin", "https://evil.example");
        preflight.Headers.Add("Access-Control-Request-Method", "PUT");

        var response = await Client.SendAsync(preflight);

        Assert.False(response.Headers.Contains("Access-Control-Allow-Origin"));
    }
}
