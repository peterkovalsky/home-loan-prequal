using HomeLoan.Application.Applicants;
using HomeLoan.Application.Applications;
using HomeLoan.Application.Common;
using HomeLoan.Application.Loans;
using HomeLoan.Infrastructure.Data;
using HomeLoan.Infrastructure.Repositories;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace HomeLoan.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddOptions<DatabaseOptions>()
            .Bind(configuration.GetSection(DatabaseOptions.Section))
            .ValidateDataAnnotations()
            .ValidateOnStart();

        services.AddScoped<DbSession>();
        services.AddScoped<IUnitOfWork>(sp => sp.GetRequiredService<DbSession>());
        services.AddScoped<ILoanDetailsRepository, LoanDetailsRepository>();
        services.AddScoped<IApplicantsRepository, ApplicantsRepository>();
        services.AddScoped<IApplicationRepository, ApplicationRepository>();

        services.AddHealthChecks().AddCheck<DatabaseHealthCheck>("database", tags: ["ready"]);
        return services;
    }
}
