using System.ComponentModel.DataAnnotations;
using Amazon.Lambda.AspNetCoreServer.Hosting;
using HomeLoan.Api.Endpoints;
using HomeLoan.Api.Http;
using HomeLoan.Application;
using HomeLoan.Application.Common;
using HomeLoan.Infrastructure;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.Extensions.Options;

namespace HomeLoan.Api;

internal sealed class CorsOptions
{
    public const string Section = "Cors";

    [Required]
    public string[] AllowedOrigins { get; set; } = [];
}

internal static class HostingExtensions
{
    public static WebApplicationBuilder ConfigureServices(this WebApplicationBuilder builder)
    {
        // JSON to stdout: CloudWatch on Lambda, `docker logs` locally. Scopes carry the correlation id.
        builder.Logging.ClearProviders();
        builder.Logging.AddJsonConsole(options =>
        {
            options.IncludeScopes = true;
            options.UseUtcTimestamp = true;
            options.TimestampFormat = "yyyy-MM-ddTHH:mm:ss.fffZ";
        });

        // A no-op under Kestrel; on Lambda it swaps the server for the API Gateway HTTP API adapter.
        builder.Services.AddAWSLambdaHosting(LambdaEventSource.HttpApi);

        builder.Services.AddApplication();
        builder.Services.AddInfrastructure(builder.Configuration);
        BindOptions<ApplicantOptions>(builder, ApplicantOptions.Section);
        BindOptions<ConsentOptions>(builder, ConsentOptions.Section);
        BindOptions<ClockOptions>(builder, ClockOptions.Section)
            .Validate(o => TimeZoneInfo.TryFindSystemTimeZoneById(o.TimeZone, out _), "Clock:TimeZone is not a known time zone.");
        BindOptions<CorsOptions>(builder, CorsOptions.Section);

        builder.Services.AddCors(cors => cors.AddDefaultPolicy(policy => policy
            .WithOrigins(builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [])
            .WithMethods("GET", "PUT", "DELETE")
            .WithHeaders("Content-Type", "If-Match", CorrelationIdMiddleware.Header)
            .WithExposedHeaders("ETag", CorrelationIdMiddleware.Header)));

        builder.Services.AddProblemDetails(options => options.CustomizeProblemDetails = context =>
            context.ProblemDetails.Extensions["correlationId"] = context.HttpContext.TraceIdentifier);
        builder.Services.AddExceptionHandler<DatabaseExceptionHandler>();
        // Same bad-request behaviour in every environment (the default only throws in Development).
        builder.Services.Configure<RouteHandlerOptions>(options => options.ThrowOnBadRequest = true);

        builder.Services.AddEndpointsApiExplorer();
        builder.Services.AddSwaggerGen();
        return builder;
    }

    public static WebApplication ConfigurePipeline(this WebApplication app)
    {
        app.UseExceptionHandler();
        app.UseStatusCodePages();
        app.UseMiddleware<CorrelationIdMiddleware>();
        app.UseMiddleware<BadRequestMiddleware>();
        app.UseCors();

        if (app.Environment.IsDevelopment())
        {
            app.UseSwagger();
            app.UseSwaggerUI();
        }

        app.MapHealthChecks("/health/live", new HealthCheckOptions { Predicate = _ => false });
        app.MapHealthChecks("/health/ready", new HealthCheckOptions { Predicate = check => check.Tags.Contains("ready") });
        app.MapApplicationEndpoints();
        return app;
    }

    private static OptionsBuilder<T> BindOptions<T>(WebApplicationBuilder builder, string section)
        where T : class => builder.Services.AddOptions<T>()
            .Bind(builder.Configuration.GetSection(section))
            .ValidateDataAnnotations()
            .ValidateOnStart();
}
