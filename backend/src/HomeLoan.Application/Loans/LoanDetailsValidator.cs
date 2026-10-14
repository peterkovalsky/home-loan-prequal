using FluentValidation;
using HomeLoan.Domain;

namespace HomeLoan.Application.Loans;

/// <summary>
/// Every rule the Loan details form applies, again on the server. Answers to questions that weren't
/// asked (household for one applicant, deposit when not buying, address vs state) must be null.
/// </summary>
public sealed class LoanDetailsValidator : AbstractValidator<LoanDetailsDto>
{
    public LoanDetailsValidator()
    {
        RuleFor(x => x.Purpose)
            .NotNull().WithMessage("Please tell us what the loan is for.")
            .IsInEnum().WithMessage("Please choose a valid loan purpose.");
        RuleFor(x => x.PropertyUsage)
            .NotNull().WithMessage("Please choose how the property will be used.")
            .IsInEnum().WithMessage("Please choose a valid property use.");
        RuleFor(x => x.NumberOfApplicants)
            .NotNull().WithMessage("Please tell us who is applying.")
            .IsInEnum().WithMessage("Please choose a valid number of applicants.");

        RuleFor(x => x.IsSameHousehold)
            .NotNull().WithMessage("Please tell us whether you all live in the same household.")
            .When(x => x.NumberOfApplicants is NumberOfApplicants.Couple or NumberOfApplicants.More);
        RuleFor(x => x.IsSameHousehold)
            .Null().WithMessage("The household question only applies when more than one person is applying.")
            .When(x => x.NumberOfApplicants is NumberOfApplicants.Single);

        RuleFor(x => x.NumberOfDependants)
            .NotNull().WithMessage("Please enter the number of dependants.")
            .InclusiveBetween(0, LoanRules.MaxDependants).WithMessage($"Number of dependants must be between 0 and {LoanRules.MaxDependants}.");

        RuleFor(x => x.LoanAmount)
            .NotNull().WithMessage("Please enter the amount you want to borrow.")
            .GreaterThan(0).WithMessage("Loan amount must be greater than zero.")
            .LessThanOrEqualTo(LoanRules.MaxAmount).WithMessage("Loan amount is higher than we can pre-qualify.");
        RuleFor(x => x.EstimatedPropertyValue)
            .NotNull().WithMessage("Please enter an estimated property value.")
            .GreaterThan(0).WithMessage("Estimated property value must be greater than zero.")
            .LessThanOrEqualTo(LoanRules.MaxAmount).WithMessage("Estimated property value is higher than we can pre-qualify.");

        When(x => x.Purpose is { } purpose && LendingPurposes.IsPurchase(purpose), () =>
        {
            RuleFor(x => x.Deposit)
                .NotNull().WithMessage("Please enter your deposit.")
                .GreaterThanOrEqualTo(0).WithMessage("Deposit cannot be negative.");
            RuleFor(x => x.Deposit)
                .LessThanOrEqualTo(x => x.EstimatedPropertyValue)
                .When(x => x.Deposit is not null && x.EstimatedPropertyValue is not null)
                .WithMessage("Your deposit can't be more than the property value.");
        }).Otherwise(() =>
            RuleFor(x => x.Deposit).Null().WithMessage("A deposit only applies when buying or building."));

        RuleFor(x => x.IsAddressKnown).NotNull().WithMessage("Please tell us whether you know the property address.");
        When(x => x.IsAddressKnown == true, () =>
        {
            RuleFor(x => x.Address)
                .Must(address => !string.IsNullOrWhiteSpace(address)).WithMessage("Please enter the property address.")
                .MaximumLength(LoanRules.AddressMaxLength).WithMessage($"Address must be {LoanRules.AddressMaxLength} characters or fewer.");
            RuleFor(x => x.State).Null().WithMessage("Leave the state empty when the address is known.");
        });
        When(x => x.IsAddressKnown == false, () =>
        {
            RuleFor(x => x.State)
                .NotNull().WithMessage("Please select a state.")
                .IsInEnum().WithMessage("Please select a valid state.");
            RuleFor(x => x.Address).Null().WithMessage("Leave the address empty when it isn't known.");
        });
    }
}
