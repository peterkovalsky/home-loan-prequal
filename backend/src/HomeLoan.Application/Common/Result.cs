namespace HomeLoan.Application.Common;

public enum ErrorKind
{
    Validation,
    NotFound,
    Conflict,
    PreconditionRequired,
    PreconditionFailed
}

/// <summary>An expected failure. <see cref="Fields"/> holds per-field messages for validation errors.</summary>
public sealed record AppError(ErrorKind Kind, string Message, IReadOnlyDictionary<string, string[]>? Fields = null)
{
    public static AppError Validation(IReadOnlyDictionary<string, string[]> fields) =>
        new(ErrorKind.Validation, "One or more fields are invalid.", fields);

    public static AppError Validation(string field, string message) =>
        Validation(new Dictionary<string, string[]> { [field] = [message] });

    public static AppError NotFound(string message) => new(ErrorKind.NotFound, message);

    public static AppError Conflict(string message) => new(ErrorKind.Conflict, message);

    public static readonly AppError PreconditionRequired = new(
        ErrorKind.PreconditionRequired, "Send If-Match with the ETag from your last read.");

    public static readonly AppError PreconditionFailed = new(
        ErrorKind.PreconditionFailed, "This resource was changed by someone else. Reload and try again.");
}

/// <summary>Either a value or an <see cref="Error"/>. Handlers return this; endpoints map it to HTTP.</summary>
public sealed class Result<T>
{
    private readonly T? value;

    private Result(T? value, AppError? error)
    {
        this.value = value;
        Error = error;
    }

    public AppError? Error { get; }

    public bool IsSuccess => Error is null;

    public T Value => IsSuccess ? value! : throw new InvalidOperationException($"No value: {Error!.Message}");

#pragma warning disable CA2225 // Implicit conversions keep handlers readable; Result.Success/Failure are the named alternates.
    public static implicit operator Result<T>(T value) => new(value, null);

    public static implicit operator Result<T>(AppError error) => new(default, error);
#pragma warning restore CA2225

    internal static Result<T> Create(T? value, AppError? error) => new(value, error);
}

public static class Result
{
    public static Result<T> Success<T>(T value) => Result<T>.Create(value, null);

    public static Result<T> Failure<T>(AppError error) => Result<T>.Create(default, error);
}
