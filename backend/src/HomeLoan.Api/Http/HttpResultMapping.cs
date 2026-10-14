using HomeLoan.Application.Common;
using Microsoft.AspNetCore.Http.HttpResults;

namespace HomeLoan.Api.Http;

/// <summary>Turns handler results into HTTP: ETag on success, ProblemDetails for expected errors.</summary>
internal static class HttpResultMapping
{
    public static IResult ToGetResult<T>(this Result<Versioned<T>> result, HttpContext http)
    {
        if (!result.IsSuccess)
        {
            return ToProblem(result.Error!, http);
        }
        http.Response.Headers.ETag = result.Value.Version.ToETag();
        return TypedResults.Ok(result.Value.Value);
    }

    public static IResult ToPutResult<T>(this Result<Saved<T>> result, HttpContext http)
    {
        if (!result.IsSuccess)
        {
            return ToProblem(result.Error!, http);
        }
        var saved = result.Value;
        http.Response.Headers.ETag = saved.Version.ToETag();
        return saved.Created
            ? TypedResults.Created(http.Request.Path, saved.Value)
            : TypedResults.Ok(saved.Value);
    }

    /// <summary>The If-Match header, or null when the client didn't send one.</summary>
    public static string? IfMatch(this HttpRequest request) =>
        request.Headers.IfMatch is { Count: > 0 } values ? values.ToString() : null;

    internal static IResult ToProblem(AppError error, HttpContext http) => error.Kind switch
    {
        // ValidationProblem doesn't go through IProblemDetailsService, so add the correlation id here.
        ErrorKind.Validation => TypedResults.ValidationProblem(
            error.Fields!.ToDictionary(pair => pair.Key, pair => pair.Value),
            title: error.Message,
            extensions: new Dictionary<string, object?> { ["correlationId"] = http.TraceIdentifier }),
        ErrorKind.NotFound => Problem(StatusCodes.Status404NotFound, "Not found", error),
        ErrorKind.Conflict => Problem(StatusCodes.Status409Conflict, "Conflict", error),
        ErrorKind.PreconditionRequired => Problem(StatusCodes.Status428PreconditionRequired, "Precondition required", error),
        ErrorKind.PreconditionFailed => Problem(StatusCodes.Status412PreconditionFailed, "Precondition failed", error),
        _ => throw new ArgumentOutOfRangeException(nameof(error), error.Kind, "Unmapped error kind.")
    };

    private static ProblemHttpResult Problem(int status, string title, AppError error) =>
        TypedResults.Problem(statusCode: status, title: title, detail: error.Message);
}
