using HomeLoan.Application.Applications;
using HomeLoan.Application.Common;

namespace HomeLoan.Api.Http;

/// <summary>
/// Guards every <c>/api/applications/{applicationId}</c> route: the request must carry that
/// application's resume token. The browser sends it in a header today. A cookie is accepted too,
/// for when the front end and the API share a domain and it can be an HttpOnly cookie.
/// </summary>
internal static class ApplicationAccessFilter
{
    public const string Header = "X-Application-Token";
    public const string Cookie = "hl_resume";

    public static async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        var http = context.HttpContext;
        var token = http.Request.Headers[Header] is { Count: > 0 } header ? header.ToString() : http.Request.Cookies[Cookie];
        var allowed = int.TryParse(http.GetRouteValue("applicationId")?.ToString(), out var applicationId)
            && await http.RequestServices.GetRequiredService<ApplicationAccess>()
                .CanAccessAsync(applicationId, token, http.RequestAborted);

        // The same answer for "no such application", "wrong token" and "expired", so ids can't be probed.
        return allowed
            ? await next(context)
            : HttpResultMapping.ToProblem(AppError.NotFound("Application not found."), http);
    }
}
