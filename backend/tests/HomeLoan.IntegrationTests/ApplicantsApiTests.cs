using System.Net;
using System.Text.Json.Nodes;
using HomeLoan.IntegrationTests.Infrastructure;

namespace HomeLoan.IntegrationTests;

public sealed class ApplicantsApiTests(ApiFixture fixture) : ApiTest(fixture)
{
    [Fact]
    public async Task Needs_loan_details_first()
    {
        var response = await Client.PutAsync(TestApi.Applicants, TestApi.ApplicantsBody());

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task Saves_normalised_applicants_and_reads_them_back()
    {
        await Client.SaveLoanDetailsAsync(numberOfApplicants: 2);

        var created = await Client.PutAsync(TestApi.Applicants, TestApi.ApplicantsBody("2026-10",
            TestApi.Applicant(firstName: " Alex "),
            TestApi.Applicant(firstName: "Jordan", email: "", mobile: "+61 498 765 432")));
        var read = await Client.GetAsync(TestApi.Applicants);

        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        Assert.Equal(created.ETag(), read.ETag());
        var applicants = (await read.JsonAsync())["applicants"]!.AsArray();
        Assert.Equal(["Alex", "Jordan"], applicants.Select(a => (string)a!["firstName"]!));
        Assert.Equal(["0412345678", "0498765432"], applicants.Select(a => (string)a!["mobile"]!));
        Assert.Null(applicants[1]!["email"]);
        Assert.Equal([1, 2], applicants.Select(a => (int)a!["ordinal"]!));
    }

    [Fact]
    public async Task Replaces_the_set_keeping_ids_by_position_and_deleting_extras()
    {
        var loan = await Client.SaveLoanDetailsAsync(numberOfApplicants: 2);
        var two = await Client.PutAsync(TestApi.Applicants, TestApi.ApplicantsBody("2026-10", TestApi.Applicant(), TestApi.Applicant("Jordan")));
        var firstId = (int)(await two.JsonAsync())["applicants"]![0]!["id"]!;

        await Client.SaveLoanDetailsAsync(numberOfApplicants: 1, ifMatch: loan.ETag());
        var one = await Client.PutAsync(TestApi.Applicants, TestApi.ApplicantsBody("2026-10", TestApi.Applicant("Sam")), two.ETag());

        Assert.Equal(HttpStatusCode.OK, one.StatusCode);
        var applicants = (await one.JsonAsync())["applicants"]!.AsArray();
        Assert.Equal(firstId, (int)applicants.Single()!["id"]!);
        Assert.Equal("Sam", (string)applicants.Single()!["firstName"]!);
        Assert.Equal(1, await ScalarAsync<int>("SELECT COUNT(*) FROM app.Applicant WHERE ApplicationId = 1"));
    }

    [Fact]
    public async Task Saving_loan_details_does_not_invalidate_the_applicants_etag()
    {
        // Regression test for ai-log #4: each resource has its own version.
        var loan = await Client.SaveLoanDetailsAsync(numberOfApplicants: 1);
        var applicants = await Client.PutAsync(TestApi.Applicants, TestApi.ApplicantsBody());

        await Client.SaveLoanDetailsAsync(numberOfApplicants: 1, ifMatch: loan.ETag());
        var again = await Client.PutAsync(TestApi.Applicants, TestApi.ApplicantsBody(), applicants.ETag());

        Assert.Equal(HttpStatusCode.OK, again.StatusCode);
    }

    [Fact]
    public async Task Requires_the_number_of_applicants_the_loan_details_call_for()
    {
        await Client.SaveLoanDetailsAsync(numberOfApplicants: 3);

        var tooFew = await Client.PutAsync(TestApi.Applicants, TestApi.ApplicantsBody("2026-10", TestApi.Applicant(), TestApi.Applicant()));
        var tooMany = await Client.PutAsync(TestApi.Applicants, TestApi.ApplicantsBody("2026-10", Enumerable.Range(0, 5).Select(_ => TestApi.Applicant()).ToArray()));

        Assert.Contains("between 3 and 4", (await tooFew.ValidationErrorsAsync())["applicants"][0], StringComparison.Ordinal);
        Assert.Equal(HttpStatusCode.BadRequest, tooMany.StatusCode);
    }

    [Fact]
    public async Task Names_the_applicant_in_field_errors()
    {
        await Client.SaveLoanDetailsAsync(numberOfApplicants: 2);
        var underage = TestApi.Applicant("Kid");
        underage["dateOfBirth"] = DateTime.UtcNow.AddYears(-10).ToString("yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture);

        var errors = await (await Client.PutAsync(TestApi.Applicants, TestApi.ApplicantsBody("2026-10", TestApi.Applicant(email: null), underage))).ValidationErrorsAsync();

        Assert.Equal("Applicant 1: enter a valid email address.", errors["applicants[0].email"].Single());
        Assert.Equal("Applicant 2: every applicant must be 18 or older.", errors["applicants[1].dateOfBirth"].Single());
    }

    [Fact]
    public async Task Keeps_the_first_agreement_time_and_records_each_new_terms_version()
    {
        await Client.SaveLoanDetailsAsync();
        var first = await Client.PutAsync(TestApi.Applicants, TestApi.ApplicantsBody());
        var acceptedAt = (string)(await first.JsonAsync())["consent"]!["acceptedAt"]!;

        var same = await Client.PutAsync(TestApi.Applicants, TestApi.ApplicantsBody(), first.ETag());
        Assert.Equal(acceptedAt, (string)(await same.JsonAsync())["consent"]!["acceptedAt"]!);

        await using var newTerms = Fixture.CreateFactory(new Dictionary<string, string?> { ["Consent:CurrentTermsVersion"] = "2027-01" });
        using var client = newTerms.CreateClient();
        var oldVersion = await client.PutAsync(TestApi.Applicants, TestApi.ApplicantsBody(), same.ETag());
        var newVersion = await client.PutAsync(TestApi.Applicants, TestApi.ApplicantsBody("2027-01"), same.ETag());

        Assert.Equal(HttpStatusCode.BadRequest, oldVersion.StatusCode);
        Assert.Equal("2027-01", (string)(await newVersion.JsonAsync())["consent"]!["termsVersion"]!);
        Assert.Equal(2, await ScalarAsync<int>("SELECT COUNT(*) FROM app.ConsentRecord WHERE ApplicationId = 1"));
    }

    [Fact]
    public async Task Rejects_a_consent_that_was_not_given()
    {
        await Client.SaveLoanDetailsAsync();
        var body = TestApi.ApplicantsBody();
        body["consent"] = new JsonObject { ["accepted"] = false, ["termsVersion"] = "2026-10" };

        var errors = await (await Client.PutAsync(TestApi.Applicants, body)).ValidationErrorsAsync();

        Assert.Contains("consent", errors.Keys);
    }
}
