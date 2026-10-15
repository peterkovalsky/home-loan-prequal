using Microsoft.Extensions.Configuration;

namespace HomeLoan.Migrations;

/// <summary>One migration run from configuration; shared by the console app and the Lambda handler.</summary>
public static class MigrationRun
{
    public static MigrationResult FromConfiguration(IConfiguration configuration, TextWriter log)
    {
        ArgumentNullException.ThrowIfNull(configuration);
        var admin = configuration.GetConnectionString("Admin");
        if (string.IsNullOrWhiteSpace(admin))
        {
            throw new InvalidOperationException("ConnectionStrings:Admin (or Database:AdminSecretArn) is required.");
        }
        return DatabaseMigrator.Migrate(admin, configuration["Database:AppLoginPassword"], log);
    }
}

/// <summary>What the Lambda returns to its caller (the CDK deploy trigger).</summary>
public sealed record MigrationSummary(int AppliedScripts, IReadOnlyList<string> Scripts);
