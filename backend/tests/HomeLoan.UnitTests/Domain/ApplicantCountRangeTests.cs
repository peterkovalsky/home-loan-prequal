using HomeLoan.Domain;

namespace HomeLoan.UnitTests.Domain;

public class ApplicantCountRangeTests
{
    [Theory]
    [InlineData(NumberOfApplicants.Single, 1, 1)]
    [InlineData(NumberOfApplicants.Couple, 2, 2)]
    [InlineData(NumberOfApplicants.More, 3, 4)]
    public void Maps_each_answer_to_a_range(NumberOfApplicants answer, int min, int max) =>
        Assert.Equal(new ApplicantCountRange(min, max), ApplicantCountRange.For(answer, maxApplicants: 4));

    [Fact]
    public void More_than_two_never_drops_below_three() =>
        Assert.Equal(new ApplicantCountRange(3, 3), ApplicantCountRange.For(NumberOfApplicants.More, maxApplicants: 2));

    [Fact]
    public void Rejects_an_unknown_answer() =>
        Assert.Throws<ArgumentOutOfRangeException>(() => ApplicantCountRange.For((NumberOfApplicants)9, 4));
}
