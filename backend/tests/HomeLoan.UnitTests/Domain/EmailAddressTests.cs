using HomeLoan.Domain;

namespace HomeLoan.UnitTests.Domain;

public class EmailAddressTests
{
    [Theory]
    [InlineData("alex.taylor@example.com")]
    [InlineData(" a@b.co ")]
    public void Accepts_ordinary_addresses(string email) => Assert.True(EmailAddress.IsValid(email));

    [Theory]
    [InlineData("alex@example")]
    [InlineData("alex taylor@example.com")]
    [InlineData("")]
    [InlineData(null)]
    public void Rejects_malformed_addresses(string? email) => Assert.False(EmailAddress.IsValid(email));

    [Fact]
    public void Rejects_addresses_over_254_characters() =>
        Assert.False(EmailAddress.IsValid(new string('a', 250) + "@b.co"));
}
