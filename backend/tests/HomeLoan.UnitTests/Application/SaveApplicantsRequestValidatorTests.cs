using HomeLoan.Application.Applicants;
using HomeLoan.Application.Common;
using Microsoft.Extensions.Options;

namespace HomeLoan.UnitTests.Application;

public class SaveApplicantsRequestValidatorTests
{
    private static SaveApplicantsRequestValidator Validator(BusinessClock? clock = null) =>
        new(Options.Create(new ConsentOptions { CurrentTermsVersion = "2026-10" }), clock ?? TestClock.Default);

    private static Dictionary<string, string> Errors(SaveApplicantsRequest request, BusinessClock? clock = null) =>
        Validator(clock).Validate(request).Errors.ToDictionary(e => e.PropertyName, e => e.ErrorMessage);

    [Fact]
    public void Accepts_valid_applicants_with_an_optional_second_email() =>
        Assert.Empty(Errors(Samples.Request(Samples.Alex(), Samples.Jordan())));

    [Fact]
    public void Names_the_applicant_and_field_for_each_problem()
    {
        var errors = Errors(Samples.Request(
            Samples.Alex() with { Email = null },
            Samples.Jordan() with { Title = (HomeLoan.Domain.Title)9, FirstName = " ", Mobile = "0212345678", DateOfBirth = "2015-01-01" }));

        Assert.Equal(new Dictionary<string, string>
        {
            ["applicants[0].email"] = "Applicant 1: enter a valid email address.",
            ["applicants[1].title"] = "Applicant 2: choose a title.",
            ["applicants[1].firstName"] = "Applicant 2: enter a first name (up to 50 characters).",
            ["applicants[1].mobile"] = "Applicant 2: enter a valid Australian mobile number.",
            ["applicants[1].dateOfBirth"] = "Applicant 2: every applicant must be 18 or older."
        }, errors);
    }

    [Fact]
    public void Validates_a_second_applicants_email_when_one_is_given() =>
        Assert.Contains("applicants[1].email", Errors(Samples.Request(Samples.Alex(), Samples.Jordan() with { Email = "jordan@" })).Keys);

    [Fact]
    public void Rejects_missing_applicants_and_null_entries()
    {
        Assert.Contains("Applicants", Errors(new SaveApplicantsRequest { Consent = Samples.Request().Consent }).Keys);
        Assert.Contains("applicants[1]", Errors(Samples.Request(Samples.Alex(), null)).Keys);
    }

    [Fact]
    public void Requires_agreement_to_the_current_terms()
    {
        var notAgreed = Samples.Request(Samples.Alex()) with { Consent = new ConsentDto { Accepted = false, TermsVersion = "2026-10" } };
        var oldTerms = Samples.Request(Samples.Alex()) with { Consent = new ConsentDto { Accepted = true, TermsVersion = "2025-01" } };

        Assert.Contains("must agree", Errors(notAgreed)["consent"], StringComparison.Ordinal);
        Assert.Contains("latest", Errors(oldTerms)["consent"], StringComparison.Ordinal);
    }

    [Fact]
    public void Uses_the_Sydney_date_for_the_minimum_age()
    {
        // 13 Oct 14:00 UTC is already 14 Oct (01:00) in Sydney: the 18th birthday has arrived there.
        var clock = TestClock.At(new DateTimeOffset(2026, 10, 13, 14, 0, 0, TimeSpan.Zero));
        var turns18Today = Samples.Request(Samples.Alex() with { DateOfBirth = "2008-10-14" });

        Assert.Equal(new DateOnly(2026, 10, 14), clock.Today);
        Assert.Empty(Errors(turns18Today, clock));
    }
}
