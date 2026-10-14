using HomeLoan.Domain;

namespace HomeLoan.UnitTests.Domain;

// Same table as frontend/src/app/shared/validation/applicant-rules.spec.ts.
public class AuMobileTests
{
    [Theory]
    [InlineData("0412345678")]
    [InlineData("0412 345 678")]
    [InlineData("+61 412 345 678")]
    [InlineData("61412345678")]
    [InlineData("+61 0412 345 678")]
    [InlineData("(04) 1234-5678")]
    public void Normalise_accepts_common_formats(string raw) => Assert.Equal("0412345678", AuMobile.Normalise(raw));

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("0212345678")]
    [InlineData("041234567")]
    [InlineData("04123456789")]
    [InlineData("0412abc678")]
    [InlineData("+1 412 345 678")]
    [InlineData("412345678")]
    public void Normalise_rejects_non_mobiles(string? raw) => Assert.Null(AuMobile.Normalise(raw));
}
