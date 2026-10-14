using HomeLoan.Application.Common;

namespace HomeLoan.UnitTests.Application;

public class ConcurrencyTokenTests
{
    [Fact]
    public void Round_trips_through_a_quoted_hex_etag()
    {
        var token = Versions.Of(2003);

        Assert.Equal("\"00000000000007D3\"", token.ToETag());
        Assert.Equal(token, ConcurrencyToken.FromETag(token.ToETag()));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("*")]
    [InlineData("00000000000007D3")]
    [InlineData("W/\"00000000000007D3\"")]
    [InlineData("\"00000000000007D3\", \"00000000000007D4\"")]
    [InlineData("\"ZZZZZZZZZZZZZZZZ\"")]
    public void Rejects_anything_but_one_strong_etag(string? etag) => Assert.Null(ConcurrencyToken.FromETag(etag));
}
