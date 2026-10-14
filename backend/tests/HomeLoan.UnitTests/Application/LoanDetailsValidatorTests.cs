using HomeLoan.Application.Loans;
using HomeLoan.Domain;

namespace HomeLoan.UnitTests.Application;

public class LoanDetailsValidatorTests
{
    private readonly LoanDetailsValidator validator = new();

    private string[] FailedFields(LoanDetailsDto dto) =>
        validator.Validate(dto).Errors.Select(e => e.PropertyName).Distinct().Order().ToArray();

    [Fact]
    public void Accepts_complete_refinance_and_purchase_answers()
    {
        Assert.Empty(FailedFields(Samples.Refinance()));
        Assert.Empty(FailedFields(Samples.Purchase()));
        Assert.Empty(FailedFields(Samples.Refinance(NumberOfApplicants.More)));
    }

    [Fact]
    public void Reports_every_missing_answer_instead_of_defaulting_it() =>
        Assert.Equal(
            ["EstimatedPropertyValue", "IsAddressKnown", "LoanAmount", "NumberOfApplicants", "NumberOfDependants", "PropertyUsage", "Purpose"],
            FailedFields(new LoanDetailsDto()));

    [Fact]
    public void Rejects_unknown_codes() =>
        Assert.Equal(["Purpose", "State"], FailedFields(Samples.Refinance() with { Purpose = (LendingPurpose)9, State = (AuState)1 }));

    [Fact]
    public void Asks_about_the_household_only_when_more_than_one_person_applies()
    {
        Assert.Equal(["IsSameHousehold"], FailedFields(Samples.Refinance(NumberOfApplicants.Couple) with { IsSameHousehold = null }));
        Assert.Equal(["IsSameHousehold"], FailedFields(Samples.Refinance() with { IsSameHousehold = false }));
    }

    [Fact]
    public void Requires_a_deposit_only_when_buying_and_never_more_than_the_property_value()
    {
        Assert.Equal(["Deposit"], FailedFields(Samples.Purchase() with { Deposit = null }));
        Assert.Equal(["Deposit"], FailedFields(Samples.Purchase() with { Deposit = 900_001m }));
        Assert.Equal(["Deposit"], FailedFields(Samples.Refinance() with { Deposit = 10_000m }));
        Assert.Empty(FailedFields(Samples.Purchase() with { Deposit = 900_000m }));
    }

    [Fact]
    public void Takes_either_an_address_or_a_state_never_both()
    {
        var known = Samples.Refinance() with { IsAddressKnown = true, Address = "1 Test St", State = null };
        Assert.Empty(FailedFields(known));
        Assert.Equal(["State"], FailedFields(known with { State = AuState.VIC }));
        Assert.Equal(["Address"], FailedFields(known with { Address = "   " }));
        Assert.Equal(["Address"], FailedFields(known with { Address = new string('a', 201) }));
        Assert.Equal(["Address"], FailedFields(Samples.Refinance() with { Address = "1 Test St" }));
        Assert.Equal(["State"], FailedFields(Samples.Refinance() with { State = null }));
    }

    [Theory]
    [InlineData(-1)]
    [InlineData(21)]
    public void Keeps_dependants_between_0_and_20(int dependants) =>
        Assert.Equal(["NumberOfDependants"], FailedFields(Samples.Refinance() with { NumberOfDependants = dependants }));

    [Fact]
    public void Caps_amounts_at_100_million_and_requires_them_to_be_positive()
    {
        Assert.Equal(["LoanAmount"], FailedFields(Samples.Refinance() with { LoanAmount = 0m }));
        Assert.Equal(["LoanAmount"], FailedFields(Samples.Refinance() with { LoanAmount = 100_000_000.01m }));
        Assert.Equal(["EstimatedPropertyValue"], FailedFields(Samples.Refinance() with { EstimatedPropertyValue = -5m }));
    }
}
