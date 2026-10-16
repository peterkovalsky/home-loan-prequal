using System.Text.Json;
using HomeLoan.Api.Http;
using HomeLoan.Application.Applicants;
using HomeLoan.Application.Applications;
using HomeLoan.Application.Drafts;
using HomeLoan.Application.Loans;

namespace HomeLoan.Api.Endpoints;

internal static class ApplicationEndpoints
{
    public static IEndpointRouteBuilder MapApplicationEndpoints(this IEndpointRouteBuilder routes)
    {
        // Open to anyone: it's how a visitor starts. The token in the response is shown only once.
        routes.MapPost("/api/applications", async (CreateApplicationHandler handler, CancellationToken ct) =>
            {
                var created = await handler.HandleAsync(ct);
                return TypedResults.Created($"/api/applications/{created.Id}", created);
            })
            .WithTags("Applications")
            .WithName("CreateApplication");

        var application = routes.MapGroup("/api/applications/{applicationId:int:min(1)}")
            .WithTags("Applications")
            .AddEndpointFilter(ApplicationAccessFilter.InvokeAsync);

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

        // Drafts: what the customer has typed so far, valid or not. Last write wins (no If-Match),
        // so an autosave never interrupts the customer; the real save keeps its 412 protection.
        application.MapGet("/drafts", async (int applicationId, GetDraftsHandler handler, CancellationToken ct) =>
                TypedResults.Ok(await handler.HandleAsync(applicationId, ct)))
            .WithName("GetDrafts");

        application.MapPut("/drafts/{step}", async (int applicationId, string step, JsonElement body, SaveDraftHandler handler, HttpContext http, CancellationToken ct) =>
            {
                var saved = await handler.HandleAsync(applicationId, step, body, ct);
                return saved.IsSuccess ? TypedResults.NoContent() : HttpResultMapping.ToProblem(saved.Error!, http);
            })
            .WithName("SaveDraft");

        application.MapDelete("", async (int applicationId, DeleteApplicationHandler handler, CancellationToken ct) =>
            {
                await handler.HandleAsync(applicationId, ct);
                return TypedResults.NoContent();
            })
            .WithName("DeleteApplication");

        return routes;
    }
}
