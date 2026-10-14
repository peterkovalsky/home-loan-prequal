using HomeLoan.Api.Http;
using HomeLoan.Application.Applicants;
using HomeLoan.Application.Applications;
using HomeLoan.Application.Loans;

namespace HomeLoan.Api.Endpoints;

internal static class ApplicationEndpoints
{
    public static IEndpointRouteBuilder MapApplicationEndpoints(this IEndpointRouteBuilder routes)
    {
        var application = routes.MapGroup("/api/applications/{applicationId:int:min(1)}").WithTags("Applications");

        application.MapGet("/loan-details", async (int applicationId, GetLoanDetailsHandler handler, HttpContext http, CancellationToken ct) =>
                (await handler.HandleAsync(applicationId, ct)).ToGetResult(http))
            .WithName("GetLoanDetails");

        application.MapPut("/loan-details", async (int applicationId, LoanDetailsDto body, SaveLoanDetailsHandler handler, HttpContext http, CancellationToken ct) =>
                (await handler.HandleAsync(applicationId, body, http.Request.IfMatch(), ct)).ToPutResult(http))
            .WithName("SaveLoanDetails");

        application.MapGet("/applicants", async (int applicationId, GetApplicantsHandler handler, HttpContext http, CancellationToken ct) =>
                (await handler.HandleAsync(applicationId, ct)).ToGetResult(http))
            .WithName("GetApplicants");

        application.MapPut("/applicants", async (int applicationId, SaveApplicantsRequest body, SaveApplicantsHandler handler, HttpContext http, CancellationToken ct) =>
                (await handler.HandleAsync(applicationId, body, http.Request.IfMatch(), ct)).ToPutResult(http))
            .WithName("SaveApplicants");

        application.MapDelete("", async (int applicationId, DeleteApplicationHandler handler, CancellationToken ct) =>
            {
                await handler.HandleAsync(applicationId, ct);
                return TypedResults.NoContent();
            })
            .WithName("DeleteApplication");

        return routes;
    }
}
