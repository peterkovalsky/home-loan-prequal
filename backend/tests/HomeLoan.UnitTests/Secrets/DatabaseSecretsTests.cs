using HomeLoan.Secrets;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;

namespace HomeLoan.UnitTests.Secrets;

public class DatabaseSecretsTests
{
    private const string AppArn = "arn:aws:secretsmanager:ap-southeast-2:1:secret:app";
    private const string AdminArn = "arn:aws:secretsmanager:ap-southeast-2:1:secret:admin";

    private static ConfigurationManager Config(params (string Key, string Value)[] values)
    {
        var configuration = new ConfigurationManager();
        configuration.AddInMemoryCollection(values.ToDictionary(v => v.Key, v => (string?)v.Value));
        return configuration;
    }

    private static DatabaseSecrets.SecretFetcher Secrets(Dictionary<string, string> byArn) =>
        (arn, _) => Task.FromResult(byArn[arn]);

    [Fact]
    public async Task Does_nothing_when_no_secret_is_configured()
    {
        var configuration = Config(("ConnectionStrings:HomeLoan", "Server=local"));

        await DatabaseSecrets.ApplyAsync(configuration, (_, _) => throw new InvalidOperationException("should not fetch"));

        Assert.Equal("Server=local", configuration.GetConnectionString("HomeLoan"));
    }

    [Fact]
    public async Task Resolve_returns_the_settings_without_touching_the_configuration()
    {
        var configuration = Config(("Database:AppSecretArn", AppArn), ("Database:Host", "db"));

        var settings = await DatabaseSecrets.ResolveAsync(configuration, Secrets(new()
        {
            [AppArn] = """{"username":"homeloan_app","password":"pw"}"""
        }));

        Assert.Equal("homeloan_app", new SqlConnectionStringBuilder(settings["ConnectionStrings:HomeLoan"]).UserID);
        Assert.Equal("pw", settings["Database:AppLoginPassword"]);
        Assert.Null(configuration.GetConnectionString("HomeLoan"));
    }

    [Fact]
    public async Task Builds_an_encrypted_validated_connection_string_for_the_app_login()
    {
        var configuration = Config(("Database:AppSecretArn", AppArn), ("Database:Host", "db.example.rds.amazonaws.com"));

        await DatabaseSecrets.ApplyAsync(configuration, Secrets(new()
        {
            [AppArn] = """{"username":"homeloan_app","password":"p@ss;word"}"""
        }));

        var built = new SqlConnectionStringBuilder(configuration.GetConnectionString("HomeLoan"));
        Assert.Equal("db.example.rds.amazonaws.com,1433", built.DataSource);
        Assert.Equal("HomeLoan", built.InitialCatalog);
        Assert.Equal("homeloan_app", built.UserID);
        Assert.Equal("p@ss;word", built.Password);
        Assert.Equal(SqlConnectionEncryptOption.Mandatory, built.Encrypt);
        Assert.False(built.TrustServerCertificate);
        Assert.Equal("p@ss;word", configuration["Database:AppLoginPassword"]);
    }

    [Fact]
    public async Task Gives_the_migrator_an_admin_connection_and_the_app_password()
    {
        var configuration = Config(
            ("Database:AppSecretArn", AppArn), ("Database:AdminSecretArn", AdminArn),
            ("Database:Host", "db"), ("Database:Port", "1444"), ("Database:Name", "Other"));

        await DatabaseSecrets.ApplyAsync(configuration, Secrets(new()
        {
            [AppArn] = """{"username":"homeloan_app","password":"app-pw"}""",
            [AdminArn] = """{"username":"admin","password":"admin-pw","engine":"sqlserver","host":"ignored"}"""
        }));

        var admin = new SqlConnectionStringBuilder(configuration.GetConnectionString("Admin"));
        Assert.Equal(("db,1444", "Other", "admin"), (admin.DataSource, admin.InitialCatalog, admin.UserID));
        Assert.Equal("app-pw", configuration["Database:AppLoginPassword"]);
    }

    [Fact]
    public async Task Requires_the_host() =>
        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            DatabaseSecrets.ApplyAsync(Config(("Database:AppSecretArn", AppArn)), Secrets(new())));

    [Theory]
    [InlineData("not json")]
    [InlineData("""{"username":"x"}""")]
    public async Task Rejects_a_malformed_secret_without_leaking_it(string json)
    {
        var configuration = Config(("Database:AppSecretArn", AppArn), ("Database:Host", "db"));

        var error = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            DatabaseSecrets.ApplyAsync(configuration, Secrets(new() { [AppArn] = json })));

        Assert.Contains(AppArn, error.Message, StringComparison.Ordinal);
        Assert.DoesNotContain(json, error.Message, StringComparison.Ordinal);
    }
}
