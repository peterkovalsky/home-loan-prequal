using System.Reflection;
using DbUp;
using DbUp.Engine;
using DbUp.Helpers;
using Microsoft.Data.SqlClient;

namespace HomeLoan.Migrations;

/// <summary>
/// Brings a database up to date: creates it if needed, applies new scripts in
/// <c>Scripts/Migrations</c> (journaled, one transaction each), then re-runs the idempotent
/// scripts in <c>Scripts/Always</c>. Used by the console app, the integration tests and,
/// in AWS, a one-off migration run.
/// </summary>
public static class DatabaseMigrator
{
    private static readonly Assembly Scripts = typeof(DatabaseMigrator).Assembly;

    /// <param name="adminConnectionString">A login allowed to create the database, tables and logins.</param>
    /// <param name="appLoginPassword">Password for the API's least-privilege login. Skipped when null.</param>
    public static MigrationResult Migrate(string adminConnectionString, string? appLoginPassword, TextWriter log)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(adminConnectionString);
        ArgumentNullException.ThrowIfNull(log);

        EnsureDatabase.For.SqlDatabase(adminConnectionString);
        EnableReadCommittedSnapshot(adminConnectionString, log);

        var migrations = DeployChanges.To
            .SqlDatabase(adminConnectionString)
            .WithScriptsEmbeddedInAssembly(Scripts, name => name.Contains(".Scripts.Migrations.", StringComparison.Ordinal))
            .WithTransactionPerScript()
            .LogTo(new TextWriterUpgradeLog(log))
            .Build()
            .PerformUpgrade();
        if (!migrations.Successful)
        {
            return MigrationResult.Failed(migrations.Error);
        }

        if (appLoginPassword is null)
        {
            log.WriteLine("No app login password configured; skipping the least-privilege login.");
            return MigrationResult.Succeeded(migrations.Scripts.Select(s => s.Name));
        }

        var always = DeployChanges.To
            .SqlDatabase(adminConnectionString)
            .WithScriptsEmbeddedInAssembly(Scripts, name => name.Contains(".Scripts.Always.", StringComparison.Ordinal))
            .WithVariables(new Dictionary<string, string>
            {
                // Substituted into an N'...' literal, so double any single quotes.
                ["AppLoginPassword"] = appLoginPassword.Replace("'", "''", StringComparison.Ordinal)
            })
            .JournalTo(new NullJournal())
            .LogTo(new TextWriterUpgradeLog(log))
            .Build()
            .PerformUpgrade();

        return always.Successful
            ? MigrationResult.Succeeded(migrations.Scripts.Select(s => s.Name))
            : MigrationResult.Failed(always.Error);
    }

    /// <summary>Reads don't block behind writes. Can't run inside a transaction, so not a DbUp script.</summary>
    private static void EnableReadCommittedSnapshot(string connectionString, TextWriter log)
    {
        using var connection = new SqlConnection(connectionString);
        connection.Open();
        using var check = new SqlCommand(
            "SELECT is_read_committed_snapshot_on FROM sys.databases WHERE name = DB_NAME()", connection);
        if (check.ExecuteScalar() is true)
        {
            return;
        }
        log.WriteLine("Enabling READ_COMMITTED_SNAPSHOT.");
        using var enable = new SqlCommand(
            "ALTER DATABASE CURRENT SET READ_COMMITTED_SNAPSHOT ON WITH ROLLBACK IMMEDIATE", connection);
        enable.ExecuteNonQuery();
    }
}

public sealed record MigrationResult(bool Successful, IReadOnlyList<string> AppliedScripts, Exception? Error)
{
    public static MigrationResult Succeeded(IEnumerable<string> scripts) => new(true, scripts.ToList(), null);

    public static MigrationResult Failed(Exception error) => new(false, [], error);
}

/// <summary>DbUp log sink that writes to any TextWriter (console in the app, test output in tests).</summary>
internal sealed class TextWriterUpgradeLog(TextWriter writer) : DbUp.Engine.Output.IUpgradeLog
{
    public void LogTrace(string format, params object[] args) { }

    public void LogDebug(string format, params object[] args) { }

    public void LogInformation(string format, params object[] args) => writer.WriteLine(Format(format, args));

    public void LogWarning(string format, params object[] args) => writer.WriteLine("WARN " + Format(format, args));

    public void LogError(string format, params object[] args) => writer.WriteLine("ERROR " + Format(format, args));

    public void LogError(Exception ex, string format, params object[] args) =>
        writer.WriteLine($"ERROR {Format(format, args)}: {ex.Message}");

    private static string Format(string format, object[] args) =>
        args.Length == 0 ? format : string.Format(System.Globalization.CultureInfo.InvariantCulture, format, args);
}
