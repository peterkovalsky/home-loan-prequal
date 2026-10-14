using FluentValidation.Results;

namespace HomeLoan.Application.Common;

public static class ValidationExtensions
{
    /// <summary>Groups failures by camelCase field path (<c>applicants[1].mobile</c>), matching the front end's keys.</summary>
    public static AppError ToError(this ValidationResult result)
    {
        ArgumentNullException.ThrowIfNull(result);
        return AppError.Validation(result.Errors
            .GroupBy(failure => ToCamelPath(failure.PropertyName))
            .ToDictionary(group => group.Key, group => group.Select(f => f.ErrorMessage).Distinct().ToArray()));
    }

    internal static string ToCamelPath(string path) =>
        string.Join('.', path.Split('.').Select(segment =>
            segment.Length == 0 ? segment : char.ToLowerInvariant(segment[0]) + segment[1..]));
}
