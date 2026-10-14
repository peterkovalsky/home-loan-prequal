using System.Globalization;

namespace HomeLoan.Domain;

public enum DateOfBirthProblem
{
    Invalid,
    Future,
    Underage,
    TooOld
}

public static class DateOfBirth
{
    /// <summary>Parses an ISO calendar date (<c>yyyy-MM-dd</c>); rejects impossible dates such as 2023-02-30.</summary>
    public static DateOnly? Parse(string? value) =>
        DateOnly.TryParseExact(value, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var date)
            ? date
            : null;

    /// <summary>Whole years on <paramref name="today"/>. A 29 Feb birthday is reached on 1 Mar in other years.</summary>
    public static int AgeOn(DateOnly dateOfBirth, DateOnly today)
    {
        var age = today.Year - dateOfBirth.Year;
        var hadBirthday = today.Month > dateOfBirth.Month
            || (today.Month == dateOfBirth.Month && today.Day >= dateOfBirth.Day);
        return hadBirthday ? age : age - 1;
    }

    public static DateOfBirthProblem? Check(string? value, DateOnly today)
    {
        if (Parse(value) is not { } dob)
        {
            return DateOfBirthProblem.Invalid;
        }
        if (dob > today)
        {
            return DateOfBirthProblem.Future;
        }
        var age = AgeOn(dob, today);
        if (age < ApplicantRules.MinimumAge)
        {
            return DateOfBirthProblem.Underage;
        }
        return age > ApplicantRules.MaximumAge ? DateOfBirthProblem.TooOld : null;
    }
}
