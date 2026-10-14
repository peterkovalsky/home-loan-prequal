using FluentValidation;
using HomeLoan.Application.Common;
using HomeLoan.Domain;
using Microsoft.Extensions.Options;

namespace HomeLoan.Application.Applicants;

/// <summary>
/// Field rules for each applicant, plus consent. Messages name the applicant and match the mock API.
/// The applicant count depends on the saved loan details, so the handler checks that.
/// </summary>
public sealed class SaveApplicantsRequestValidator : AbstractValidator<SaveApplicantsRequest>
{
    private static readonly Dictionary<DateOfBirthProblem, string> DateOfBirthMessages = new()
    {
        [DateOfBirthProblem.Invalid] = "enter a valid date of birth.",
        [DateOfBirthProblem.Future] = "date of birth cannot be in the future.",
        [DateOfBirthProblem.Underage] = $"every applicant must be {ApplicantRules.MinimumAge} or older.",
        [DateOfBirthProblem.TooOld] = "check the date of birth."
    };

    public SaveApplicantsRequestValidator(IOptions<ConsentOptions> consent, IBusinessClock clock)
    {
        ArgumentNullException.ThrowIfNull(consent);
        ArgumentNullException.ThrowIfNull(clock);
        var currentTerms = consent.Value.CurrentTermsVersion;

        RuleFor(x => x.Applicants).NotEmpty().WithMessage("Please add at least one applicant.");

        RuleFor(x => x).Custom((request, context) =>
        {
            var today = clock.Today;
            for (var index = 0; index < (request.Applicants?.Count ?? 0); index++)
            {
                foreach (var (field, message) in ValidateApplicant(request.Applicants![index], index, today))
                {
                    context.AddFailure(field.Length == 0 ? $"applicants[{index}]" : $"applicants[{index}].{field}", message);
                }
            }

            if (request.Consent?.Accepted != true)
            {
                context.AddFailure("consent", "You must agree to the pre-qualification and privacy terms.");
            }
            else if (request.Consent.TermsVersion != currentTerms)
            {
                context.AddFailure("consent", "Please agree to the latest pre-qualification and privacy terms.");
            }
        });
    }

    private static IEnumerable<(string Field, string Message)> ValidateApplicant(ApplicantDto? applicant, int index, DateOnly today)
    {
        var label = $"Applicant {index + 1}";
        if (applicant is null)
        {
            yield return ("", $"{label}: details are missing.");
            yield break;
        }
        if (applicant.Title is not { } title || !Enum.IsDefined(title))
        {
            yield return ("title", $"{label}: choose a title.");
        }
        if (!IsName(applicant.FirstName))
        {
            yield return ("firstName", $"{label}: enter a first name (up to {ApplicantRules.NameMaxLength} characters).");
        }
        if (!IsName(applicant.LastName))
        {
            yield return ("lastName", $"{label}: enter a last name (up to {ApplicantRules.NameMaxLength} characters).");
        }
        var hasEmail = !string.IsNullOrWhiteSpace(applicant.Email);
        if (hasEmail ? !EmailAddress.IsValid(applicant.Email) : index == 0)
        {
            yield return ("email", $"{label}: enter a valid email address.");
        }
        if (AuMobile.Normalise(applicant.Mobile) is null)
        {
            yield return ("mobile", $"{label}: enter a valid Australian mobile number.");
        }
        if (DateOfBirth.Check(applicant.DateOfBirth, today) is { } problem)
        {
            yield return ("dateOfBirth", $"{label}: {DateOfBirthMessages[problem]}");
        }
    }

    private static bool IsName(string? value) =>
        value?.Trim() is { Length: > 0 and <= ApplicantRules.NameMaxLength };
}
