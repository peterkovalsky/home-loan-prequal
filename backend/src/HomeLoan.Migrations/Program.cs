using HomeLoan.Migrations;
using Microsoft.Extensions.Configuration;

// Settings: ConnectionStrings:Admin (required) and Database:AppLoginPassword (optional),
// from appsettings.json, environment variables (ConnectionStrings__Admin) or --key=value.
var configuration = new ConfigurationBuilder()
    .AddJsonFile("appsettings.json", optional: true)
    .AddEnvironmentVariables()
    .AddCommandLine(args)
    .Build();

var adminConnectionString = configuration.GetConnectionString("Admin");
if (string.IsNullOrWhiteSpace(adminConnectionString))
{
    await Console.Error.WriteLineAsync("ConnectionStrings:Admin is required.");
    return 2;
}

var result = DatabaseMigrator.Migrate(adminConnectionString, configuration["Database:AppLoginPassword"], Console.Out);
if (!result.Successful)
{
    await Console.Error.WriteLineAsync($"Migration failed: {result.Error?.Message}");
    return 1;
}

Console.WriteLine($"Database is up to date ({result.AppliedScripts.Count} new script(s) applied).");
return 0;
