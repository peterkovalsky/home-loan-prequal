using Constructs;

namespace HomeLoan.Infra;

/// <summary>Values from cdk.json "context" (overridable with -c key=value), read once and validated.</summary>
internal sealed record DeploymentSettings(
    string Account,
    string Region,
    string GitHubSubjectPrefix,
    string GitHubEnvironment,
    IReadOnlyList<string> AllowedOrigins,
    string? BudgetEmail)
{
    public static DeploymentSettings From(Construct scope)
    {
        string Required(string key) =>
            scope.Node.TryGetContext(key) is string { Length: > 0 } value
                ? value
                : throw new InvalidOperationException($"cdk.json context '{key}' is required.");

        return new DeploymentSettings(
            Required("account"),
            Required("region"),
            Required("githubSubjectPrefix"),
            Required("githubEnvironment"),
            Required("allowedOrigins").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries),
            scope.Node.TryGetContext("budgetEmail") as string is { Length: > 0 } email ? email : null);
    }
}

internal static class RepoPaths
{
    /// <summary>The backend folder (Docker build context), found by walking up from where the app runs.</summary>
    public static string Backend
    {
        get
        {
            for (var dir = new DirectoryInfo(Directory.GetCurrentDirectory()); dir is not null; dir = dir.Parent)
            {
                var candidate = Path.Combine(dir.FullName, "backend", "Dockerfile");
                if (File.Exists(candidate))
                {
                    return Path.GetDirectoryName(candidate)!;
                }
            }
            throw new InvalidOperationException("Could not find backend/Dockerfile above the current directory.");
        }
    }
}
