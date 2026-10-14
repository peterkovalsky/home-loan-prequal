using HomeLoan.Application.Applicants;
using HomeLoan.Application.Loans;
using HomeLoan.Domain;

namespace HomeLoan.UnitTests.Application;

internal static class Samples
{
    public static LoanDetailsDto Refinance(NumberOfApplicants applicants = NumberOfApplicants.Single) => new()
    {
        Purpose = LendingPurpose.Refinance,
        PropertyUsage = PropertyUsage.OwnerOccupied,
        NumberOfApplicants = applicants,
        IsSameHousehold = applicants == NumberOfApplicants.Single ? null : true,
        NumberOfDependants = 0,
        LoanAmount = 500_000m,
        Deposit = null,
        EstimatedPropertyValue = 900_000m,
        IsAddressKnown = false,
        Address = null,
        State = AuState.NSW
    };

    public static LoanDetailsDto Purchase() => Refinance() with
    {
        Purpose = LendingPurpose.PurchaseExistingDwelling,
        Deposit = 150_000m
    };

    public static ApplicantDto Alex() => new()
    {
        Title = Title.Mr,
        FirstName = " Alex ",
        LastName = "Taylor",
        Email = "alex.taylor@example.com",
        Mobile = "0412 345 678",
        DateOfBirth = "1988-03-14"
    };

    public static ApplicantDto Jordan() => new()
    {
        Title = Title.Ms,
        FirstName = "Jordan",
        LastName = "Taylor",
        Email = "",
        Mobile = "+61 498 765 432",
        DateOfBirth = "1990-07-02"
    };

    public static SaveApplicantsRequest Request(params ApplicantDto?[] applicants) => new()
    {
        Applicants = applicants,
        Consent = new ConsentDto { Accepted = true, TermsVersion = "2026-10" }
    };
}
