using System.Text.Json;
using Amazon.SecretsManager;
using Amazon.SecretsManager.Model;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;

namespace HomeLoan.Secrets;

/// <summary>
/// On AWS, database credentials live in Secrets Manager and only the secret ARNs and the host are
/// configured. This resolves them once at start-up into the same settings the app uses locally
/// (<c>ConnectionStrings:HomeLoan</c>, <c>ConnectionStrings:Admin</c>, <c>Database:AppLoginPassword</c>),
/// so nothing downstream knows or cares where they came from. Passwords never sit in environment
/// variables. When no ARN is configured (Docker, tests) this does nothing.
/// </summary>
public static class DatabaseSecrets
{
    public const string AppSecretArnKey = "Database:AppSecretArn";
    public const string AdminSecretArnKey = "Database:AdminSecretArn";

    /// <summary>Reads a secret's JSON by ARN. Defaults to the real Secrets Manager client.</summary>
    public delegate Task<string> SecretFetcher(string secretArn, CancellationToken cancellationToken);

    public static async Task ApplyAsync(IConfigurationManager configuration, SecretFetcher? fetch = null, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(configuration);
        var settings = await ResolveAsync(configuration, fetch, cancellationToken);
        if (settings.Count > 0)
        {
            configuration.AddInMemoryCollection(settings);
        }
    }

    /// <summary>
    /// Fetches and builds the settings without applying them, so a caller can start this early and
    /// overlap it with other start-up work. Empty when no secret ARN is configured.
    /// </summary>
    public static async Task<IReadOnlyDictionary<string, string?>> ResolveAsync(IConfiguration configuration, SecretFetcher? fetch = null, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(configuration);
        var appArn = configuration[AppSecretArnKey];
        var adminArn = configuration[AdminSecretArnKey];
        if (string.IsNullOrWhiteSpace(appArn) && string.IsNullOrWhiteSpace(adminArn))
        {
            return new Dictionary<string, string?>();
        }

        var host = configuration["Database:Host"];
        if (string.IsNullOrWhiteSpace(host))
        {
            throw new InvalidOperationException("Database:Host is required when database secrets come from Secrets Manager.");
        }
        var port = int.TryParse(configuration["Database:Port"], out var p) ? p : 1433;
        var name = configuration["Database:Name"] is { Length: > 0 } n ? n : "HomeLoan";

        fetch ??= FetchFromSecretsManager;
        var settings = new Dictionary<string, string?>();
        if (!string.IsNullOrWhiteSpace(appArn))
        {
            var app = Parse(await fetch(appArn, cancellationToken), appArn);
            settings["ConnectionStrings:HomeLoan"] = BuildConnectionString(host, port, name, app);
            settings["Database:AppLoginPassword"] = app.Password;
        }
        if (!string.IsNullOrWhiteSpace(adminArn))
        {
            var admin = Parse(await fetch(adminArn, cancellationToken), adminArn);
            settings["ConnectionStrings:Admin"] = BuildConnectionString(host, port, name, admin);
        }
        return settings;
    }

    /// <summary>Encrypted and certificate-validated: the image trusts the RDS CA bundle.</summary>
    internal static string BuildConnectionString(string host, int port, string database, Credentials credentials) =>
        new SqlConnectionStringBuilder
        {
            DataSource = $"{host},{port}",
            InitialCatalog = database,
            UserID = credentials.Username,
            Password = credentials.Password,
            Encrypt = SqlConnectionEncryptOption.Mandatory,
            TrustServerCertificate = false
        }.ConnectionString;

    internal static Credentials Parse(string json, string secretArn)
    {
        try
        {
            var secret = JsonSerializer.Deserialize<SecretJson>(json);
            if (!string.IsNullOrEmpty(secret?.username) && !string.IsNullOrEmpty(secret.password))
            {
                return new Credentials(secret.username, secret.password);
            }
        }
        catch (JsonException)
        {
        }
        // Never include the secret's content in the message.
        throw new InvalidOperationException($"Secret {secretArn} must be JSON with 'username' and 'password'.");
    }

    private static async Task<string> FetchFromSecretsManager(string secretArn, CancellationToken cancellationToken)
    {
        using var client = new AmazonSecretsManagerClient();
        var response = await client.GetSecretValueAsync(new GetSecretValueRequest { SecretId = secretArn }, cancellationToken);
        return response.SecretString;
    }

    internal sealed record Credentials(string Username, string Password);

#pragma warning disable IDE1006, CA1812 // Shape of the RDS secret JSON; instantiated by the serializer.
    private sealed record SecretJson(string? username, string? password);
#pragma warning restore IDE1006, CA1812
}
