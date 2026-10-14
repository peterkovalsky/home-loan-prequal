using Dapper;
using HomeLoan.Migrations;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.SqlClient;
using Testcontainers.MsSql;

namespace HomeLoan.IntegrationTests.Infrastructure;

/// <summary>
/// One SQL Server container per test run (slow to start, especially under emulation on Apple
/// Silicon), migrated with the real migrator, and the real API hosted in memory. The API connects
/// as the least-privilege login, so the tests also prove its grants are sufficient.
/// </summary>
public sealed class ApiFixture : IAsyncLifetime
{
    public const string AppLoginPassword = "Test.App-Login1";

    private readonly MsSqlContainer container = new MsSqlBuilder("mcr.microsoft.com/mssql/server:2022-latest")
        .Build();

    private WebApplicationFactory<Program>? factory;

    public string AdminConnectionString { get; private set; } = string.Empty;

    public string AppConnectionString { get; private set; } = string.Empty;

    public WebApplicationFactory<Program> Factory => factory ?? throw new InvalidOperationException("Not initialised.");

    public async Task InitializeAsync()
    {
        await container.StartAsync();
        var admin = new SqlConnectionStringBuilder(container.GetConnectionString()) { InitialCatalog = "HomeLoan" };
        AdminConnectionString = admin.ConnectionString;
        AppConnectionString = new SqlConnectionStringBuilder(AdminConnectionString)
        {
            UserID = "homeloan_app",
            Password = AppLoginPassword
        }.ConnectionString;

        var result = DatabaseMigrator.Migrate(AdminConnectionString, AppLoginPassword, TextWriter.Null);
        if (!result.Successful)
        {
            throw new InvalidOperationException("Migration failed.", result.Error);
        }

        factory = CreateFactory();
    }

    /// <summary>A host with extra settings layered on top (for example a different terms version).</summary>
    public WebApplicationFactory<Program> CreateFactory(IDictionary<string, string?>? settings = null) =>
        new WebApplicationFactory<Program>().WithWebHostBuilder(host =>
        {
            host.UseEnvironment("Production");
            host.UseSetting("ConnectionStrings:HomeLoan", AppConnectionString);
            foreach (var (key, value) in settings ?? new Dictionary<string, string?>())
            {
                host.UseSetting(key, value);
            }
        });

    /// <summary>Removes all application data (reference data stays). Cascades from app.Application.</summary>
    public async Task ResetAsync()
    {
        await using var connection = new SqlConnection(AdminConnectionString);
        await connection.ExecuteAsync("DELETE FROM app.Application;");
    }

    public async Task DisposeAsync()
    {
        if (factory is not null)
        {
            await factory.DisposeAsync();
        }
        await container.DisposeAsync();
    }
}

[CollectionDefinition(Name)]
public sealed class ApiTestGroup : ICollectionFixture<ApiFixture>
{
    public const string Name = "api";
}

/// <summary>Base for tests in the shared collection: a clean database and a client per test.</summary>
[Collection(ApiTestGroup.Name)]
public abstract class ApiTest(ApiFixture fixture) : IAsyncLifetime
{
    protected ApiFixture Fixture { get; } = fixture;

    protected HttpClient Client { get; private set; } = null!;

    public async Task InitializeAsync()
    {
        await Fixture.ResetAsync();
        Client = Fixture.Factory.CreateClient();
    }

    public Task DisposeAsync()
    {
        Client.Dispose();
        return Task.CompletedTask;
    }

    protected async Task<T> ScalarAsync<T>(string sql, object? parameters = null)
    {
        await using var connection = new SqlConnection(Fixture.AdminConnectionString);
        return await connection.ExecuteScalarAsync<T>(sql, parameters) ?? throw new InvalidOperationException("No value.");
    }
}
