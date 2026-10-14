using System.Net;
using HomeLoan.IntegrationTests.Infrastructure;

namespace HomeLoan.IntegrationTests;

/// <summary>Real concurrent requests against the real database: exactly one writer wins.</summary>
public sealed class ConcurrencyTests(ApiFixture fixture) : ApiTest(fixture)
{
    // RACE_ROUNDS raises this locally to hunt for rare interleavings.
    private static readonly int Rounds = int.TryParse(Environment.GetEnvironmentVariable("RACE_ROUNDS"), out var n) ? n : 20;

    [Fact]
    public async Task Two_updates_with_the_same_etag_produce_one_success_and_one_412()
    {
        for (var round = 0; round < Rounds; round++)
        {
            await Fixture.ResetAsync();
            await Client.SaveLoanDetailsAsync(numberOfApplicants: 1);
            var created = await Client.PutAsync(TestApi.Applicants, TestApi.ApplicantsBody());

            using var second = Fixture.Factory.CreateClient();
            var results = await Task.WhenAll(
                Client.PutAsync(TestApi.Applicants, TestApi.ApplicantsBody("2026-10", TestApi.Applicant("First")), created.ETag()),
                second.PutAsync(TestApi.Applicants, TestApi.ApplicantsBody("2026-10", TestApi.Applicant("Second")), created.ETag()));

            Assert.True(
                results.Select(r => r.StatusCode).Order().SequenceEqual([HttpStatusCode.OK, HttpStatusCode.PreconditionFailed]),
                $"Round {round}: {string.Join(", ", results.Select(r => (int)r.StatusCode))}: {await results[0].Content.ReadAsStringAsync()} | {await results[1].Content.ReadAsStringAsync()}");
            var winner = results.Single(r => r.StatusCode == HttpStatusCode.OK);
            var stored = await ScalarAsync<string>("SELECT FirstName FROM app.Applicant WHERE ApplicationId = 1");
            Assert.Equal((string)(await winner.JsonAsync())["applicants"]![0]!["firstName"]!, stored);
        }
    }

    [Fact]
    public async Task Two_first_saves_produce_one_201_and_one_412()
    {
        for (var round = 0; round < Rounds; round++)
        {
            await Fixture.ResetAsync();
            using var second = Fixture.Factory.CreateClient();

            var results = await Task.WhenAll(
                Client.PutAsync(TestApi.LoanDetails, TestApi.LoanDetailsBody(1)),
                second.PutAsync(TestApi.LoanDetails, TestApi.LoanDetailsBody(2)));

            Assert.Equal(
                [HttpStatusCode.Created, HttpStatusCode.PreconditionFailed],
                results.Select(r => r.StatusCode).Order());
            Assert.Equal(1, await ScalarAsync<int>("SELECT COUNT(*) FROM app.LoanDetails"));
        }
    }
}
