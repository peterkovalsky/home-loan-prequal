using System.Net;
using HomeLoan.IntegrationTests.Infrastructure;

namespace HomeLoan.IntegrationTests;

public sealed class LoanDetailsApiTests(ApiFixture fixture) : ApiTest(fixture)
{
    [Fact]
    public async Task Returns_404_until_saved()
    {
        var response = await Client.GetAsync(TestApi.LoanDetails);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task Creates_with_201_and_reads_back_the_same_details_and_etag()
    {
        var created = await Client.PutAsync(TestApi.LoanDetails, TestApi.LoanDetailsBody(numberOfApplicants: 2));
        var read = await Client.GetAsync(TestApi.LoanDetails);

        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        Assert.Equal(TestApi.LoanDetails, created.Headers.Location?.OriginalString);
        Assert.Equal(created.ETag(), read.ETag());
        var body = await read.JsonAsync();
        Assert.Equal(1, (int)body["applicationId"]!);
        Assert.Equal(2, (int)body["numberOfApplicants"]!);
        Assert.True((bool)body["isSameHousehold"]!);
        Assert.Equal(500000m, (decimal)body["loanAmount"]!);
    }

    [Fact]
    public async Task Updates_only_with_the_current_etag()
    {
        var created = await Client.SaveLoanDetailsAsync();

        var withoutIfMatch = await Client.PutAsync(TestApi.LoanDetails, TestApi.LoanDetailsBody());
        var updated = await Client.PutAsync(TestApi.LoanDetails, TestApi.LoanDetailsBody(numberOfApplicants: 2), created.ETag());
        var stale = await Client.PutAsync(TestApi.LoanDetails, TestApi.LoanDetailsBody(), created.ETag());

        Assert.Equal(HttpStatusCode.PreconditionRequired, withoutIfMatch.StatusCode);
        Assert.Equal(HttpStatusCode.OK, updated.StatusCode);
        Assert.NotEqual(created.ETag(), updated.ETag());
        Assert.Equal(HttpStatusCode.PreconditionFailed, stale.StatusCode);
    }

    [Fact]
    public async Task Treats_if_match_on_a_missing_resource_as_stale()
    {
        var response = await Client.PutAsync(TestApi.LoanDetails, TestApi.LoanDetailsBody(), "\"00000000000007D1\"");

        Assert.Equal(HttpStatusCode.PreconditionFailed, response.StatusCode);
    }

    [Fact]
    public async Task Returns_field_errors_with_a_correlation_id()
    {
        var body = TestApi.LoanDetailsBody();
        body["deposit"] = 10000;
        body["state"] = null;

        var response = await Client.PutAsync(TestApi.LoanDetails, body);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var errors = await response.ValidationErrorsAsync();
        Assert.Equal(["deposit", "state"], errors.Keys.Order());
        Assert.NotNull((await Client.PutAsync(TestApi.LoanDetails, body)).Headers.GetValues("X-Correlation-Id").Single());
    }

    [Fact]
    public async Task Rejects_a_body_id_that_does_not_match_the_url()
    {
        var body = TestApi.LoanDetailsBody();
        body["applicationId"] = 2;

        var errors = await (await Client.PutAsync(TestApi.LoanDetails, body)).ValidationErrorsAsync();

        Assert.Contains("applicationId", errors.Keys);
    }

    [Theory]
    [InlineData("{\"purpose\":")]
    [InlineData("not json")]
    [InlineData("")]
    public async Task Answers_malformed_bodies_with_400_not_500(string json)
    {
        var response = await Client.PutRawAsync(TestApi.LoanDetails, json);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
    }

    [Theory]
    [InlineData("/api/applications/0/loan-details")]
    [InlineData("/api/applications/abc/loan-details")]
    public async Task Does_not_route_invalid_application_ids(string url) =>
        Assert.Equal(HttpStatusCode.NotFound, (await Client.GetAsync(url)).StatusCode);
}
