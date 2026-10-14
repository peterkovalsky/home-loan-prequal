using Microsoft.AspNetCore.Diagnostics;

namespace HomeLoan.Api.Http;

/// <summary>
/// Malformed JSON or an unreadable body is the client's fault: 400 ProblemDetails, the same in every
/// environment (minimal APIs only throw for these when ThrowOnBadRequest is on, which we force).
/// The parser's message isn't echoed, so internals don't leak.
/// </summary>
internal sealed class BadRequestExceptionHandler(IProblemDetailsService problems) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
    {
        if (exception is not BadHttpRequestException bad)
        {
            return false;
        }
        httpContext.Response.StatusCode = bad.StatusCode;
        return await problems.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = httpContext,
            ProblemDetails =
            {
                Status = bad.StatusCode,
                Title = "Invalid request",
                Detail = "The request body could not be read. Send valid JSON matching the documented shape."
            }
        });
    }
}
