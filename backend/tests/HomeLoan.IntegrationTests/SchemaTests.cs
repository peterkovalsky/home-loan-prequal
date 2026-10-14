using Dapper;
using HomeLoan.Domain;
using HomeLoan.IntegrationTests.Infrastructure;
using Microsoft.Data.SqlClient;

namespace HomeLoan.IntegrationTests;

/// <summary>The database protects its own integrity, whatever the API does.</summary>
public sealed class SchemaTests(ApiFixture fixture) : ApiTest(fixture)
{
    private const string ValidLoan = """
        INSERT app.Application (Id) VALUES (1);
        INSERT app.LoanDetails (ApplicationId, PurposeCode, PropertyUsageCode, ApplicantCountCode, IsSameHousehold,
            NumberOfDependants, LoanAmount, Deposit, EstimatedPropertyValue, IsAddressKnown, Address, StateCode)
        """;

    private const string ValidApplicantSet = """
        INSERT app.Application (Id) VALUES (1);
        INSERT app.ApplicantSet (ApplicationId) VALUES (1);
        INSERT app.Applicant (ApplicationId, Ordinal, TitleCode, FirstName, LastName, Email, Mobile, DateOfBirth)
        """;

    public static TheoryData<string, string> Violations() => new()
    {
        { "CK_LoanDetails_Household", ValidLoan + " VALUES (1, 1006, 1003, 1, 1, 0, 1, NULL, 2, 0, NULL, 1001)" },
        { "CK_LoanDetails_AddressOrState", ValidLoan + " VALUES (1, 1006, 1003, 1, NULL, 0, 1, NULL, 2, 1, N'1 Test St', 1001)" },
        { "CK_LoanDetails_Deposit", ValidLoan + " VALUES (1, 1003, 1003, 1, NULL, 0, 1, 3, 2, 0, NULL, 1001)" },
        { "CK_LoanDetails_Dependants", ValidLoan + " VALUES (1, 1006, 1003, 1, NULL, 21, 1, NULL, 2, 0, NULL, 1001)" },
        { "CK_LoanDetails_Amounts", ValidLoan + " VALUES (1, 1006, 1003, 1, NULL, 0, 0, NULL, 2, 0, NULL, 1001)" },
        { "FK_LoanDetails_Purpose", ValidLoan + " VALUES (1, 9999, 1003, 1, NULL, 0, 1, NULL, 2, 0, NULL, 1001)" },
        { "FK_LoanDetails_Application", "INSERT app.LoanDetails (ApplicationId, PurposeCode, PropertyUsageCode, ApplicantCountCode, NumberOfDependants, LoanAmount, EstimatedPropertyValue, IsAddressKnown, StateCode) VALUES (42, 1006, 1003, 1, 0, 1, 2, 0, 1001)" },
        { "CK_Applicant_PrimaryEmail", ValidApplicantSet + " VALUES (1, 1, 1, N'A', N'B', NULL, '0412345678', '1990-01-01')" },
        { "CK_Applicant_Mobile", ValidApplicantSet + " VALUES (1, 1, 1, N'A', N'B', N'a@b.co', '0212345678', '1990-01-01')" },
        { "CK_Applicant_Names", ValidApplicantSet + " VALUES (1, 1, 1, N'  ', N'B', N'a@b.co', '0412345678', '1990-01-01')" },
        { "CK_Applicant_Ordinal", ValidApplicantSet + " VALUES (1, 11, 1, N'A', N'B', N'a@b.co', '0412345678', '1990-01-01')" },
        { "FK_Applicant_Title", ValidApplicantSet + " VALUES (1, 1, 99, N'A', N'B', N'a@b.co', '0412345678', '1990-01-01')" },
        { "UX_Applicant_ApplicationId_Ordinal", ValidApplicantSet + " VALUES (1, 1, 1, N'A', N'B', N'a@b.co', '0412345678', '1990-01-01'), (1, 1, 1, N'C', N'D', N'c@d.co', '0412345678', '1990-01-01')" },
        { "UQ_ConsentRecord_ApplicationId_TermsVersion", "INSERT app.Application (Id) VALUES (1); INSERT app.ConsentRecord (ApplicationId, TermsVersion) VALUES (1, 'v1'), (1, 'v1')" },
        { "CK_Application_Id", "INSERT app.Application (Id) VALUES (0)" }
    };

    [Theory]
    [MemberData(nameof(Violations))]
    public async Task Rejects_rows_that_break_a_rule(string constraint, string sql)
    {
        await using var connection = new SqlConnection(Fixture.AdminConnectionString);

        var error = await Assert.ThrowsAsync<SqlException>(() => connection.ExecuteAsync(sql));

        Assert.Contains(constraint, error.Message, StringComparison.Ordinal);
    }

    [Theory]
    [InlineData("ref.LendingPurpose", typeof(LendingPurpose))]
    [InlineData("ref.PropertyUsage", typeof(PropertyUsage))]
    [InlineData("ref.ApplicantCount", typeof(NumberOfApplicants))]
    [InlineData("ref.AuState", typeof(AuState))]
    [InlineData("ref.Title", typeof(Title))]
    public async Task Seeds_exactly_the_codes_the_code_knows(string table, Type enumType)
    {
        await using var connection = new SqlConnection(Fixture.AdminConnectionString);

        var codes = (await connection.QueryAsync<int>($"SELECT CAST(Code AS int) FROM {table} ORDER BY Code")).ToArray();

        Assert.Equal(Enum.GetValues(enumType).Cast<int>().Order(), codes);
    }

    [Fact]
    public async Task Purchase_flags_match_the_domain_rule()
    {
        await using var connection = new SqlConnection(Fixture.AdminConnectionString);

        var purchase = await connection.QueryAsync<int>("SELECT CAST(Code AS int) FROM ref.LendingPurpose WHERE IsPurchase = 1 ORDER BY Code");

        Assert.Equal(Enum.GetValues<LendingPurpose>().Where(LendingPurposes.IsPurchase).Cast<int>().Order(), purchase);
    }

    [Fact]
    public async Task The_app_login_can_read_and_write_data_but_not_change_the_schema()
    {
        await using var connection = new SqlConnection(Fixture.AppConnectionString);

        await connection.ExecuteAsync("INSERT app.Application (Id) VALUES (7); DELETE app.Application WHERE Id = 7;");
        var error = await Assert.ThrowsAsync<SqlException>(() => connection.ExecuteAsync("CREATE TABLE app.Nope (Id int)"));

        Assert.Contains("permission denied", error.Message, StringComparison.OrdinalIgnoreCase);
    }
}
