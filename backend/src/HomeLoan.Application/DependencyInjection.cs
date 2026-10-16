using FluentValidation;
using HomeLoan.Application.Applicants;
using HomeLoan.Application.Applications;
using HomeLoan.Application.Common;
using HomeLoan.Application.Drafts;
using HomeLoan.Application.Loans;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace HomeLoan.Application;

public static class DependencyInjection
{
    /// <summary>Handlers, validators and the business clock. Options are bound by the host.</summary>
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.TryAddSingleton(TimeProvider.System);
        services.AddSingleton<IBusinessClock, BusinessClock>();
        services.AddValidatorsFromAssemblyContaining<LoanDetailsValidator>(ServiceLifetime.Singleton);

        services.AddScoped<GetLoanDetailsHandler>();
        services.AddScoped<SaveLoanDetailsHandler>();
        services.AddScoped<GetApplicantsHandler>();
        services.AddScoped<SaveApplicantsHandler>();
        services.AddScoped<CreateApplicationHandler>();
        services.AddScoped<ApplicationAccess>();
        services.AddScoped<DeleteApplicationHandler>();
        services.AddScoped<GetDraftsHandler>();
        services.AddScoped<SaveDraftHandler>();
        return services;
    }
}
