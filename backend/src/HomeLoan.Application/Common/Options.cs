using System.ComponentModel.DataAnnotations;

namespace HomeLoan.Application.Common;

public sealed class ApplicantOptions
{
    public const string Section = "Applicants";

    /// <summary>Upper limit for "more than two". Keep in step with the front end's config.json.</summary>
    [Range(3, 10)]
    public int MaxApplicants { get; set; } = 4;
}

public sealed class ConsentOptions
{
    public const string Section = "Consent";

    /// <summary>Applicants must agree to exactly this version. Keep in step with the front end's config.json.</summary>
    [Required]
    [StringLength(20, MinimumLength = 1)]
    public string CurrentTermsVersion { get; set; } = string.Empty;
}

public sealed class ClockOptions
{
    public const string Section = "Clock";

    /// <summary>"Today" for age rules is the customer's date, not UTC's.</summary>
    [Required]
    public string TimeZone { get; set; } = "Australia/Sydney";
}

public sealed class ApplicationOptions
{
    public const string Section = "Applications";

    /// <summary>An application unused for this long can't be resumed, and unfinished ones are purged.</summary>
    [Range(1, 90)]
    public int ResumeExpiryDays { get; set; } = 7;
}
