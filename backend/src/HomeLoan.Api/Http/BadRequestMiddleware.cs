namespace HomeLoan.Api.Http;

/// <summary>
/// Malformed JSON or an unreadable body is the client's fault: a 400 ProblemDetails in every
/// environment (ThrowOnBadRequest is forced on so the framework throws for these).
///
/// This runs inside UseExceptionHandler on purpose. In .NET 8 the exception handler middleware logs
/// every exception at Error level with a stack trace before any IExceptionHandler runs, so handling
/// client mistakes there would page someone for every typo. Here they are logged at Information.
/// The parser's message isn't echoed to the client, so internals don't leak.
/// </summary>
internal sealed partial class BadRequestMiddleware(RequestDelegate next, IProblemDetailsService problems, ILogger<BadRequestMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (BadHttpRequestException bad) when (!context.Response.HasStarted)
        {
            LogBadRequest(logger, bad.StatusCode, bad.Message);
            context.Response.StatusCode = bad.StatusCode;
            await problems.WriteAsync(new ProblemDetailsContext
            {
                HttpContext = context,
                ProblemDetails =
                {
                    Status = bad.StatusCode,
                    Title = "Invalid request",
                    Detail = "The request body could not be read. Send valid JSON matching the documented shape."
                }
            });
        }
    }

    [LoggerMessage(Level = LogLevel.Information, Message = "Rejected bad request ({StatusCode}): {Reason}")]
    private static partial void LogBadRequest(ILogger logger, int statusCode, string reason);
}
