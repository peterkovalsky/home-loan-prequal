using HomeLoan.IntegrationTests.Infrastructure;
using HomeLoan.Migrations;

namespace HomeLoan.IntegrationTests;

public sealed class RetentionTests(ApiFixture fixture) : ApiTest(fixture)
{
    [Fact]
    public async Task Purges_inactive_unfinished_applications_and_inactive_drafts_but_keeps_finished_ones()
    {
        // Application 1: finished (About you saved), then edited again: has a draft.
        await Client.SaveLoanDetailsAsync();
        await Client.PutAsync(TestApi.Applicants, TestApi.ApplicantsBody());
        await Client.PutAsync("/api/applications/1/drafts/about-you", new System.Text.Json.Nodes.JsonObject());
        await ExecuteAsync("""
            INSERT INTO app.Application (Id, LastActivityAt) VALUES (2, DATEADD(day, -8, SYSUTCDATETIME()));
            INSERT INTO app.ApplicationDraft (ApplicationId, Step, Data) VALUES (2, 'loan-details', '{}');
            INSERT INTO app.Application (Id, LastActivityAt) VALUES (3, DATEADD(day, -6, SYSUTCDATETIME()));
            INSERT INTO app.ApplicationDraft (ApplicationId, Step, Data) VALUES (3, 'loan-details', '{}');
            UPDATE app.Application SET LastActivityAt = DATEADD(day, -8, SYSUTCDATETIME()) WHERE Id = 1;
            """);

        var summary = DataRetention.PurgeExpired(Fixture.AdminConnectionString, expiryDays: 7);

        Assert.Equal(new PurgeSummary(DraftsDeleted: 2, ApplicationsDeleted: 1), summary);
        Assert.Equal("1,3", await ScalarAsync<string>("SELECT STRING_AGG(CAST(Id AS varchar), ',') WITHIN GROUP (ORDER BY Id) FROM app.Application"));
        Assert.Equal(3, await ScalarAsync<int>("SELECT ApplicationId FROM app.ApplicationDraft"));
        Assert.Equal(1, await ScalarAsync<int>("SELECT COUNT(*) FROM app.ApplicantSet WHERE ApplicationId = 1"));
    }
}
