using HomeLoan.Domain;

namespace HomeLoan.UnitTests.Domain;

public class DateOfBirthTests
{
    private static readonly DateOnly Today = new(2026, 10, 14);

    [Theory]
    [InlineData("2023-02-30")]
    [InlineData("01/01/1990")]
    [InlineData("1990-1-1")]
    [InlineData("")]
    public void Parse_rejects_impossible_or_non_iso_dates(string value) => Assert.Null(DateOfBirth.Parse(value));

    [Fact]
    public void AgeOn_counts_a_birthday_that_falls_today() =>
        Assert.Equal(18, DateOfBirth.AgeOn(new DateOnly(2008, 10, 14), Today));

    [Fact]
    public void AgeOn_does_not_count_a_birthday_tomorrow() =>
        Assert.Equal(17, DateOfBirth.AgeOn(new DateOnly(2008, 10, 15), Today));

    [Fact]
    public void AgeOn_treats_29_February_as_reached_on_1_March()
    {
        var dob = new DateOnly(2008, 2, 29);
        Assert.Equal(17, DateOfBirth.AgeOn(dob, new DateOnly(2026, 2, 28)));
        Assert.Equal(18, DateOfBirth.AgeOn(dob, new DateOnly(2026, 3, 1)));
    }

    [Theory]
    [InlineData("2008-10-14", null)]
    [InlineData("2008-10-15", DateOfBirthProblem.Underage)]
    [InlineData("2027-01-01", DateOfBirthProblem.Future)]
    [InlineData("1905-01-01", DateOfBirthProblem.TooOld)]
    [InlineData("1906-10-14", null)]
    [InlineData("not-a-date", DateOfBirthProblem.Invalid)]
    public void Check_explains_what_is_wrong(string value, DateOfBirthProblem? expected) =>
        Assert.Equal(expected, DateOfBirth.Check(value, Today));
}
