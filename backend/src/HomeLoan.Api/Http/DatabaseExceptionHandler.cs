using Microsoft.AspNetCore.Diagnostics;
using Microsoft.Data.SqlClient;

namespace HomeLoan.Api.Http;

/// <summary>
/// Deadlocks and timeouts are transient: tell the client to retry (503 + Retry-After) instead of a
/// generic 500. Anything else falls through to the default ProblemDetails 500 (no stack trace).
/// </summary>
internal sealed partial class DatabaseExceptionHandler(IProblemDetailsService problems, ILogger<DatabaseExceptionHandler> logger) : IExceptionHandler
{
    private const int Deadlock = 1205;
    private const int Timeout = -2;

    public async ValueTask<bool> TryHandleAsync(HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
    {
        if (exception is not SqlException { Number: Deadlock or Timeout } sql)
        {
            return false;
        }
        LogTransient(logger, sql.Number, sql);
        httpContext.Response.StatusCode = StatusCodes.Status503ServiceUnavailable;
        httpContext.Response.Headers.RetryAfter = "1";
        return await problems.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = httpContext,
            ProblemDetails =
            {
                Status = StatusCodes.Status503ServiceUnavailable,
                Title = "Temporarily unavailable",
                Detail = "Please try again in a moment."
            }
        });
    }

    [LoggerMessage(Level = LogLevel.Warning, Message = "Transient database error {Number}")]
    private static partial void LogTransient(ILogger logger, int number, Exception exception);
}
