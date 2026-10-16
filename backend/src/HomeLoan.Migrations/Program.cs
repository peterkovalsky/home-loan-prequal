using System.Text.Json;
using Amazon.Lambda.Core;
using Amazon.Lambda.RuntimeSupport;
using Amazon.Lambda.Serialization.SystemTextJson;
using HomeLoan.Migrations;
using HomeLoan.Secrets;
using Microsoft.Extensions.Configuration;

// Settings: ConnectionStrings:Admin and Database:AppLoginPassword, from appsettings.json, environment
// variables (ConnectionStrings__Admin), --key=value, or on AWS from Secrets Manager
// (Database:AdminSecretArn, Database:AppSecretArn, Database:Host).
var configuration = new ConfigurationManager();
configuration.AddJsonFile("appsettings.json", optional: true);
configuration.AddEnvironmentVariables();
configuration.AddCommandLine(args);
await DatabaseSecrets.ApplyAsync(configuration);

if (Environment.GetEnvironmentVariable("AWS_LAMBDA_RUNTIME_API") is not null)
{
    // On Lambda the CDK deploy trigger invokes this once per deploy. Throwing makes the invocation
    // fail, which fails (and rolls back) the deployment. A daily schedule invokes it with
    // {"task":"purge-expired"} to delete expired personal data instead.
    var handler = (JsonElement input, ILambdaContext context) =>
    {
        if (input.ValueKind == JsonValueKind.Object
            && input.TryGetProperty("task", out var task)
            && task.GetString() == DataRetention.Task)
        {
            var purged = MigrationRun.PurgeFromConfiguration(configuration);
            Console.WriteLine($"Purged {purged.DraftsDeleted} draft(s) and {purged.ApplicationsDeleted} unfinished application(s).");
            return Task.FromResult<object>(purged);
        }

        var result = MigrationRun.FromConfiguration(configuration, Console.Out);
        if (!result.Successful)
        {
            throw new InvalidOperationException("Database migration failed.", result.Error);
        }
        return Task.FromResult<object>(new MigrationSummary(result.AppliedScripts.Count, result.AppliedScripts));
    };
    await LambdaBootstrapBuilder.Create(handler, new DefaultLambdaJsonSerializer()).Build().RunAsync();
    return 0;
}

try
{
    var outcome = MigrationRun.FromConfiguration(configuration, Console.Out);
    if (!outcome.Successful)
    {
        await Console.Error.WriteLineAsync($"Migration failed: {outcome.Error?.Message}");
        return 1;
    }
    Console.WriteLine($"Database is up to date ({outcome.AppliedScripts.Count} new script(s) applied).");
    return 0;
}
catch (InvalidOperationException ex)
{
    await Console.Error.WriteLineAsync(ex.Message);
    return 2;
}
