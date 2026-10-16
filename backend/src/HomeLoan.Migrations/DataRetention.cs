using Microsoft.Data.SqlClient;

namespace HomeLoan.Migrations;

/// <summary>
/// Keeps personal data no longer than needed. After <c>expiryDays</c> without activity an
/// application can't be resumed (the API refuses it). This removes what's left:
/// <list type="bullet">
/// <item>drafts of inactive applications;</item>
/// <item>inactive applications that were never finished (no About you saved), with everything in them.</item>
/// </list>
/// Finished applications are kept: they're the lender's record of the pre-qualification.
/// Runs daily on AWS (EventBridge invokes the migrator Lambda with <c>{"task":"purge-expired"}</c>).
/// </summary>
public static class DataRetention
{
    public const string Task = "purge-expired";

    public static PurgeSummary PurgeExpired(string adminConnectionString, int expiryDays)
    {
        using var connection = new SqlConnection(adminConnectionString);
        connection.Open();
        using var transaction = connection.BeginTransaction();
        using var command = new SqlCommand(
            """
            DECLARE @cutoff datetime2(3) = DATEADD(day, -@expiryDays, SYSUTCDATETIME());

            DELETE d FROM app.ApplicationDraft d
            JOIN app.Application a ON a.Id = d.ApplicationId
            WHERE a.LastActivityAt < @cutoff;
            DECLARE @drafts int = @@ROWCOUNT;

            DELETE a FROM app.Application a
            WHERE a.LastActivityAt < @cutoff
              AND NOT EXISTS (SELECT 1 FROM app.ApplicantSet s WHERE s.ApplicationId = a.Id);

            SELECT @drafts, @@ROWCOUNT;
            """,
            connection,
            transaction);
        command.Parameters.AddWithValue("@expiryDays", expiryDays);
        using var reader = command.ExecuteReader();
        reader.Read();
        var summary = new PurgeSummary(reader.GetInt32(0), reader.GetInt32(1));
        reader.Close();
        transaction.Commit();
        return summary;
    }
}

public sealed record PurgeSummary(int DraftsDeleted, int ApplicationsDeleted);
