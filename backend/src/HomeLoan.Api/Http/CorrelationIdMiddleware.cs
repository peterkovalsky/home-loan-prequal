using System.Diagnostics;
using System.Text.RegularExpressions;

namespace HomeLoan.Api.Http;

/// <summary>
/// Every request gets a correlation id: the caller's <c>X-Correlation-Id</c> if it looks safe, else
/// the trace id. It is in every log line's scope, echoed in the response, and in ProblemDetails.
/// </summary>
internal sealed partial class CorrelationIdMiddleware(RequestDelegate next, ILogger<CorrelationIdMiddleware> logger)
{
    public const string Header = "X-Correlation-Id";

    public async Task InvokeAsync(HttpContext context)
    {
        var incoming = context.Request.Headers[Header].ToString();
        var id = SafeId().IsMatch(incoming)
            ? incoming
            : Activity.Current?.TraceId.ToString() ?? context.TraceIdentifier;

        context.TraceIdentifier = id;
        context.Response.Headers[Header] = id;
        using (logger.BeginScope(new Dictionary<string, object> { ["CorrelationId"] = id }))
        {
            await next(context);
        }
    }

    [GeneratedRegex("^[A-Za-z0-9._-]{1,64}$")]
    private static partial Regex SafeId();
}
